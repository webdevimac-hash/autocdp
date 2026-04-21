/**
 * Creative Agent — Generates personalized message content per customer.
 *
 * Pipeline:
 *   1. Fetch relevant global_learnings (vehicle-specific first, then general)
 *   2. Fetch inventory matched to customer's visit context (make → year → fallback)
 *   3. Generate copy via Claude Sonnet
 *   4. Run guardrails (regex + Haiku rewrite) — blocked copy throws, rewrites are logged
 */

import { getAnthropicClient, MODELS } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { applyGuardrails } from "../guardrails";
import type { AgentContext, Customer, Visit, PersonalizedMessage, CommunicationChannel } from "@/types";

export interface CreativeAgentInput {
  context: AgentContext;
  customer: Customer;
  recentVisit: Visit | null;
  channel: CommunicationChannel;
  campaignGoal: string;
  template?: string;
  dealershipTone?: string;
}

export interface CreativeAgentOutput extends PersonalizedMessage {
  tokensUsed: number;
  guardrailsApplied: boolean;
  guardrailViolations: string[];
}

// Extract model token from visit (e.g. year=2019, make="Ford", model="F-150" → "F-150")
function extractVehicleSegment(visit: Visit | null): string | null {
  return visit?.model?.trim() ?? null;
}

// ── Inventory helpers ──────────────────────────────────────────

interface InventoryRow {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  condition: string | null;
  price: number | null;
  days_on_lot: number;
}

type InventoryContext =
  | { type: "upgrade";  vehicles: InventoryRow[] }   // same make, newer/similar year
  | { type: "similar";  vehicles: InventoryRow[] }   // same make, any year
  | { type: "aged";     vehicles: InventoryRow[] }   // any available, aged units
  | { type: "none" };

async function fetchInventoryContext(
  supabase: ReturnType<typeof createServiceClient>,
  dealershipId: string,
  recentVisit: Visit | null
): Promise<InventoryContext> {
  const visitMake = recentVisit?.make?.trim() ?? null;
  const visitYear = recentVisit?.year ?? null;

  const selectFields = "year, make, model, trim, condition, price, days_on_lot";
  type InvResult = Promise<{ data: InventoryRow[] | null }>;

  // Strategy 1: same make + year within ±3 years → upgrade opportunity
  if (visitMake && visitYear) {
    const { data } = await (supabase
      .from("inventory")
      .select(selectFields)
      .eq("dealership_id", dealershipId)
      .eq("status", "available")
      .ilike("make", visitMake)
      .gte("year", visitYear - 1)
      .order("year", { ascending: false })
      .order("days_on_lot", { ascending: false })
      .limit(3) as unknown as InvResult);

    if (data && data.length > 0) return { type: "upgrade", vehicles: data };
  }

  // Strategy 2: same make, any year
  if (visitMake) {
    const { data } = await (supabase
      .from("inventory")
      .select(selectFields)
      .eq("dealership_id", dealershipId)
      .eq("status", "available")
      .ilike("make", visitMake)
      .order("days_on_lot", { ascending: false })
      .limit(3) as unknown as InvResult);

    if (data && data.length > 0) return { type: "similar", vehicles: data };
  }

  // Fallback: aged units (60+ days on lot) from any make
  const { data } = await (supabase
    .from("inventory")
    .select(selectFields)
    .eq("dealership_id", dealershipId)
    .eq("status", "available")
    .gte("days_on_lot", 60)
    .order("days_on_lot", { ascending: false })
    .limit(2) as unknown as InvResult);

  if (data && data.length > 0) return { type: "aged", vehicles: data };

  return { type: "none" };
}

function formatInventorySection(ctx: InventoryContext): string {
  if (ctx.type === "none") return "";

  const headers: Record<Exclude<InventoryContext["type"], "none">, string> = {
    upgrade: "UPGRADE OPPORTUNITY — same-make vehicles in stock (prioritize if customer may be ready for new):",
    similar: "SIMILAR VEHICLES IN STOCK — same make as customer's service vehicle:",
    aged:    "AGED INVENTORY — motivated to move (60+ days on lot):",
  };

  const lines = (ctx as { vehicles: InventoryRow[] }).vehicles.map((v) => {
    const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
    const price = v.price ? `$${Number(v.price).toLocaleString()}` : "call for price";
    const age = v.days_on_lot >= 60 ? ` — ${v.days_on_lot}d on lot, motivated to move` : "";
    return `  • ${(v.condition ?? "used").toUpperCase()} ${name} — ${price}${age}`;
  });

  return `\n${headers[ctx.type as Exclude<InventoryContext["type"], "none">]}\n${lines.join("\n")}\n`;
}

// ── Main function ──────────────────────────────────────────────

export async function runCreativeAgent(
  input: CreativeAgentInput
): Promise<CreativeAgentOutput> {
  const supabase = createServiceClient();
  const client = getAnthropicClient();

  // ── 1. Global learnings ────────────────────────────────────
  let patternLines: string[] = [];

  try {
    const vehicleSegment = extractVehicleSegment(input.recentVisit);

    type LearningRow = { description: string; confidence: number; pattern_type: string; vehicle_segment: string | null };

    if (vehicleSegment) {
      const [vehicleRes, generalRes] = await Promise.all([
        supabase
          .from("global_learnings")
          .select("description, confidence, pattern_type, vehicle_segment")
          .eq("vehicle_segment", vehicleSegment)
          .gte("confidence", 0.5)
          .order("confidence", { ascending: false })
          .limit(3) as unknown as Promise<{ data: LearningRow[] | null }>,
        supabase
          .from("global_learnings")
          .select("description, confidence, pattern_type, vehicle_segment")
          .gte("confidence", 0.55)
          .order("confidence", { ascending: false })
          .limit(6) as unknown as Promise<{ data: LearningRow[] | null }>,
      ]);

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
      const { data } = await (supabase
        .from("global_learnings")
        .select("description, confidence, pattern_type, vehicle_segment")
        .gte("confidence", 0.55)
        .order("confidence", { ascending: false })
        .limit(5) as unknown as Promise<{ data: LearningRow[] | null }>);

      patternLines = (data ?? []).map(
        (g) =>
          `• [${g.pattern_type}] ${g.description}` +
          ` (confidence: ${(g.confidence * 100).toFixed(0)}%)`
      );
    }
  } catch {
    // Non-fatal — proceed without network learnings
  }

  // ── 2. Inventory context ───────────────────────────────────
  let inventorySection = "";
  try {
    const invCtx = await fetchInventoryContext(
      supabase,
      input.context.dealershipId,
      input.recentVisit
    );
    inventorySection = formatInventorySection(invCtx);
  } catch {
    // Non-fatal
  }

  // ── 3. Build prompts ───────────────────────────────────────
  const visitContext = input.recentVisit
    ? `Last visit: ${input.recentVisit.visit_date?.slice(0, 10)} | ` +
      `Service: ${input.recentVisit.service_type || "general"} | ` +
      `Vehicle: ${[input.recentVisit.year, input.recentVisit.make, input.recentVisit.model].filter(Boolean).join(" ") || "unknown"} | ` +
      `Mileage: ${input.recentVisit.mileage?.toLocaleString() || "unknown"} | ` +
      `Notes: ${input.recentVisit.service_notes || "none"}`
    : "No previous visit on record.";

  const channelGuide = {
    sms:         "SMS (max 160 chars, no HTML, conversational, include opt-out hint)",
    email:       "Email (can be multi-paragraph, include subject line, warm but direct)",
    direct_mail: "Handwritten note (50–80 words, personal, signed by service advisor, mentions specific car or service)",
  }[input.channel];

  const learningsSection =
    patternLines.length > 0
      ? `\nNETWORK LEARNINGS — patterns proven to drive higher response rates across dealerships.\n` +
        `Apply the most relevant ones naturally:\n${patternLines.join("\n")}\n`
      : "";

  const systemPrompt =
    `You are the Creative Agent for AutoCDP. You write hyper-personalized outreach ` +
    `messages for auto dealership customers. Your copy feels human, warm, and specific — never generic.\n\n` +
    `Tone: ${input.dealershipTone || "friendly and professional"}\n` +
    `Dealership: ${input.context.dealershipName}\n` +
    `${learningsSection}${inventorySection}\n` +
    `Rules:\n` +
    `- Reference specific details from the customer's visit history when available\n` +
    `- When network learnings apply to this customer's vehicle or segment, weave them in naturally\n` +
    `- Never be pushy or sales-heavy in the opening\n` +
    `- For direct mail: write as if hand-penned by a service advisor\n` +
    `- Use the customer's first name\n` +
    `- End with a clear but soft call-to-action`;

  const userPrompt =
    `Write a personalized ${channelGuide} message.\n\n` +
    `CUSTOMER: ${input.customer.first_name} ${input.customer.last_name}\n` +
    `LIFECYCLE: ${input.customer.lifecycle_stage} | VISITS: ${input.customer.total_visits} | SPEND: $${input.customer.total_spend.toFixed(0)}\n` +
    `${visitContext}\n\n` +
    `CAMPAIGN GOAL: ${input.campaignGoal}\n` +
    (input.template ? `BASE TEMPLATE:\n${input.template}\n` : "") +
    `\nRespond with JSON:\n` +
    `{\n` +
    `  "subject": "email subject line (null for sms/mail)",\n` +
    `  "content": "the full message text",\n` +
    `  "reasoning": "why this angle — mention which network learnings you applied if any",\n` +
    `  "confidence": 0.85\n` +
    `}`;

  // ── 4. Generate copy ───────────────────────────────────────
  const response = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response from Creative Agent");

  const jsonMatch = block.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Creative Agent did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]);

  // ── 5. Guardrails ──────────────────────────────────────────
  const guardrail = await applyGuardrails(
    parsed.content ?? "",
    parsed.subject ?? null,
    input.channel
  );

  if (!guardrail.passed) {
    throw new Error(
      `Creative Agent output blocked by guardrails: ${guardrail.violations.join(", ")}`
    );
  }

  return {
    customerId: input.customer.id,
    channel: input.channel,
    subject: guardrail.subject ?? undefined,
    content: guardrail.content,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    guardrailsApplied: guardrail.rewritten,
    guardrailViolations: guardrail.violations,
  };
}
