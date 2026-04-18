/**
 * Creative Agent — Generates personalized message content per customer.
 * Responsibilities: message writing, subject lines, handwritten note copy.
 *
 * Now queries global_learnings before generating copy so network-wide patterns
 * (e.g. "F-150 owners respond 3× better to oil-change offers with % discount")
 * inform personalization decisions for every campaign.
 */
import { getAnthropicClient, MODELS } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import type { AgentContext, Customer, Visit, PersonalizedMessage, CommunicationChannel } from "@/types";

export interface CreativeAgentInput {
  context: AgentContext;
  customer: Customer;
  recentVisit: Visit | null;
  channel: CommunicationChannel;
  campaignGoal: string;
  template?: string;            // optional base template to riff on
  dealershipTone?: string;      // "friendly", "professional", "luxury"
}

// Extract just the model token from a visit's vehicle data
// e.g. year=2019, make="Ford", model="F-150" → "F-150"
function extractVehicleSegment(visit: Visit | null): string | null {
  return visit?.model?.trim() ?? null;
}

export async function runCreativeAgent(
  input: CreativeAgentInput
): Promise<PersonalizedMessage & { tokensUsed: number }> {
  const supabase = createServiceClient();
  const client = getAnthropicClient();

  // ── 1. Fetch relevant global learnings ────────────────────
  // Pull patterns that match this customer's vehicle model first,
  // then pad with the highest-confidence general patterns.
  let patternLines: string[] = [];

  try {
    const vehicleSegment = extractVehicleSegment(input.recentVisit);

    if (vehicleSegment) {
      // Parallel fetch: vehicle-specific + general patterns
      const [vehicleRes, generalRes] = await Promise.all([
        supabase
          .from("global_learnings")
          .select("description, confidence, pattern_type, vehicle_segment")
          .eq("vehicle_segment", vehicleSegment)
          .gte("confidence", 0.5)
          .order("confidence", { ascending: false })
          .limit(3),
        supabase
          .from("global_learnings")
          .select("description, confidence, pattern_type, vehicle_segment")
          .gte("confidence", 0.55)
          .order("confidence", { ascending: false })
          .limit(6),
      ]);

      // Vehicle-specific first, then general — deduplicate by description
      const vehiclePatterns = vehicleRes.data ?? [];
      const generalPatterns = (generalRes.data ?? []).filter(
        (g) => !vehiclePatterns.some((v) => v.description === g.description)
      );

      patternLines = [...vehiclePatterns, ...generalPatterns]
        .slice(0, 5)
        .map(
          (g) =>
            `• [${g.pattern_type}] ${g.description}` +
            ` (confidence: ${(g.confidence * 100).toFixed(0)}%` +
            (g.vehicle_segment ? `, ${g.vehicle_segment}` : "") +
            `)`
        );
    } else {
      const { data } = await supabase
        .from("global_learnings")
        .select("description, confidence, pattern_type, vehicle_segment")
        .gte("confidence", 0.55)
        .order("confidence", { ascending: false })
        .limit(5);

      patternLines = (data ?? []).map(
        (g) =>
          `• [${g.pattern_type}] ${g.description}` +
          ` (confidence: ${(g.confidence * 100).toFixed(0)}%)`
      );
    }
  } catch {
    // Non-fatal — proceed without network learnings if query fails
    patternLines = [];
  }

  // ── 2. Fetch relevant inventory (non-fatal) ──────────────
  let inventoryContext = "";
  try {
    const vehicleModel = extractVehicleSegment(input.recentVisit);
    const { data: inv } = await supabase
      .from("inventory")
      .select("year, make, model, trim, condition, price, days_on_lot")
      .eq("dealership_id", input.context.dealershipId)
      .eq("status", "available")
      .order("days_on_lot", { ascending: false })
      .limit(vehicleModel ? 3 : 2);

    if (inv && inv.length > 0) {
      const lines = inv.map((v) => {
        const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
        const price = v.price ? `$${Number(v.price).toLocaleString()}` : "call for price";
        const age = v.days_on_lot >= 60 ? ` — ${v.days_on_lot}d on lot, motivated to move` : "";
        return `• ${v.condition?.toUpperCase()} ${name} — ${price}${age}`;
      });
      inventoryContext = `\nIN-STOCK INVENTORY (use if relevant — e.g. upgrade opportunity or aged unit):\n${lines.join("\n")}\n`;
    }
  } catch {
    // Non-fatal
  }

  // ── 3. Build prompts ──────────────────────────────────────
  const visitContext = input.recentVisit
    ? `Last visit: ${input.recentVisit.visit_date?.slice(0, 10)} | Service: ${input.recentVisit.service_type || "general"} | Vehicle: ${[input.recentVisit.year, input.recentVisit.make, input.recentVisit.model].filter(Boolean).join(" ") || "unknown"} | Mileage: ${input.recentVisit.mileage?.toLocaleString() || "unknown"} | Notes: ${input.recentVisit.service_notes || "none"}`
    : "No previous visit on record.";

  const channelGuide = {
    sms: "SMS (max 160 chars, no HTML, conversational, include opt-out hint)",
    email: "Email (can be multi-paragraph, include subject line, warm but direct)",
    direct_mail: "Handwritten note (50–80 words, personal, signed by service advisor, mentions specific car or service)",
  }[input.channel];

  const learningsSection =
    patternLines.length > 0
      ? `\nNETWORK LEARNINGS — patterns proven to drive higher response rates across dealerships.\nApply the most relevant ones to this customer's copy:\n${patternLines.join("\n")}\n`
      : "";

  const systemPrompt = `You are the Creative Agent for AutoCDP. You write hyper-personalized outreach
messages for auto dealership customers. Your copy feels human, warm, and specific — never generic.

Tone: ${input.dealershipTone || "friendly and professional"}
Dealership: ${input.context.dealershipName}
${learningsSection}${inventoryContext}
Rules:
- Reference specific details from the customer's visit history when available
- When network learnings apply to this customer's vehicle or segment, weave them in naturally
- Never be pushy or sales-heavy in the opening
- For direct mail: write as if hand-penned by a service advisor
- Use the customer's first name
- End with a clear but soft call-to-action`;

  const userPrompt = `Write a personalized ${channelGuide} message.

CUSTOMER: ${input.customer.first_name} ${input.customer.last_name}
LIFECYCLE: ${input.customer.lifecycle_stage} | VISITS: ${input.customer.total_visits} | SPEND: $${input.customer.total_spend.toFixed(0)}
${visitContext}

CAMPAIGN GOAL: ${input.campaignGoal}
${input.template ? `BASE TEMPLATE:\n${input.template}` : ""}

Respond with JSON:
{
  "subject": "email subject line (null for sms/mail)",
  "content": "the full message text",
  "reasoning": "why this angle — mention which network learnings you applied if any",
  "confidence": 0.85
}`;

  // ── 3. Generate copy ──────────────────────────────────────
  const response = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Creative Agent");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Creative Agent did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    customerId: input.customer.id,
    channel: input.channel,
    subject: parsed.subject,
    content: parsed.content,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}
