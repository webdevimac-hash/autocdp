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
import { appendDisclaimer } from "@/lib/compliance/disclaimers";
import type { AgentContext, Customer, Visit, PersonalizedMessage, CommunicationChannel, InventoryVehicle, DesignStyle, LayoutSpec } from "@/types";

export interface DealershipProfile {
  phone?: string | null;
  address?: { street?: string; city?: string; state?: string; zip?: string } | null;
  hours?: Record<string, string> | null;
  logo_url?: string | null;
  website_url?: string | null;
  /** X-Time online scheduler URL — injected into CTA when includeBookNow is true. */
  xtimeUrl?: string | null;
}

export interface CreativeAgentInput {
  context: AgentContext;
  customer: Customer;
  recentVisit: Visit | null;
  channel: CommunicationChannel;
  campaignGoal: string;
  template?: string;
  dealershipTone?: string;
  dealershipProfile?: DealershipProfile;
  /** Aged inventory campaign: skip inventory lookup and use this exact vehicle. */
  assignedVehicle?: InventoryVehicle;
  /** When true, instruct Claude to include the X-Time "Book Now" link in the CTA. */
  includeBookNow?: boolean;
  /** When true, append TCPA/CAN-SPAM disclaimer to final content. Default: true. */
  includeDisclaimer?: boolean;
  /** Pre-loaded baseline examples — injected as style guidelines in the system prompt. */
  baselineExamples?: Array<{ example_text: string; mail_type?: string | null; notes?: string | null }>;
  /** Dealer guidance memories formatted string — soft suggestions from the team. */
  dealerMemories?: string;
  /** Design style — controls whether Claude outputs a structured layoutSpec in addition to copy. */
  designStyle?: DesignStyle;
  /** Image URLs the dealer has provided for use in the layout (for advanced styles). */
  designImages?: string[];
  /** Co-op agent context — compliance rules, required disclaimers, copy guidelines from manufacturer program. */
  coopGuidance?: string;
  /** Pre-formatted dealership insights from formatInsightsForPrompt() — use naturally, not verbatim. */
  dealershipInsights?: string;
  /**
   * Customer's credit tier from 700Credit (excellent/good/fair/poor/unknown).
   * Used to tailor offer framing — do NOT mention the tier to the customer.
   * FCRA-safe: we personalize the offer type, not the score.
   */
  customerCreditTier?: string;
}

export interface CreativeAgentOutput extends PersonalizedMessage {
  tokensUsed: number;
  guardrailsApplied: boolean;
  guardrailViolations: string[];
  layoutSpec?: LayoutSpec;
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
    upgrade:
      "UPGRADE OPPORTUNITY — same-make vehicles in stock. If the campaign goal supports it, weave in a natural mention " +
      "of an available upgrade tied to their current vehicle. Don't force it if the goal is service-only.",
    similar:
      "SIMILAR VEHICLES IN STOCK — same make as customer's serviced vehicle. Reference only if it fits the message naturally.",
    aged:
      "AGED INVENTORY to mention. Reference the specific vehicle naturally. " +
      "Do NOT reveal lot duration or use phrases like 'motivated to move' in customer-facing copy.",
  };

  const lines = (ctx as { vehicles: InventoryRow[] }).vehicles.map((v) => {
    const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
    const price = v.price ? `$${Number(v.price).toLocaleString()}` : "call for price";
    const age = v.days_on_lot >= 60 ? ` [internal: ${v.days_on_lot}d on lot]` : "";
    return `  • ${(v.condition ?? "used").toUpperCase()} ${name} — ${price}${age}`;
  });

  return `\nINVENTORY CONTEXT — ${headers[ctx.type as Exclude<InventoryContext["type"], "none">]}\n${lines.join("\n")}\n`;
}

// ── Copy post-processing ───────────────────────────────────────

function postProcessMailCopy(text: string, channel: string): string {
  if (channel !== "direct_mail") return text;

  return text
    // Fix literal \n strings that weren't decoded (JSON parse edge cases)
    .replace(/\\n/g, "\n")
    // Ensure space after sentence-ending punctuation when immediately followed by a letter
    .replace(/([.!?,;:])([A-Za-z])/g, "$1 $2")
    // Fix common concatenation: lowercase letter directly touching uppercase mid-sentence
    .replace(/([a-z])([A-Z][a-z])/g, (_, a, b) => `${a} ${b}`)
    // Collapse 3+ consecutive newlines to exactly 2
    .replace(/\n{3,}/g, "\n\n")
    // Trim trailing whitespace from each line
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    // Ensure at least one blank line before the sign-off
    .replace(/\n(Warmly|Best|Sincerely|Thanks|Cheers|With appreciation|Take care|See you soon),/g, "\n\n$1,")
    // ── Banned-phrase rewrites ─────────────────────────────────
    // Generic openers / AI tells
    .replace(/I hope (this|the) (message|note|letter|card|postcard) finds you (well|great|in good health)[.,!]?\s*/gi, "")
    .replace(/I (wanted|am writing|am reaching out) to (reach out|let you know|inform you|follow up)[^.!?]*[.!?]\s*/gi, "")
    // "Pleasure of meeting" family
    .replace(/haven'?t had the pleasure of meeting( yet)?\.?\s*/gi, "haven't crossed paths yet. ")
    .replace(/(it'?s been )?a pleasure( of meeting| to meet| meeting you)?\.?\s*/gi, "")
    .replace(/I'?d love to change that\.?\s*/gi, "")
    // "No strings" family — sounds discount-lot, not premium
    .replace(/no strings([ ,]+(attached|just|—|and)[^.!?]*)?[.!?]?\s*/gi, "")
    // Salesy "love to" openers
    .replace(/I'?d love to (earn|show|demonstrate|prove|win)[^.!?]*[.!?]\s*/gi, "")
    // Passive-voice corporate filler
    .replace(/Don'?t hesitate to (contact|call|reach out to) us[.,!]?\s*/gi, "Give us a call anytime. ")
    .replace(/Feel free to (contact|call|reach out to|stop by)[^.!?]*[.!?]\s*/gi, "")
    .replace(/As (a )?valued (customer|guest|client)[,.]?\s*/gi, "")
    .replace(/We (wanted to|are pleased to|would like to) (let you know|inform you|reach out)[^.!?]*[.!?]\s*/gi, "")
    // "Take advantage of" — sounds manipulative
    .replace(/take advantage of/gi, "take us up on")
    // Fix any double-spaces introduced by the above replacements
    .replace(/ {2,}/g, " ")
    .trim();
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
    if (input.assignedVehicle) {
      // Aged inventory campaign: reference the exact matched vehicle
      const v = input.assignedVehicle;
      const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
      const price = v.price ? `$${Number(v.price).toLocaleString()}` : "call for price";
      const color = v.color ? ` | Color: ${v.color}` : "";
      const mileage = v.mileage ? ` | ${v.mileage.toLocaleString()} miles` : "";
      const condition = v.condition ? `${v.condition.toUpperCase()} ` : "";
      inventorySection =
        `\nASSIGNED AGED VEHICLE — CRITICAL: You MUST reference this specific vehicle in your message:\n` +
        `  ${condition}${name}${color}${mileage}\n` +
        `  Price: ${price} | Days on lot: ${v.days_on_lot} (motivated to move)\n` +
        `  This vehicle was matched to the customer based on their service history.\n` +
        `  Name the vehicle year/make/model explicitly. Reference its ${v.days_on_lot} days on the lot naturally.\n`;
    } else {
      const invCtx = await fetchInventoryContext(
        supabase,
        input.context.dealershipId,
        input.recentVisit
      );
      inventorySection = formatInventorySection(invCtx);
    }
  } catch {
    // Non-fatal
  }

  // ── 3. Build prompts ───────────────────────────────────────

  // Compute days since last visit — with interpretation for Claude
  const { visitContext, daysSince: _daysSince, copyAngle } = (() => {
    const stage = input.customer.lifecycle_stage ?? "active";

    if (!input.recentVisit) {
      const prospectAngle =
        "PROSPECT — no prior relationship. Do NOT fabricate vehicle details, service history, or a personal connection that doesn't exist. " +
        "Lead with a specific, concrete service capability or first-visit benefit. Be professional and clear, not warm-yet.";
      return {
        visitContext:
          "No previous visit on record.\n" +
          "This customer has never visited the dealership — they are a prospect.\n" +
          "Do not reference any vehicle, service, or prior experience you do not have data for.\n" +
          "Focus entirely on what the dealership offers and why a first visit is worth their time.",
        daysSince: null as number | null,
        copyAngle: prospectAngle,
      };
    }

    const visitDate = input.recentVisit.visit_date?.slice(0, 10) ?? "";
    const daysSince = visitDate
      ? Math.round((Date.now() - new Date(visitDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const monthsAgo = daysSince ? Math.round(daysSince / 30) : null;
    const vehicle = [input.recentVisit.year, input.recentVisit.make, input.recentVisit.model]
      .filter(Boolean).join(" ") || null;

    // Interpret time gap and service notes into actionable copy direction
    let timeInterpretation = "";
    if (daysSince !== null) {
      if (daysSince < 45)        timeInterpretation = "Very recent visit — skip re-engagement framing. Focus on next milestone or an appreciation note.";
      else if (daysSince < 120)  timeInterpretation = "2-4 months ago — routine follow-up. Light touch, positive tone.";
      else if (daysSince < 270)  timeInterpretation = "4-9 months ago — approaching time for routine service. Specific reminder, not urgent.";
      else if (daysSince < 540)  timeInterpretation = "9-18 months ago — due for service. Reference the specific vehicle and prior service. Warm but purposeful.";
      else if (daysSince < 900)  timeInterpretation = "18 months to 2.5 years — lapsed. Acknowledge the gap naturally. Make returning easy, no guilt.";
      else                       timeInterpretation = "2.5+ years lapsed — long gap. Strong re-engagement. Be warm, specific, and give them a clear reason to return.";
    }

    // Determine copy angle based on lifecycle stage + time gap
    let copyAngle = "";
    if (stage === "vip") {
      copyAngle = "VIP loyalty — this customer has earned genuine appreciation. Lead with gratitude, not a sale. Offer something exclusive.";
    } else if (stage === "lapsed" || (daysSince && daysSince > 450)) {
      copyAngle = `LAPSED re-engagement — ${monthsAgo ? `${monthsAgo} months since last visit.` : ""} Reference their specific vehicle and what was done. Make returning frictionless.`;
    } else if (stage === "at_risk") {
      copyAngle = "AT-RISK retention — positive history but declining engagement. Specific service reminder tied to their vehicle's timeline. Low pressure.";
    } else if (stage === "active") {
      copyAngle = "ACTIVE customer — good relationship. Next service milestone, vehicle health check, or relevant upgrade angle.";
    } else {
      copyAngle = "SERVICE REMINDER — reference their vehicle and last service specifically. Concrete offer.";
    }

    const serviceNoteInterpretation = input.recentVisit.service_notes
      ? `Service notes (use any actionable items as natural hooks — e.g., worn pads, recommended fluid, upcoming milestone): ${input.recentVisit.service_notes}`
      : null;

    const visitContext = [
      vehicle ? `Vehicle: ${vehicle}` : null,
      visitDate ? `Last visit: ${visitDate}${monthsAgo !== null ? ` (${monthsAgo} month${monthsAgo === 1 ? "" : "s"} ago)` : ""}` : null,
      timeInterpretation ? `Time-gap context: ${timeInterpretation}` : null,
      `Service performed: ${input.recentVisit.service_type || "general service"}`,
      input.recentVisit.mileage ? `Mileage at last service: ${input.recentVisit.mileage.toLocaleString()} miles` : null,
      serviceNoteInterpretation,
    ].filter(Boolean).join("\n");

    return { visitContext, daysSince, copyAngle };
  })();

  // Template label for context in the channel guide
  const _ds = input.designStyle ?? "standard";
  const templateLabel =
    _ds === "conquest"            ? "Conquest Postcard (new customer acquisition)" :
    _ds === "premium-fluorescent" ? "Premium Fluorescent Card (bold event / VIP / urgent offer)" :
    _ds === "complex-fold"        ? "Folded Self-Mailer — Tri-fold (lapsed win-back)" :
    input.channel === "direct_mail" && (input as { templateType?: string }).templateType === "letter_8.5x11"
                                  ? "Premium Letter — 8.5×11 in envelope (formal / VIP)" :
                                    "Classic Postcard 6×9 (handwritten advisor note)";

  // Template-specific copy structure and voice
  const templateCopyGuide = (() => {
    if (_ds === "conquest") return [
      "TEMPLATE: Conquest Postcard — written for a prospect who has never visited.",
      "Voice: Professional, clear, welcoming — but no assumed warmth. You are introducing the dealership, not reconnecting.",
      "Structure:",
      "  • Para 1 (2 sentences): State a specific service capability or named benefit. Why this dealership, specifically.",
      "  • Para 2 (1–2 sentences): A concrete first-visit offer. Named service + dollar amount or named complimentary item.",
      "  • Para 3 (1 sentence): Easy, low-pressure CTA. Call, stop in, or book online.",
      "Word count: 45–65 words in body.",
      "Do NOT reference a vehicle you have no data on. Do NOT use 'I'd love to meet you' or any relationship language.",
    ].join("\n");

    if (_ds === "premium-fluorescent") return [
      "TEMPLATE: Premium Fluorescent Card — high-impact, event-style or urgent retention.",
      "Voice: Confident, direct, slightly elevated energy — but NOT pushy. Think: a concierge calling to confirm a reservation, not a salesperson.",
      "Structure:",
      "  • Para 1 (1–2 sentences): Bold, specific hook. Vehicle + time since visit, OR an event invitation with a date.",
      "  • Para 2 (1 sentence): The offer — concrete, named, with a value. No vague 'great deals'.",
      "  • Para 3 (1 sentence): Clear CTA with phone or booking link.",
      "Word count: 35–55 words in body. Shorter sentences. More punch per word.",
    ].join("\n");

    if (_ds === "complex-fold") return [
      "TEMPLATE: Folded Self-Mailer (Tri-fold) — three-panel format for lapsed win-back.",
      "The 'content' field is the INNER PANEL personalized story (80–100 words). The cover panel headline is NOT part of content.",
      "Voice: Warm, personal, a bit more narrative. This is your chance to tell a story in 3 paragraphs.",
      "Structure:",
      "  • Para 1 (2 sentences): Reference their specific vehicle and the time gap. Make it feel like the advisor noticed they were missing.",
      "  • Para 2 (2 sentences): What's changed, what's available, or what they might be missing. A specific named offer.",
      "  • Para 3 (1–2 sentences): Easy re-engagement CTA. Frictionless return.",
      "Word count: 80–100 words in body.",
    ].join("\n");

    // Default: Classic Postcard (standard) or Premium Letter
    const isLetter = (input as { templateType?: string }).templateType === "letter_8.5x11";
    if (isLetter) return [
      "TEMPLATE: Premium Letter (8.5×11 in envelope).",
      "Voice: More formal than a postcard, but still warm and personal. This is a letter from an advisor, not a form letter.",
      "Structure:",
      "  • Para 1 (2–3 sentences): Personal hook. Vehicle, service history, or relationship milestone.",
      "  • Para 2 (2 sentences): The specific offer or service need. Named and concrete.",
      "  • Para 3 (1–2 sentences): Formal but warm CTA. Dealership phone or website.",
      "  • Sign-off: 'Sincerely,' or 'Warmly,' followed by a single first name and title.",
      "Word count: 100–150 words in body.",
    ].join("\n");

    return [
      "TEMPLATE: Classic Postcard 6×9 — the handwritten advisor note.",
      "Voice: Warm, direct, personal. This note is printed by a robotic pen on card stock. Every word costs space. Be economical.",
      "Structure:",
      "  • Para 1 (1–2 sentences): Open with something specific and real — the vehicle name, time since last visit, or a noted service item. No generic openers.",
      "  • Para 2 (1–2 sentences): The offer — a named service, a dollar amount, a complimentary item. Something the customer can picture and value.",
      "  • Para 3 (1 sentence): Low-pressure CTA. Call, text, or book online. Never urgent.",
      "Word count: 60–80 words in body (greeting and sign-off not counted).",
    ].join("\n");
  })();

  const channelGuide = {
    sms: [
      "SMS message for an automotive dealership customer.",
      "Max 160 characters. No HTML. Conversational, first-name basis.",
      "Must include: customer first name, a specific reference (vehicle or service), dealership name or phone, and a clear action.",
      "Do NOT start with generic 'Hi' or 'Hello' alone — lead with something specific.",
    ].join("\n"),
    email: [
      "Personalized HTML email for an automotive dealership customer.",
      "Structure: subject line (7–10 words, specific and personal) + 2–3 short paragraphs + single CTA.",
      "Paragraph 1: Hook — reference their specific vehicle or visit history.",
      "Paragraph 2: The offer or value proposition — concrete, not vague.",
      "Paragraph 3: Soft CTA with dealership contact info.",
      "Sign off with a human name. Total body: under 200 words.",
    ].join("\n"),
    direct_mail: [
      // === WHO YOU ARE ===
      "You are a seasoned service advisor at a premium automotive dealership.",
      "You are writing a handwritten note — printed by a robotic pen on real card stock and mailed to a real customer.",
      "You have been at this dealership for 12 years. You know these customers by name. You know their vehicles. You are not a marketing department.",
      "You write the way a trusted advisor actually talks to a client: direct, warm, specific, honest.",
      "If anything you write sounds like ad copy, a promotion, or a used-car-lot flyer — delete it and start over.",
      "",
      // === FORMAT ===
      "OUTPUT FORMAT — reproduce exactly in the JSON 'content' field:",
      "  [First name only],",
      "  [blank line]",
      "  [Paragraph 1]",
      "  [blank line]",
      "  [Paragraph 2]",
      "  [blank line]",
      "  [Paragraph 3]",
      "  [blank line]",
      "  [Warmly, / Best, / Sincerely,]",
      "  [Single first name — the advisor's name. One name only.]",
      "",
      // === TEMPLATE-SPECIFIC GUIDANCE ===
      templateCopyGuide,
      "",
      // === VOICE PRINCIPLES ===
      "VOICE PRINCIPLES — internalize these before writing a single word:",
      "  1. Specific beats vague, always. '18 months' beats 'a while'. 'Brake pads at 40% life' beats 'service reminder'. '$35 oil change' beats 'great value'.",
      "  2. Short sentences feel handwritten. Long sentences feel corporate. Max 14 words per sentence.",
      "  3. Confident, not apologetic. Never open with an apology for writing.",
      "  4. Honest, not salesy. If you don't know their vehicle, don't reference one. If the offer is a $29 oil change, say $29 — don't dress it up.",
      "  5. The offer must have a name. 'Complimentary multi-point inspection', '$40 toward any service', 'complimentary cabin air filter with your next oil change'. Never 'special savings' or 'great offer'.",
      "  6. The CTA must be easy. One action. One path. 'Call us at [phone]' or 'book online at [url]' — never both in the same sentence with urgency language.",
      "  7. Sign off with one human first name. Never 'The Team', 'Service Department', or the dealership name.",
      "",
      // === PREMIUM BENCHMARKS ===
      "PREMIUM COPY BENCHMARKS — these are the quality level to match or exceed:",
      "",
      "BENCHMARK 1 — Lapsed customer, 16 months, oil change + brake wear noted:",
      `  Sandra,\n\n  Your 2019 Accord was last in sixteen months ago for an oil change. At that visit, your rear brake pads had about 35% life left — they're worth checking soon.\n\n  I have a complimentary brake inspection reserved for you, plus $40 off any service over $150 this month.\n\n  Call us at [phone] or book online at your convenience — I'll make sure you're taken care of.\n\n  Warmly,\n  Carlos`,
      "",
      "BENCHMARK 2 — Active customer, 5 months, approaching 30k miles:",
      `  David,\n\n  Your 2022 Silverado is coming up on 30,000 miles — a good time to stay ahead of things with the factory 30k service.\n\n  I can get you in any Tuesday or Wednesday this month. I'll also check your tires and top off fluids at no charge.\n\n  Give us a call when you're ready.\n\n  Best,\n  Mike`,
      "",
      "BENCHMARK 3 — Prospect, no visit, service introduction:",
      `  Jennifer,\n\n  Our service team handles everything from routine maintenance to full diagnostics, and we're accepting new customers for service appointments.\n\n  First-time customers receive a complimentary multi-point inspection with any oil change — a thorough look at your vehicle's condition at no additional cost.\n\n  Call us at [phone] or schedule online when it's convenient.\n\n  Best,\n  Sarah`,
      "",
      "BENCHMARK 4 — VIP customer, 6-year relationship, loyalty note:",
      `  Richard,\n\n  Six years of trusting us with your vehicles — I want you to know that means a great deal to our entire team.\n\n  We're hosting a private service appreciation evening on the 22nd: complimentary tire rotation, light refreshments, and first access to the new model year lineup.\n\n  We'd be glad to see you there. RSVP to [phone] or reply to this card.\n\n  Warmly,\n  Lisa`,
      "",
      "BENCHMARK 5 — At-risk customer, 10 months, transmission service due:",
      `  Marcus,\n\n  Your 2018 Explorer is getting close to the mileage interval for a transmission fluid service — something that's easy to overlook but makes a real difference long-term.\n\n  I have a $30 coupon set aside for you toward any service over $100, good through the end of the month.\n\n  Give us a call whenever works for you.\n\n  Best,\n  Tom`,
    ].join("\n"),
  }[input.channel];

  const learningsSection =
    patternLines.length > 0
      ? `\nNETWORK LEARNINGS — patterns proven to drive higher response rates across dealerships.\n` +
        `Apply the most relevant ones naturally:\n${patternLines.join("\n")}\n`
      : "";

  const designStyle = input.designStyle ?? "standard";
  const isAdvancedDesign = designStyle !== "standard";

  const profile = input.dealershipProfile;
  const xtimeUrl = profile?.xtimeUrl ?? null;
  const includeBookNow = input.includeBookNow && !!xtimeUrl;

  const profileSection = profile
    ? [
        profile.phone    ? `Phone: ${profile.phone}` : null,
        profile.address?.street
          ? `Address: ${[profile.address.street, profile.address.city, profile.address.state, profile.address.zip].filter(Boolean).join(", ")}`
          : null,
        profile.hours
          ? `Hours: ${Object.entries(profile.hours).slice(0, 4).map(([d, h]) => `${d}: ${h}`).join(", ")}`
          : null,
        profile.website_url ? `Website: ${profile.website_url}` : null,
        includeBookNow ? `Online Booking (X-Time): ${xtimeUrl}` : null,
      ].filter(Boolean).join("\n")
    : null;

  const bookNowSection = includeBookNow
    ? `\nBOOK NOW LINK — IMPORTANT: Include this X-Time scheduling URL naturally in your call-to-action:\n` +
      `  ${xtimeUrl}\n` +
      `  For SMS: shorten to just the URL. For email/mail: use anchor text like "Book your appointment online" or "Schedule now".\n` +
      `  Do NOT alter the URL. Do NOT include disclaimers — those are appended automatically.\n`
    : "";

  // ── Baseline style guidelines ──────────────────────────────
  let baselineSection = "";
  if (input.baselineExamples && input.baselineExamples.length > 0) {
    const examples = input.baselineExamples.slice(0, 8);
    const exampleBlocks = examples.map((ex, i) => {
      const typeTag = ex.mail_type ? ` [${ex.mail_type}]` : "";
      const notesTag = ex.notes ? `\n   Notes: ${ex.notes}` : "";
      return `Example ${i + 1}${typeTag}:\n"""\n${ex.example_text.trim()}\n"""${notesTag}`;
    }).join("\n\n");

    baselineSection =
      `\nDEALERSHIP STYLE GUIDELINES — these are real past mail pieces that performed well for this dealership.\n` +
      `Study the tone, sentence length, offer structure, greeting style, and sign-off format. Mirror this style closely.\n\n` +
      exampleBlocks + `\n\n` +
      `Your new message should feel like it came from the same advisor who wrote the above.\n`;
  }

  const DESIGN_STYLE_GUIDES: Record<DesignStyle, string> = {
    standard: "",
    "multi-panel": [
      `DESIGN STYLE: Multi-Panel Postcard — produce a structured layout with distinct front and back panels.`,
      `Front panel: hero image zone (top 40%) + personalized handwritten message + CTA.`,
      `Back panel: bold brand block + offer callout + address zone.`,
      `Keep message panel copy tight (40–60 words). Headline bold and punchy (5–8 words).`,
    ].join("\n"),
    "premium-fluorescent": [
      `DESIGN STYLE: Premium Fluorescent — bold graphic design with neon accent highlights.`,
      `Use a dark or deep-navy background. Choose ONE fluorescent accent (#FFE500 yellow, #FF6EC7 pink, or #39FF14 green).`,
      `Structure: bold 6–8 word headline in large type → 2-sentence personalized message → strong CTA button in fluorescent color.`,
      `Fluorescent elements: CTA button background, offer badge border, and any urgency callout text.`,
      `Message is shorter and punchier than standard (30–50 words). Urgency without being pushy.`,
    ].join("\n"),
    "complex-fold": [
      `DESIGN STYLE: Complex Fold (Tri-fold) — three distinct panels, each with a defined role.`,
      `Panel 1 (Cover): Bold brand statement + striking headline + dealership logo zone. This is what they see first.`,
      `Panel 2 (Inner left): Personalized story — reference their vehicle, service history, specific offer. 80–100 words.`,
      `Panel 3 (Inner right / Action): Offer details + QR code + CTA + business card info.`,
      `Include fold instructions for the print house in your layoutSpec.foldInstructions.`,
    ].join("\n"),
    conquest: [
      `DESIGN STYLE: Conquest Postcard — clean, modern design for new customer acquisition.`,
      `Bold headline (6–8 words) + short personalized message (40–60 words) + prominent CTA.`,
      `No assumed relationship — professional, welcoming, specific value proposition.`,
    ].join("\n"),
  };

  const designStyleNote = isAdvancedDesign
    ? `\n${DESIGN_STYLE_GUIDES[designStyle]}\n`
    : "";

  const imagesNote =
    input.designImages?.length
      ? `\nDEALER-PROVIDED IMAGES (use in imageZone placeholders):\n${input.designImages.map((u, i) => `  ${i + 1}. ${u}`).join("\n")}\n`
      : "";

  const memoriesSection = input.dealerMemories ?? "";
  const coopSection = input.coopGuidance ?? "";
  const insightsSection = input.dealershipInsights ?? "";

  // Credit tier offer framing (FCRA-safe: tailor offer type, never mention the score)
  const CREDIT_OFFER_GUIDANCE: Record<string, string> = {
    excellent:
      `CREDIT CONTEXT (internal only — do NOT mention credit scores or tiers to the customer):\n` +
      `This customer likely qualifies for top-tier financing. Lead with: 0% APR offers, loyalty upgrade programs, ` +
      `low monthly payments on new vehicles, or exclusive VIP-level service perks.`,
    good:
      `CREDIT CONTEXT (internal only — do NOT mention credit scores or tiers to the customer):\n` +
      `This customer likely qualifies for competitive financing rates. Lead with: trade-in value emphasis, ` +
      `below-market rate offers, or vehicle upgrade opportunities with manageable payments.`,
    fair:
      `CREDIT CONTEXT (internal only — do NOT mention credit scores or tiers to the customer):\n` +
      `This customer may benefit from flexible payment options. Lead with: cash-back offers, service-value ` +
      `messaging, or "no-pressure" service reminders. Avoid financing-forward language.`,
    poor:
      `CREDIT CONTEXT (internal only — do NOT mention credit scores or tiers to the customer):\n` +
      `Focus on service value and trade-in equity. Lead with: cash incentives, loyalty service discounts, ` +
      `or trade-in-for-equity offers. Avoid payment/financing language entirely.`,
  };
  const creditSection = input.customerCreditTier && input.customerCreditTier !== "unknown"
    ? `\n${CREDIT_OFFER_GUIDANCE[input.customerCreditTier] ?? ""}\n`
    : "";

  const HR = "─".repeat(55);

  const systemPrompt = [
    // Identity
    `You are the Creative Agent for AutoCDP — you write premium, advisor-quality outreach for automotive dealership customers.`,
    `You write as a trusted, long-tenured service advisor — not a salesperson, not a marketing department.`,
    `Think of your role as a respected professional who happens to know vehicles deeply and genuinely cares about the customer's experience and safety.`,
    `Every message you produce should make the dealership's General Manager proud to put their name on it.`,
    `If the copy sounds like a car commercial, a chain-store mailer, or anything that belongs in a spam folder — it is wrong. Rewrite it.`,
    `\nDealership: ${input.context.dealershipName}`,
    `Tone: ${input.dealershipTone || "professional and warm — a trusted advisor, not a salesperson. Confident without being pushy. Specific without being clinical."}`,
    profileSection ? `\nDEALERSHIP CONTACT INFO (use in CTAs when relevant):\n${profileSection}` : null,

    // Hard constraints FIRST — these override everything else
    memoriesSection || null,

    // Co-op compliance
    coopSection || null,

    // Channel format guide (and advanced design)
    `\nCHANNEL FORMAT:\n${channelGuide}`,
    designStyleNote || null,
    imagesNote || null,

    // Style reference
    baselineSection || null,

    // Context signals (soft — inform but don't override)
    insightsSection || null,
    creditSection || null,

    // Data-driven patterns
    learningsSection || null,

    // Inventory
    inventorySection || null,

    // Booking CTA
    bookNowSection || null,

    // Critical writing rules — placed last for recency effect
    `\n${HR}`,
    `CRITICAL WRITING RULES`,
    `${HR}`,
    `BANNED PHRASES — never write any of these in any output:`,
    `  ✗ "I hope this message/note/card finds you well"`,
    `  ✗ "I wanted to reach out" / "I'm reaching out today" / "I'm following up"`,
    `  ✗ "Don't hesitate to contact us" / "Feel free to reach out"`,
    `  ✗ "As a valued customer" / "As one of our most loyal customers"`,
    `  ✗ "We wanted to let you know" / "We are pleased to inform you"`,
    `  ✗ "Exclusive deals" / "Special savings" / "Amazing offers" / "Great deals" (all vague non-specifics)`,
    `  ✗ "It's that time of year again"`,
    `  ✗ "Haven't had the pleasure of meeting" / "Pleasure of meeting" / "Would love to meet you"`,
    `  ✗ "I'd love to change that" — desperate and clichéd`,
    `  ✗ "No strings" / "No strings attached" / "No strings, just" — discount-lot language`,
    `  ✗ "I'd love to earn your business" / "love to show you what we can do"`,
    `  ✗ "Just a quick note" / "Just wanted to say" / "Just stopping by to say" — 'just' as a minimizer signals insecurity`,
    `  ✗ "A solid look at your vehicle" — casual filler`,
    `  ✗ "Take advantage of" — sounds manipulative`,
    `  ✗ "Worth your time" — condescending to say`,
    `  ✗ "I'd be honored" / "It would be my pleasure" — overly servile`,
    `  ✗ Any passive-voice corporate filler ("Please be advised", "At your earliest convenience", "Do not hesitate")`,
    ``,
    `REQUIRED in every direct mail message:`,
    `  ✓ Open with something real and specific — vehicle name AND either time since last visit, a service milestone, or a specific noted issue`,
    `  ✓ For prospects (no visit history): introduce a specific capability or named service benefit — not a generic "we're here for you"`,
    `  ✓ Reference their actual service history: vehicle, service type, and mileage when known`,
    `  ✓ Offer must be concrete — a dollar amount, a free named item, or a specific named service, never "great deals" or "special savings"`,
    `  ✓ Sign off with a single human first name only — never "the team", "the service department", or a company name`,
    `  ✓ CTA must be low-pressure and frictionless — "call or book online at your convenience", not "ACT NOW" or countdown language`,
    `  ✓ Weave in network learnings naturally — never quote them verbatim or use bullet points`,
    `  ✓ Use the dealership phone number in CTAs when provided`,
    `  ✗ Do NOT write opt-out, unsubscribe, or legal disclaimer text — those are appended automatically`,
    ``,
    `QUALITY BAR — before finalizing copy, ask yourself:`,
    `  • Would a trusted advisor actually say this to a client's face?`,
    `  • Is every sentence specific enough that it could only be for this customer?`,
    `  • Is the offer concrete enough that the customer knows exactly what they're getting?`,
    `  • Would the dealership GM be proud to sign this?`,
    `  If the answer to any of these is "no" — rewrite.`,
    `${HR}`,
  ].filter((s): s is string => s !== null && s !== undefined && s !== "").join("\n");

  const layoutSpecSchema = isAdvancedDesign ? `
  "layoutSpec": {
    "style": "${designStyle}",
    "panels": [
      {
        "id": "front",
        "role": "front",
        "headline": "Bold 6-8 word headline",
        "subheadline": "Optional supporting line",
        "body": "Personalized message body",
        "cta": "Call to action text",
        "ctaUrl": "${xtimeUrl ?? ""}",
        "backgroundColor": "#hex",
        "textColor": "#hex",
        "accentColor": "#hex",
        "imageZone": {
          "panelId": "front",
          "position": "top",
          "widthPct": 100,
          "heightPx": 180,
          "imageUrl": "${input.designImages?.[0] ?? ""}",
          "placeholder": "Describe what image goes here",
          "alt": "Image alt text"
        }
      }
    ],
    "colorScheme": {
      "primary": "#hex",
      "accent": "#hex",
      "background": "#hex",
      "text": "#hex",
      "accentIsNeon": true
    },
    "foldInstructions": "Tri-fold: fold right panel inward first, then left panel over",
    "dieCutInstructions": "Round corners 0.25in radius",
    "printNotes": "Use Pantone 801 U for neon accent, ensure 1/8in bleed on all edges"
  },` : "";

  const userPrompt = [
    `Write a personalized direct mail piece for the customer below.`,
    ``,
    `═══════════════════════════════════════`,
    `CUSTOMER`,
    `═══════════════════════════════════════`,
    `Name: ${input.customer.first_name} ${input.customer.last_name}`,
    `Lifecycle stage: ${input.customer.lifecycle_stage ?? "unknown"}`,
    `Total visits: ${input.customer.total_visits} | Total spend: $${input.customer.total_spend.toFixed(0)}`,
    ``,
    `═══════════════════════════════════════`,
    `VISIT HISTORY & VEHICLE`,
    `═══════════════════════════════════════`,
    visitContext,
    ``,
    `═══════════════════════════════════════`,
    `COPY ANGLE (pre-computed — follow this)`,
    `═══════════════════════════════════════`,
    copyAngle,
    ``,
    `═══════════════════════════════════════`,
    `CAMPAIGN GOAL`,
    `═══════════════════════════════════════`,
    input.campaignGoal,
    ``,
    `TEMPLATE: ${templateLabel}`,
    input.template ? `BASE TEMPLATE:\n${input.template}` : null,
    ``,
    `═══════════════════════════════════════`,
    `OUTPUT`,
    `═══════════════════════════════════════`,
    `Respond with valid JSON only — no preamble, no markdown code fences:`,
    `{`,
    `  "subject": null,`,
    `  "content": "the full handwritten note — greeting through sign-off, exact format from your instructions",`,
    isAdvancedDesign ? layoutSpecSchema : null,
    `  "reasoning": "2–3 sentences: what specific data points drove your hook, offer, and CTA choices",`,
    `  "confidence": 0.9`,
    `}`,
  ].filter((s): s is string => s !== null && s !== undefined).join("\n");

  // ── 4. Generate copy ───────────────────────────────────────
  const response = await client.messages.create({
    model: MODELS.standard,
    max_tokens: isAdvancedDesign ? 1024 : (input.channel === "direct_mail" ? 800 : 512),
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response from Creative Agent");

  const jsonMatch = block.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Creative Agent did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]);

  // ── 5. Post-process copy ───────────────────────────────────
  const cleanedContent = postProcessMailCopy(parsed.content ?? "", input.channel);

  // ── 6. Guardrails ──────────────────────────────────────────
  const guardrail = await applyGuardrails(
    cleanedContent,
    parsed.subject ?? null,
    input.channel
  );

  if (!guardrail.passed) {
    throw new Error(
      `Creative Agent output blocked by guardrails: ${guardrail.violations.join(", ")}`
    );
  }

  // ── 7. Append compliance disclaimer (verbatim — never AI-generated) ──
  const includeDisclaimer = input.includeDisclaimer !== false; // default true
  const finalContent = includeDisclaimer
    ? appendDisclaimer(guardrail.content, input.channel, {
        dealershipName: input.context.dealershipName,
        dealershipPhone: profile?.phone,
        dealershipAddress: profile?.address,
        isMarketing: true,
      })
    : guardrail.content;

  return {
    customerId: input.customer.id,
    channel: input.channel,
    subject: guardrail.subject ?? undefined,
    content: finalContent,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    guardrailsApplied: guardrail.rewritten,
    guardrailViolations: guardrail.violations,
    layoutSpec: parsed.layoutSpec as LayoutSpec | undefined,
  };
}
