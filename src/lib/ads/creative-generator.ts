/**
 * Dynamic Creative Generator
 *
 * Uses Claude claude-3-5-sonnet-20241022 to generate batches of ad creative variations for
 * Google Ads (RSA) and Meta Ads.  Each call returns multiple thematically-distinct
 * variants that can be A/B tested against each other.
 *
 * Google RSA: 1 variant = up to 15 headlines × 4 descriptions → Google's AI tries
 *   every permutation, so one variant already contains hundreds of combinations.
 *   We generate 2–5 thematically different RSAs (e.g. urgency vs benefit vs social proof).
 *
 * Meta Ads: 1 variant = 1 distinct ad (headline + primaryText + CTA + image).
 *   We generate 5–15 variants for simultaneous testing in the same ad set.
 */

import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";
import { createServiceClient } from "@/lib/supabase/server";
import type { RsaHeadline, RsaDescription } from "./google-ads";

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export type AdPlatform = "google_ads" | "meta_ads";

export interface CreativeContext {
  dealershipId:   string;
  dealershipName: string;
  dealershipCity?: string;
  dealershipState?: string;
  campaignGoal:   string;
  targetAudience?: string;
  /** Vehicles to feature (from aged inventory or playbook). */
  vehicles?: Array<{
    year: number; make: string; model: string;
    trim?: string; color?: string;
    originalMsrp?: number; currentPrice?: number; daysOnLot?: number;
  }>;
  /** Current promotional offers. */
  offers?: Array<{ text: string; expires?: string }>;
  /** Active winning patterns from dm_learning_patterns. */
  winningPatterns?: string[];
  /** Dealership tone/voice (e.g. "professional", "friendly", "urgent"). */
  tone?: string;
  finalUrl: string;
}

// ── Google RSA ───────────────────────────────────────────────

export interface GoogleRsaVariant {
  name:         string;   // e.g. "Urgency + Price Drop"
  hypothesis:   string;   // what creative angle this tests
  headlines:    RsaHeadline[];    // 8–15 items, each ≤30 chars
  descriptions: RsaDescription[]; // 2–4 items, each ≤90 chars
  path1?:       string;   // ≤15 chars
  path2?:       string;   // ≤15 chars
}

export interface GenerateGoogleCreativesOutput {
  platform:  "google_ads";
  context:   CreativeContext;
  variants:  GoogleRsaVariant[];
  rationale: string;
  tokensUsed: number;
}

// ── Meta Ads ─────────────────────────────────────────────────

export type MetaCta =
  | "LEARN_MORE" | "SHOP_NOW" | "CONTACT_US"
  | "GET_QUOTE" | "BOOK_TRAVEL" | "APPLY_NOW" | "GET_OFFER";

export interface MetaAdVariant {
  name:         string;
  hypothesis:   string;
  headline:     string;   // ≤40 chars
  primaryText:  string;   // ≤125 chars
  description?: string;   // ≤30 chars
  callToAction: MetaCta;
  imagePrompt?: string;   // description for AI image generation (future)
}

export interface GenerateMetaCreativesOutput {
  platform:   "meta_ads";
  context:    CreativeContext;
  variants:   MetaAdVariant[];
  rationale:  string;
  tokensUsed: number;
}

export type GenerateCreativesOutput =
  | GenerateGoogleCreativesOutput
  | GenerateMetaCreativesOutput;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Strip to byte-safe ASCII, trim, enforce max chars */
function enforce(text: string, maxChars: number): string {
  return text.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "'").trim().slice(0, maxChars);
}

function safeJsonParse<T>(text: string, fallback: T): T {
  const match = text.match(/\[[\s\S]*?\]|\{[\s\S]*?\}/);
  if (!match) return fallback;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Google RSA creative generator
// ---------------------------------------------------------------------------

const GOOGLE_SYSTEM = `You are an expert automotive digital advertising creative director.
Generate Google Responsive Search Ad (RSA) headline and description sets.

STRICT CHARACTER LIMITS:
- Headlines: max 30 characters each (including spaces). CRITICAL — count carefully.
- Descriptions: max 90 characters each (including spaces).
- path1, path2: max 15 characters each.

RULES:
1. Every headline MUST be ≤30 chars. If unsure, shorten it.
2. Do NOT use exclamation marks in headlines (Google policy).
3. Do NOT use trademark symbols (™ ®) unless it's the dealership's own brand.
4. Each variant must test a DIFFERENT creative angle (urgency / benefit / social proof / scarcity / price).
5. Include at least one headline with the city name for local relevance.
6. Output ONLY valid JSON — no markdown, no explanation outside the JSON.

OUTPUT FORMAT:
{
  "rationale": "one sentence explaining the creative strategy",
  "variants": [
    {
      "name": "Urgency + Price",
      "hypothesis": "Urgency framing drives more clicks than benefit-led copy",
      "headlines": [
        {"text": "Save $4000 This Weekend"},
        {"text": "Price Drop on 2022 F-150"},
        ...8-15 items total
      ],
      "descriptions": [
        {"text": "Finance at 0% APR for 60 months. Visit Austin Ford today.", "pinnedField": "DESCRIPTION_1"},
        {"text": "Award-winning service team. Schedule your test drive online now."}
      ],
      "path1": "New-Trucks",
      "path2": "Deals"
    }
  ]
}`;

export async function generateGoogleCreatives(
  ctx: CreativeContext,
  numVariants = 3
): Promise<GenerateGoogleCreativesOutput> {
  const client = getAnthropicClient();

  const vehicleContext = ctx.vehicles?.length
    ? ctx.vehicles.map((v) =>
        `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}` +
        (v.currentPrice ? ` at $${v.currentPrice.toLocaleString()}` : "") +
        (v.daysOnLot ? ` (${v.daysOnLot} days on lot)` : "")
      ).join(", ")
    : "General new and used vehicle inventory";

  const offerContext = ctx.offers?.length
    ? ctx.offers.map((o) => o.text).join(" | ")
    : "No specific offer — focus on dealership value proposition";

  const patternContext = ctx.winningPatterns?.length
    ? `\nProven patterns from past campaigns:\n${ctx.winningPatterns.slice(0, 4).map((p) => `- ${p}`).join("\n")}`
    : "";

  const prompt = `Generate ${numVariants} Google RSA variants for:

Dealership: ${ctx.dealershipName}${ctx.dealershipCity ? `, ${ctx.dealershipCity}` : ""}${ctx.dealershipState ? `, ${ctx.dealershipState}` : ""}
Campaign goal: ${ctx.campaignGoal}
Target audience: ${ctx.targetAudience ?? "In-market auto buyers"}
Featured vehicles: ${vehicleContext}
Active offers: ${offerContext}
Tone: ${ctx.tone ?? "Professional and trustworthy"}
Final URL: ${ctx.finalUrl}${patternContext}

Each variant must:
1. Test a DIFFERENT creative angle (urgency / benefit / social proof / scarcity / price)
2. Include 10–15 headlines (≤30 chars each — COUNT CAREFULLY)
3. Include 2–4 descriptions (≤90 chars each)
4. Have path1 and path2 (≤15 chars each)

Generate exactly ${numVariants} thematically distinct variants.`;

  const resp = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 2000,
    system: GOOGLE_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = resp.content[0].type === "text" ? resp.content[0].text : "{}";
  const parsed = safeJsonParse<{
    rationale?: string;
    variants?: Array<{
      name?: string;
      hypothesis?: string;
      headlines?: Array<{ text: string; pinnedField?: string }>;
      descriptions?: Array<{ text: string; pinnedField?: string }>;
      path1?: string;
      path2?: string;
    }>;
  }>(raw, { variants: [] });

  const variants: GoogleRsaVariant[] = (parsed.variants ?? []).map((v, i) => ({
    name:       v.name       ?? `Variant ${String.fromCharCode(65 + i)}`,
    hypothesis: v.hypothesis ?? "No hypothesis specified",
    headlines: (v.headlines ?? []).map((h) => ({
      text:       enforce(h.text, 30),
      pinnedField: h.pinnedField as RsaHeadline["pinnedField"] | undefined,
    })).filter((h) => h.text.length > 0).slice(0, 15),
    descriptions: (v.descriptions ?? []).map((d) => ({
      text:        enforce(d.text, 90),
      pinnedField: d.pinnedField as RsaDescription["pinnedField"] | undefined,
    })).filter((d) => d.text.length > 0).slice(0, 4),
    path1: v.path1 ? enforce(v.path1, 15) : undefined,
    path2: v.path2 ? enforce(v.path2, 15) : undefined,
  })).filter((v) => v.headlines.length >= 3 && v.descriptions.length >= 1);

  return {
    platform:   "google_ads",
    context:    ctx,
    variants,
    rationale:  parsed.rationale ?? "Multi-angle RSA creative test",
    tokensUsed: resp.usage.input_tokens + resp.usage.output_tokens,
  };
}

// ---------------------------------------------------------------------------
// Meta Ads creative generator
// ---------------------------------------------------------------------------

const META_SYSTEM = `You are an expert automotive social media advertising creative director.
Generate Meta Ads (Facebook/Instagram) creative variants.

STRICT CHARACTER LIMITS:
- headline:     max 40 characters (including spaces)
- primaryText:  max 125 characters (including spaces)
- description:  max 30 characters (including spaces)

RULES:
1. Each variant must test a DIFFERENT creative angle.
2. primaryText should hook the reader in the first line (before "See More" truncation).
3. Emojis count toward the character limit.
4. callToAction must be one of: LEARN_MORE, SHOP_NOW, CONTACT_US, GET_QUOTE, APPLY_NOW, GET_OFFER
5. Output ONLY valid JSON.

OUTPUT FORMAT:
{
  "rationale": "creative strategy overview",
  "variants": [
    {
      "name": "Emotional – Family Safety",
      "hypothesis": "Emotional family-focused copy outperforms price-led",
      "headline": "The Safest SUV in Austin",
      "primaryText": "Keep your family safe. Top safety ratings + 0% APR this month only.",
      "description": "Limited inventory",
      "callToAction": "GET_QUOTE",
      "imagePrompt": "happy family loading luggage into a silver SUV, sunny suburban street"
    }
  ]
}`;

export async function generateMetaCreatives(
  ctx: CreativeContext,
  numVariants = 6
): Promise<GenerateMetaCreativesOutput> {
  const client = getAnthropicClient();

  const vehicleContext = ctx.vehicles?.length
    ? ctx.vehicles.map((v) =>
        `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}` +
        (v.currentPrice ? ` – $${v.currentPrice.toLocaleString()}` : "") +
        (v.daysOnLot ? ` (${v.daysOnLot} days on lot)` : "")
      ).join("\n  ")
    : "General inventory";

  const offerContext = ctx.offers?.length
    ? ctx.offers.map((o) => o.text).join(" | ")
    : "Focus on dealership value";

  const patternContext = ctx.winningPatterns?.length
    ? `\nProven winning angles:\n${ctx.winningPatterns.slice(0, 3).map((p) => `- ${p}`).join("\n")}`
    : "";

  const prompt = `Generate ${numVariants} Meta Ad creative variants for:

Dealership: ${ctx.dealershipName}${ctx.dealershipCity ? `, ${ctx.dealershipCity}` : ""}
Campaign goal: ${ctx.campaignGoal}
Target audience: ${ctx.targetAudience ?? "Local in-market auto buyers aged 25-55"}
Featured vehicles:
  ${vehicleContext}
Active offers: ${offerContext}
Tone: ${ctx.tone ?? "Friendly and professional"}
Final URL: ${ctx.finalUrl}${patternContext}

Each variant must test a completely DIFFERENT creative angle:
- emotional (family, safety, lifestyle)
- urgency/scarcity (time-limited, inventory running low)
- price/value (savings, financing, total cost)
- social proof (reviews, awards, community trust)
- feature/benefit (specific features, performance)
- service (dealership service quality, convenience)

Generate ${numVariants} variants covering as many angles as possible.`;

  const resp = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 2000,
    system: META_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = resp.content[0].type === "text" ? resp.content[0].text : "{}";
  const parsed = safeJsonParse<{
    rationale?: string;
    variants?: Array<{
      name?: string;
      hypothesis?: string;
      headline?: string;
      primaryText?: string;
      description?: string;
      callToAction?: string;
      imagePrompt?: string;
    }>;
  }>(raw, { variants: [] });

  const VALID_CTAS: MetaCta[] = [
    "LEARN_MORE","SHOP_NOW","CONTACT_US","GET_QUOTE","BOOK_TRAVEL","APPLY_NOW","GET_OFFER",
  ];

  const variants: MetaAdVariant[] = (parsed.variants ?? []).map((v, i) => ({
    name:         v.name         ?? `Variant ${String.fromCharCode(65 + i)}`,
    hypothesis:   v.hypothesis   ?? "No hypothesis",
    headline:     enforce(v.headline    ?? "", 40),
    primaryText:  enforce(v.primaryText ?? "", 125),
    description:  v.description ? enforce(v.description, 30) : undefined,
    callToAction: (VALID_CTAS.includes(v.callToAction as MetaCta)
      ? v.callToAction as MetaCta
      : "LEARN_MORE"),
    imagePrompt:  v.imagePrompt,
  })).filter((v) => v.headline.length > 0 && v.primaryText.length > 0);

  return {
    platform:   "meta_ads",
    context:    ctx,
    variants,
    rationale:  parsed.rationale ?? "Multi-angle Meta creative test",
    tokensUsed: resp.usage.input_tokens + resp.usage.output_tokens,
  };
}

// ---------------------------------------------------------------------------
// Combined generator — auto-routes to the right platform generator
// ---------------------------------------------------------------------------

export async function generateAdCreatives(
  platform: AdPlatform,
  ctx: CreativeContext,
  numVariants?: number
): Promise<GenerateCreativesOutput> {
  if (platform === "google_ads") {
    return generateGoogleCreatives(ctx, numVariants ?? 3);
  }
  return generateMetaCreatives(ctx, numVariants ?? 6);
}

// ---------------------------------------------------------------------------
// Load creative context from dealership data (used by agent and API)
// ---------------------------------------------------------------------------

export async function loadCreativeContext(
  dealershipId: string,
  campaignGoal: string,
  finalUrl: string
): Promise<CreativeContext> {
  const svc = createServiceClient();

  const [dealershipRes, vehiclesRes, patternsRes] = await Promise.all([
    (svc as ReturnType<typeof createServiceClient>)
      .from("dealerships" as never)
      .select("name,address,settings" as never)
      .eq("id" as never, dealershipId as never)
      .single() as unknown as Promise<{
        data: { name: string; address: { city?: string; state?: string } | null; settings: Record<string, unknown> | null } | null
      }>,

    // Aged inventory (60+ days) — best paid ad candidates
    (svc as ReturnType<typeof createServiceClient>)
      .from("inventory" as never)
      .select("year,make,model,trim,color,price,msrp,days_on_lot" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("status" as never, "available" as never)
      .gte("days_on_lot" as never, 30 as never)
      .order("days_on_lot" as never, { ascending: false })
      .limit(5) as unknown as Promise<{
        data: Array<{ year: number; make: string; model: string; trim?: string; color?: string; price?: number; msrp?: number; days_on_lot?: number }> | null
      }>,

    // Recent winning patterns from dm_learning_patterns
    (svc as ReturnType<typeof createServiceClient>)
      .from("dm_learning_patterns" as never)
      .select("title,description" as never)
      .eq("is_active" as never, true as never)
      .or(`dealership_id.eq.${dealershipId},dealership_id.is.null` as never)
      .order("confidence" as never, { ascending: false })
      .limit(4) as unknown as Promise<{
        data: Array<{ title: string; description: string }> | null
      }>,
  ]);

  const dealer  = dealershipRes.data;
  const vehicles = vehiclesRes.data   ?? [];
  const patterns = patternsRes.data   ?? [];

  return {
    dealershipId,
    dealershipName:  dealer?.name ?? "Your Dealership",
    dealershipCity:  dealer?.address?.city,
    dealershipState: dealer?.address?.state,
    campaignGoal,
    finalUrl,
    vehicles: vehicles.map((v) => ({
      year:          v.year,
      make:          v.make,
      model:         v.model,
      trim:          v.trim,
      color:         v.color,
      originalMsrp:  v.msrp,
      currentPrice:  v.price,
      daysOnLot:     v.days_on_lot,
    })),
    winningPatterns: patterns.map((p) => `${p.title}: ${p.description}`),
    tone: (dealer?.settings as Record<string, unknown> | null)?.["dealerTone"] as string | undefined,
  };
}
