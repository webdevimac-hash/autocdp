import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";

// Realistic browser user agents — rotated on retry to bypass soft bot-blocks
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Googlebot/2.1 (+http://www.google.com/bot.html)",
];

// Common contact/location page slugs to try when main page lacks address/hours
const CONTACT_SLUGS = ["/contact-us", "/contact", "/about-us", "/hours", "/locations", "/location"];

function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) return "https://" + url;
  return url;
}

function resolveUrl(base: string, href: string): string {
  try { return new URL(href, base).href; } catch { return href; }
}

// Normalize any US phone number to E.164 (+1xxxxxxxxxx)
function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// Fetch HTML for a URL with a specific user-agent; returns null on error/non-2xx
async function fetchHtml(
  url: string,
  ua: string,
  timeoutMs = 12_000,
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return { html: await res.text(), finalUrl: res.url || url };
  } catch {
    return null;
  }
}

// Try main URL with rotating user agents, then fall back to http://
async function fetchWithFallback(url: string): Promise<{ html: string; finalUrl: string }> {
  for (const ua of USER_AGENTS) {
    const result = await fetchHtml(url, ua);
    if (result?.html) return result;
  }
  // Try http:// variant if all https attempts failed
  if (url.startsWith("https://")) {
    const httpUrl = url.replace("https://", "http://");
    for (const ua of USER_AGENTS.slice(0, 2)) {
      const result = await fetchHtml(httpUrl, ua);
      if (result?.html) return result;
    }
  }
  return { html: "", finalUrl: url };
}

// Try contact / about pages and return first HTML that seems useful
async function tryContactPage(baseUrl: string): Promise<string> {
  const origin = (() => { try { return new URL(baseUrl).origin; } catch { return ""; } })();
  if (!origin) return "";

  for (const slug of CONTACT_SLUGS) {
    const target = origin + slug;
    const result = await fetchHtml(target, USER_AGENTS[0], 8_000);
    if (result?.html && result.html.length > 500) return result.html;
  }
  return "";
}

function getMeta(html: string, name: string): string | null {
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

// Score-based logo extraction — prefers actual logo images over og:image
function extractBestLogo(html: string, baseUrl: string): string | null {
  const candidates: Array<{ url: string; score: number }> = [];

  // og:image — decent signal, +3
  const ogImage = getMeta(html, "og:image");
  if (ogImage && !/placeholder|default|no[_-]?image/i.test(ogImage)) {
    candidates.push({ url: resolveUrl(baseUrl, ogImage), score: 3 });
  }

  // img tags — score by attribute signals
  const imgRe = /<img([^>]{3,800})>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    const attrs = m[1];
    const src = attrs.match(/src=["']([^"']+)["']/i)?.[1];
    if (!src || /^data:|#/.test(src)) continue;
    if (/tracking|pixel|spacer|1x1/i.test(src)) continue;

    let score = 0;
    if (/logo/i.test(src)) score += 6;
    const cls = attrs.match(/class=["']([^"']+)["']/i)?.[1] ?? "";
    const alt = attrs.match(/alt=["']([^"']+)["']/i)?.[1] ?? "";
    const id  = attrs.match(/id=["']([^"']+)["']/i)?.[1]  ?? "";
    if (/logo/i.test(cls)) score += 5;
    if (/logo/i.test(alt)) score += 4;
    if (/logo/i.test(id))  score += 4;
    if (/\.(svg|png)(\?|$)/i.test(src)) score += 2;
    if (/header|navbar|nav|brand/i.test(cls + id)) score += 1;

    if (score > 0) candidates.push({ url: resolveUrl(baseUrl, src), score });
  }

  // apple-touch-icon — reliable brand image
  const atRe = /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i;
  const atM = html.match(atRe);
  if (atM) candidates.push({ url: resolveUrl(baseUrl, atM[1]), score: 2 });

  // link[rel=icon] — last resort
  const iconRe = /<link[^>]+rel=["'][^"']*(?:shortcut )?icon[^"']*["'][^>]+href=["']([^"']+)["']/gi;
  let iconM: RegExpExecArray | null;
  while ((iconM = iconRe.exec(html)) !== null) {
    candidates.push({ url: resolveUrl(baseUrl, iconM[1]), score: 1 });
  }

  if (candidates.length === 0) {
    try { return new URL("/favicon.ico", baseUrl).href; } catch { return null; }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}

function extractPhoneFromHtml(html: string): string | null {
  // tel: href — most reliable
  const telHref = html.match(/href=["']tel:([\d\s()\-+.]{7,20})["']/i)?.[1];
  if (telHref) return telHref.trim();

  // JSON-LD telephone
  const schemaTel = html.match(/"telephone"\s*:\s*"([^"]{7,20})"/i)?.[1];
  if (schemaTel) return schemaTel.trim();

  // Microdata itemprop=telephone
  const microA = html.match(/itemprop=["']telephone["'][^>]*>([^<]{7,25})</i)?.[1];
  if (microA) return microA.trim();
  const microB = html.match(/<[^>]+itemprop=["']telephone["'][^>]*content=["']([^"']{7,25})["']/i)?.[1];
  if (microB) return microB.trim();

  // Visible US phone number in text
  const plain = html.replace(/<[^>]+>/g, " ");
  return plain.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/)?.[0]?.trim() ?? null;
}

function extractAddressFromHtml(html: string): Record<string, string> | null {
  // 1. JSON-LD (handles both single object and array)
  const jsonLdRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jM: RegExpExecArray | null;
  while ((jM = jsonLdRe.exec(html)) !== null) {
    try {
      const raw = JSON.parse(jM[1]);
      const candidates = Array.isArray(raw) ? raw : [raw];
      for (const obj of candidates) {
        const addr = obj?.address ?? obj?.["@graph"]?.[0]?.address;
        if (addr?.streetAddress) {
          return {
            street: (addr.streetAddress ?? "").trim(),
            city: (addr.addressLocality ?? "").trim(),
            state: (addr.addressRegion ?? "").trim(),
            zip: (addr.postalCode ?? "").trim(),
          };
        }
      }
    } catch { /* skip malformed */ }
  }

  // 2. Microdata itemprop attributes
  const street =
    html.match(/itemprop=["']streetAddress["'][^>]*>([^<]{3,100})</i)?.[1]?.trim()
    ?? html.match(/<[^>]+itemprop=["']streetAddress["'][^>]*content=["']([^"']{3,100})["']/i)?.[1]?.trim();
  if (street) {
    return {
      street,
      city: (html.match(/itemprop=["']addressLocality["'][^>]*>([^<]{2,60})</i)?.[1] ?? "").trim(),
      state: (html.match(/itemprop=["']addressRegion["'][^>]*>([^<]{2,30})</i)?.[1] ?? "").trim(),
      zip:   (html.match(/itemprop=["']postalCode["'][^>]*>([^<]{3,10})</i)?.[1] ?? "").trim(),
    };
  }

  return null;
}

function stripHtml(html: string, limit = 6000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, limit);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { url } = body as { url?: string };

  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  const normalized = normalizeUrl(url);
  try { new URL(normalized); } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  // ── 1. Fetch main page ────────────────────────────────────────
  const { html: mainHtml, finalUrl } = await fetchWithFallback(normalized);

  // ── 2. Deterministic extraction from main page ────────────────
  const title = mainHtml.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.trim() ?? null;
  const ogTitle = getMeta(mainHtml, "og:title");
  const ogDescription = getMeta(mainHtml, "og:description") ?? getMeta(mainHtml, "description");
  const ogSiteName = getMeta(mainHtml, "og:site_name");

  let logoUrl = extractBestLogo(mainHtml, finalUrl);
  let rawPhone = extractPhoneFromHtml(mainHtml);
  let address = extractAddressFromHtml(mainHtml);

  // ── 3. Fallback to contact page if address/phone missing ───────
  if (!address || !rawPhone) {
    const contactHtml = await tryContactPage(finalUrl);
    if (contactHtml) {
      if (!address) address = extractAddressFromHtml(contactHtml);
      if (!rawPhone) rawPhone = extractPhoneFromHtml(contactHtml);
    }
  }

  // ── 4. Normalize phone to E.164 ───────────────────────────────
  const phone = rawPhone ? (normalizeE164(rawPhone) ?? rawPhone) : null;

  // ── 5. Ask Claude for structured profile ──────────────────────
  const client = getAnthropicClient();
  const visibleText = mainHtml ? stripHtml(mainHtml) : "";

  const pageContext = [
    title       ? `Page title: ${title}` : null,
    ogTitle     ? `og:title: ${ogTitle}` : null,
    ogSiteName  ? `og:site_name: ${ogSiteName}` : null,
    ogDescription ? `og:description: ${ogDescription}` : null,
    phone       ? `Detected phone (E.164): ${phone}` : null,
    address     ? `Detected address: ${JSON.stringify(address)}` : null,
    visibleText ? `\nVisible page text (first 6000 chars):\n${visibleText}` : null,
  ].filter(Boolean).join("\n");

  const response = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 900,
    messages: [{
      role: "user",
      content: `You are extracting dealership profile data from a car dealer website.
URL: ${finalUrl}

${pageContext || "No HTML could be fetched — infer from URL/domain only."}

Extract the following. Return ONLY valid JSON with no markdown fences. Use null for any field you cannot determine confidently.

Rules:
- "name": Full dealership name including brand (e.g. "Toyota of Tampa Bay", not just "Toyota")
- "phone": If not already E.164, convert to E.164 format: +1XXXXXXXXXX for US numbers. Use null if not found.
- "address": Extract street/city/state/zip. Use null for the whole object if address is unclear.
- "hours": Parse any hours format to "H:MM AM - H:MM PM" per day. Use "Closed" for closed days. Use null if no hours found.
- "confidence": overall confidence: "high" if name+phone+address all found, "medium" if 2 of 3, "low" if 0-1.

{
  "name": "Full Dealership Name",
  "phone": "+1XXXXXXXXXX or null",
  "address": { "street": "", "city": "", "state": "XX", "zip": "" },
  "hours": {
    "monday": "9:00 AM - 8:00 PM",
    "tuesday": "9:00 AM - 8:00 PM",
    "wednesday": "9:00 AM - 8:00 PM",
    "thursday": "9:00 AM - 8:00 PM",
    "friday": "9:00 AM - 8:00 PM",
    "saturday": "9:00 AM - 6:00 PM",
    "sunday": "Closed"
  },
  "confidence": "high|medium|low"
}`,
    }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(jsonMatch?.[0] ?? "{}"); } catch { /* use empty */ }

  // Deterministic extractions win over Claude for phone and address
  const finalPhone = phone ?? (parsed.phone as string | null) ?? null;
  const finalAddress = address ?? (parsed.address as Record<string, string> | null) ?? null;
  const finalName = (parsed.name as string | null) ?? null;
  const finalHours = (parsed.hours as Record<string, string> | null) ?? null;

  // Build fieldsFound list for UI highlighting
  const fieldsFound: string[] = [];
  if (finalName) fieldsFound.push("name");
  if (finalPhone) fieldsFound.push("phone");
  if (logoUrl) fieldsFound.push("logoUrl");
  if (finalAddress?.street) fieldsFound.push("address");
  if (finalHours) fieldsFound.push("hours");

  const confidence = (parsed.confidence as string) ??
    (fieldsFound.length >= 4 ? "high" : fieldsFound.length >= 2 ? "medium" : "low");

  return NextResponse.json({
    name: finalName,
    phone: finalPhone,
    address: finalAddress,
    hours: finalHours,
    logoUrl,
    confidence,
    fieldsFound,
  });
}
