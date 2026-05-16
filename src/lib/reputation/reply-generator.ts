/**
 * AI-powered reply / content generator for Google Business Profile.
 *
 * Uses Claude claude-3-5-sonnet-20241022 (standard) for review replies and Q&A answers.
 * Uses Claude Haiku for short post summaries to save tokens.
 *
 * All outputs are constrained by GBP limits:
 *   - Review reply:  ≤4096 chars (we target 150–250 words — professional, not canned)
 *   - Post summary:  ≤1500 chars
 *   - Q&A answer:    ≤1000 chars
 */

import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";
import type { GbpReview } from "./gbp-client";

// ---------------------------------------------------------------------------
// Context passed from the calling code
// ---------------------------------------------------------------------------

export interface ReputationContext {
  dealershipName:  string;
  dealershipCity?: string;
  dealershipState?: string;
  /** General manager / owner name for sign-offs, if available. */
  gmName?:         string;
  /** Brand / make the dealership sells. */
  makes?:          string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeJsonParse<T>(text: string, fallback: T): T {
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]) as T; }
  catch { return fallback; }
}

function starLabel(rating: string): string {
  return { ONE: "1-star", TWO: "2-star", THREE: "3-star", FOUR: "4-star", FIVE: "5-star" }[rating] ?? rating;
}

// ---------------------------------------------------------------------------
// Review reply
// ---------------------------------------------------------------------------

const REPLY_SYSTEM = `You are the online reputation manager for an automotive dealership.
Write professional, warm, and personalised Google review replies on behalf of the dealership.

RULES:
1. Thank the reviewer by first name if available (parse from displayName — use first name only).
2. Reference specific details from the review (mention the salesperson, service, or vehicle they named).
3. For 4–5 star reviews: warm gratitude, invite them back or to refer friends.
4. For 1–3 star reviews: empathetic acknowledgment, sincere apology, offer to resolve offline (provide phone/email placeholder).
5. NEVER be defensive, make excuses, or argue.
6. Sign off with the GM name if provided, or "The [Dealership Name] Team".
7. Length: 120–220 words. Conversational, not corporate.
8. Do NOT include placeholders like [phone number] — use realistic stand-ins like "our customer care line at your earliest convenience".
9. Output ONLY the reply text — no JSON, no labels, no markdown.`;

export async function generateReviewReply(
  review: GbpReview,
  ctx: ReputationContext
): Promise<string> {
  const client = getAnthropicClient();

  const ratingLabel = starLabel(review.starRating);
  const reviewerFirst = review.reviewer.displayName?.split(" ")[0] ?? "there";

  const prompt = `Dealership: ${ctx.dealershipName}${ctx.dealershipCity ? `, ${ctx.dealershipCity}` : ""}${ctx.dealershipState ? `, ${ctx.dealershipState}` : ""}
${ctx.gmName ? `GM / Sign-off name: ${ctx.gmName}` : ""}
${ctx.makes?.length ? `Brands sold: ${ctx.makes.join(", ")}` : ""}

Review:
- Reviewer: ${review.reviewer.displayName ?? "Anonymous"}
- Rating: ${ratingLabel} (${review.starRating})
- Comment: ${review.comment ?? "(no written comment — just a star rating)"}

Write a reply to this review.`;

  const resp = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 500,
    system: REPLY_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.content[0].type === "text" ? resp.content[0].text.trim() : "";
  // Sanity: ensure the reply references the reviewer
  return text || `Thank you, ${reviewerFirst}, for taking the time to share your experience at ${ctx.dealershipName}. We appreciate your feedback and look forward to serving you again soon. — ${ctx.gmName ?? `The ${ctx.dealershipName} Team`}`;
}

// ---------------------------------------------------------------------------
// Business post generation
// ---------------------------------------------------------------------------

export interface GeneratedPost {
  topicType:          "STANDARD" | "EVENT" | "OFFER" | "ALERT";
  summary:            string;
  callToActionType?:  "LEARN_MORE" | "SHOP_NOW" | "BOOK" | "CALL";
  callToActionUrl?:   string;
  eventTitle?:        string;
  eventStartDate?:    string;  // ISO date YYYY-MM-DD
  eventEndDate?:      string;
}

const POST_SYSTEM = `You are a Google Business Profile marketing specialist for an automotive dealership.
Generate a Google Business Profile post (update) based on the given prompt.

RULES:
1. summary: max 1400 characters. Engaging, relevant, actionable. Include relevant emojis sparingly.
2. Choose topicType: STANDARD (general update), OFFER (promotion/discount), EVENT (sale event), or ALERT (urgent notice).
3. For OFFER: highlight specific savings, financing, or inventory deals.
4. For EVENT: include event title, start/end dates (within the next 30 days unless user specifies).
5. Always end with a clear call to action.
6. callToActionType: LEARN_MORE, SHOP_NOW, BOOK, or CALL.
7. Output ONLY valid JSON matching the schema — no markdown, no extra fields.

OUTPUT SCHEMA:
{
  "topicType": "STANDARD",
  "summary": "...",
  "callToActionType": "LEARN_MORE",
  "callToActionUrl": "",
  "eventTitle": null,
  "eventStartDate": null,
  "eventEndDate": null
}`;

export async function generateGbpPost(
  prompt: string,
  ctx: ReputationContext,
  finalUrl: string
): Promise<GeneratedPost> {
  const client = getAnthropicClient();

  const userPrompt = `Dealership: ${ctx.dealershipName}${ctx.dealershipCity ? `, ${ctx.dealershipCity}` : ""}
${ctx.makes?.length ? `Brands: ${ctx.makes.join(", ")}` : ""}
Website: ${finalUrl}
Today's date: ${new Date().toISOString().slice(0, 10)}

Post request: ${prompt}

Generate a Google Business Profile post.`;

  const resp = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 600,
    system: POST_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = resp.content[0].type === "text" ? resp.content[0].text : "{}";
  const parsed = safeJsonParse<{
    topicType?: string;
    summary?: string;
    callToActionType?: string;
    callToActionUrl?: string;
    eventTitle?: string | null;
    eventStartDate?: string | null;
    eventEndDate?: string | null;
  }>(raw, {});

  const VALID_TYPES  = ["STANDARD", "EVENT", "OFFER", "ALERT"] as const;
  const VALID_CTAS   = ["LEARN_MORE", "SHOP_NOW", "BOOK", "CALL"] as const;

  return {
    topicType:         (VALID_TYPES.includes(parsed.topicType as never) ? parsed.topicType : "STANDARD") as GeneratedPost["topicType"],
    summary:           (parsed.summary ?? "").slice(0, 1400) || `Visit ${ctx.dealershipName} today for the best deals on your next vehicle!`,
    callToActionType:  (VALID_CTAS.includes(parsed.callToActionType as never) ? parsed.callToActionType : "LEARN_MORE") as GeneratedPost["callToActionType"],
    callToActionUrl:   parsed.callToActionUrl || finalUrl,
    eventTitle:        parsed.eventTitle ?? undefined,
    eventStartDate:    parsed.eventStartDate ?? undefined,
    eventEndDate:      parsed.eventEndDate ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Q&A answer generation
// ---------------------------------------------------------------------------

const QA_SYSTEM = `You are the helpful online assistant for an automotive dealership.
Answer customer questions posted on Google Business Profile.

RULES:
1. Be helpful, accurate, and concise (80–150 words).
2. If the answer requires specifics you don't know (e.g. exact inventory), say to contact the dealership directly.
3. Always include the dealership name.
4. NEVER make up prices, APR, or specific vehicle details.
5. End with an invitation to call, visit, or check the website.
6. Output ONLY the answer text — no JSON, no labels.`;

export async function generateQaAnswer(
  question: string,
  ctx: ReputationContext,
  websiteUrl?: string
): Promise<string> {
  const client = getAnthropicClient();

  const prompt = `Dealership: ${ctx.dealershipName}${ctx.dealershipCity ? `, ${ctx.dealershipCity}` : ""}
${ctx.makes?.length ? `Brands sold: ${ctx.makes.join(", ")}` : ""}
${websiteUrl ? `Website: ${websiteUrl}` : ""}

Customer question: "${question}"

Write a helpful, accurate reply.`;

  const resp = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 350,
    system: QA_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.content[0].type === "text" ? resp.content[0].text.trim() : "";
  return text || `Great question! Please reach out to us at ${ctx.dealershipName} directly and our team will be happy to help. Visit our website or give us a call during business hours.`;
}
