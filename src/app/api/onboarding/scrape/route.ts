import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";

// POST /api/onboarding/scrape
// Fetches the dealer website, extracts meta tags + visible text, then asks Claude
// to return structured dealership profile data. No Puppeteer needed — meta tags and
// og: data are server-rendered on virtually every modern dealer site.

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
}

function getAttr(html: string, tagPattern: string, attrName: string): string | null {
  // Matches <tag ... attr="value" ...> or <tag ... attr='value' ...>
  const re = new RegExp(tagPattern + `[^>]*${attrName}=["']([^"']{1,600})["']`, "i");
  const alt = new RegExp(`${attrName}=["']([^"']{1,600})["'][^>]*` + tagPattern.replace(/\\\[/g, "[").replace(/\\\]/g, "]"), "i");
  return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null;
}

function getMeta(html: string, name: string): string | null {
  // Handles both property= and name= forms, and content= before or after the identifier
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']{1,600})["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']{1,600})["'][^>]+(?:property|name)=["']${name}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function extractLogoUrl(html: string, baseUrl: string): string | null {
  // Priority order: og:image → apple-touch-icon → largest icon → favicon
  const ogImage = getMeta(html, "og:image");
  if (ogImage && !ogImage.includes("placeholder") && !ogImage.includes("default")) {
    return resolveUrl(baseUrl, ogImage);
  }

  const appleTouchRe = /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i;
  const appleTouchM = html.match(appleTouchRe);
  if (appleTouchM) return resolveUrl(baseUrl, appleTouchM[1]);

  // Icon links — pick the last one (usually the largest)
  const iconRe = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/gi;
  let lastIcon: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = iconRe.exec(html)) !== null) lastIcon = m[1];
  if (lastIcon) return resolveUrl(baseUrl, lastIcon);

  // Fallback: /favicon.ico
  try {
    return new URL("/favicon.ico", baseUrl).href;
  } catch {
    return null;
  }
}

function extractPhoneFromHtml(html: string): string | null {
  // Common patterns: tel: href, schema.org telephone, visible phone numbers
  const telHref = html.match(/href=["']tel:([\d\s()\-+.]{7,20})["']/i)?.[1];
  if (telHref) return telHref.trim();

  const schemaTel = html.match(/"telephone"\s*:\s*"([^"]{7,20})"/i)?.[1];
  if (schemaTel) return schemaTel;

  // US phone number pattern in visible text context
  const visiblePhone = html.replace(/<[^>]+>/g, " ").match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/)?.[0];
  return visiblePhone ?? null;
}

function extractAddressFromHtml(html: string): Record<string, string> | null {
  // Try JSON-LD schema first
  const jsonLdRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdM: RegExpExecArray | null;
  while ((jsonLdM = jsonLdRe.exec(html)) !== null) {
    try {
      const obj = JSON.parse(jsonLdM[1]);
      const addr = obj?.address ?? obj?.[0]?.address;
      if (addr?.streetAddress) {
        return {
          street: addr.streetAddress ?? "",
          city: addr.addressLocality ?? "",
          state: addr.addressRegion ?? "",
          zip: addr.postalCode ?? "",
        };
      }
    } catch { /* skip malformed JSON-LD */ }
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 6000);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { url } = body as { url?: string };

  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  const normalized = normalizeUrl(url);
  try { new URL(normalized); } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  // ── 1. Fetch HTML ─────────────────────────────────────────────
  let html = "";
  let fetchedUrl = normalized;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(normalized, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (AutoCDP dealership onboarding bot)" },
      redirect: "follow",
    });
    clearTimeout(timer);
    fetchedUrl = res.url || normalized;
    html = await res.text();
  } catch {
    // Fallback: try http if https failed
    if (normalized.startsWith("https://")) {
      try {
        const httpUrl = normalized.replace("https://", "http://");
        const r = await fetch(httpUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (AutoCDP dealership onboarding bot)" },
          redirect: "follow",
        });
        html = await r.text();
        fetchedUrl = r.url || httpUrl;
      } catch { /* proceed without HTML — Claude will infer from URL */ }
    }
  }

  // ── 2. Extract signals deterministically ──────────────────────
  const title = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.trim() ?? null;
  const ogTitle = getMeta(html, "og:title");
  const ogDescription = getMeta(html, "og:description") ?? getMeta(html, "description");
  const ogSiteName = getMeta(html, "og:site_name");
  const logoUrl = extractLogoUrl(html, fetchedUrl);
  const phone = extractPhoneFromHtml(html);
  const address = extractAddressFromHtml(html);
  const visibleText = html ? stripHtml(html) : "";

  // ── 3. Ask Claude to extract structured profile ───────────────
  const client = getAnthropicClient();

  const pageContext = [
    title       ? `Page title: ${title}` : null,
    ogTitle     ? `og:title: ${ogTitle}` : null,
    ogSiteName  ? `og:site_name: ${ogSiteName}` : null,
    ogDescription ? `og:description: ${ogDescription}` : null,
    phone       ? `Detected phone: ${phone}` : null,
    address     ? `Detected address: ${JSON.stringify(address)}` : null,
    visibleText ? `\nVisible page text (first 6000 chars):\n${visibleText}` : null,
  ].filter(Boolean).join("\n");

  const response = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `You are extracting dealership profile data from a car dealer website.
URL: ${fetchedUrl}

${pageContext || "No HTML could be fetched — infer from URL/domain only."}

Extract the following. Return ONLY valid JSON. Use null for fields you cannot determine with confidence.

{
  "name": "Full dealership name (e.g. Toyota of Tampa Bay, not just Toyota)",
  "phone": "Main phone number in (XXX) XXX-XXXX format",
  "address": {
    "street": "123 Auto Drive",
    "city": "Tampa",
    "state": "FL",
    "zip": "33601"
  },
  "hours": {
    "monday": "8:00 AM - 8:00 PM",
    "tuesday": "8:00 AM - 8:00 PM",
    "wednesday": "8:00 AM - 8:00 PM",
    "thursday": "8:00 AM - 8:00 PM",
    "friday": "8:00 AM - 8:00 PM",
    "saturday": "9:00 AM - 6:00 PM",
    "sunday": "Closed"
  },
  "ctas": ["Schedule Service", "View Inventory", "Get Pre-Approved"],
  "confidence": "low|medium|high"
}`,
    }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(jsonMatch?.[0] ?? "{}"); } catch { /* empty */ }

  // Merge Claude output with deterministic extractions (deterministic wins for logo + phone)
  return NextResponse.json({
    name: parsed.name ?? null,
    phone: phone ?? parsed.phone ?? null,
    address: address ?? parsed.address ?? null,
    hours: parsed.hours ?? null,
    logoUrl: logoUrl ?? null,
    ctas: parsed.ctas ?? [],
    confidence: parsed.confidence ?? "low",
  });
}
