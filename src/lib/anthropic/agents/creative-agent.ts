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
    // (but NOT at start of string or after a newline — those are fine)
    .replace(/([a-z])([A-Z][a-z])/g, (_, a, b) => `${a} ${b}`)
    // Collapse 3+ consecutive newlines to exactly 2
    .replace(/\n{3,}/g, "\n\n")
    // Trim trailing whitespace from each line
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    // Ensure at least one blank line before the sign-off (Warmly / Best / Thanks)
    .replace(/\n(Warmly|Best|Sincerely|Thanks|Cheers|With appreciation|Take care|See you soon),/g, "\n\n$1,")
    // Strip AI-speak phrases that escaped the system prompt rules
    .replace(/I hope (this|the) (message|note|letter|card|postcard) finds you (well|great|in good health)[.,!]?\s*/gi, "")
    .replace(/I (wanted|am writing|am reaching out) to (reach out|let you know|inform you|follow up)[^.!?]*[.!?]\s*/gi, "")
    .replace(/Don'?t hesitate to (contact|call|reach out to) us[.,!]?\s*/gi, "Give us a call anytime. ")
    .replace(/Feel free to (contact|call|reach out to|stop by)[^.!?]*[.!?]\s*/gi, "")
    .replace(/As (a )?valued (customer|guest|client)[,.]?\s*/gi, "")
    .replace(/We (wanted to|are pleased to|would like to) (let you know|inform you|reach out)[^.!?]*[.!?]\s*/gi, "")
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

  // Compute days since last visit — critical context for the hook
  const visitContext = (() => {
    if (!input.recentVisit) return "No previous visit on record — treat as a new relationship, focus on a warm welcome.";
    const visitDate = input.recentVisit.visit_date?.slice(0, 10) ?? "";
    const daysSince = visitDate
      ? Math.round((Date.now() - new Date(visitDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const vehicle = [input.recentVisit.year, input.recentVisit.make, input.recentVisit.model]
      .filter(Boolean).join(" ") || "unknown vehicle";
    return [
      `Last visit: ${visitDate}${daysSince !== null ? ` (${daysSince} days ago — use this as an opening hook when relevant)` : ""}`,
      `Service performed: ${input.recentVisit.service_type || "general service"}`,
      `Vehicle serviced: ${vehicle}`,
      input.recentVisit.mileage ? `Mileage at last service: ${input.recentVisit.mileage.toLocaleString()} miles` : null,
      input.recentVisit.service_notes ? `Service notes: ${input.recentVisit.service_notes}` : null,
    ].filter(Boolean).join(" | ");
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
      "You are writing a handwritten service note — personalized direct mail printed by a robotic pen.",
      "",
      "EXACT OUTPUT FORMAT (reproduce this structure precisely in the JSON 'content' field):",
      "  [First name only],",
      "  [blank line — \\n\\n]",
      "  [Paragraph 1 — 1–2 sentences. Concrete hook: name their vehicle AND reference time since last visit or a service milestone.]",
      "  [blank line — \\n\\n]",
      "  [Paragraph 2 — 1–2 sentences. The specific offer or service reminder. Dollar amount or named service — never 'great deals'.]",
      "  [blank line — \\n\\n]",
      "  [Paragraph 3 — 1–2 sentences. Low-pressure CTA. Easy to act on.]",
      "  [blank line — \\n\\n]",
      "  [Sign-off word: 'Warmly,' or 'Best,' or 'See you soon,']",
      "  [Advisor first name — a single human name only]",
      "",
      "RULES: Max 12 words per sentence. Body (not counting greeting/sign-off): 50–75 words.",
      "Write in first person as the advisor. No 'the dealership' in third person.",
      "Every sentence ends with punctuation. No run-on sentences. No lists.",
      "",
      "EXAMPLE A — 11 months since last visit, service reminder:",
      "  James,\n\n  Your 2021 Tacoma is due for its 30k service. It's been almost a year — let's get you caught up.\n\n  I have a $30 coupon reserved for you this month, good any Tuesday or Wednesday.\n\n  Just give us a call or book online anytime.\n\n  Best,\n  Mike",
      "",
      "EXAMPLE B — VIP appreciation, multiple vehicles:",
      "  Robert & Linda,\n\n  Thank you for being such loyal customers over the years. It genuinely means a lot to our whole team.\n\n  We're hosting a VIP event Saturday — free tire rotation and a first look at the new lineup.\n\n  We'd love to see you there.\n\n  Warmly,\n  Sarah",
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
    `You are the Creative Agent for AutoCDP — you write hyper-personalized outreach for automotive dealership customers.`,
    `Copy must feel hand-written and specific, like a note from a service advisor who knows the customer personally. Never like a marketing blast.`,
    `\nDealership: ${input.context.dealershipName}`,
    `Tone: ${input.dealershipTone || "warm, conversational, service-advisor voice"}`,
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
    `  ✗ "I wanted to reach out" / "I'm reaching out today"`,
    `  ✗ "Don't hesitate to contact us" / "Feel free to reach out"`,
    `  ✗ "As a valued customer" / "As one of our most loyal customers"`,
    `  ✗ "We wanted to let you know" / "We are pleased to inform you"`,
    `  ✗ "Exclusive deals" / "Special savings" / "Amazing offers" (all vague non-specifics)`,
    `  ✗ "It's that time of year again"`,
    `  ✗ Any passive-voice corporate filler ("Please be advised", "At your earliest convenience")`,
    ``,
    `REQUIRED in every message:`,
    `  ✓ Open with something real and specific — vehicle name, mileage milestone, or time since last visit`,
    `  ✓ Reference their actual service history: vehicle, service type, and mileage when known`,
    `  ✓ Offer must be concrete — a dollar amount, a free named item, or a specific perk, never "great deals"`,
    `  ✓ Sign off with a single human first name, not a company, department, or "the team"`,
    `  ✓ CTA should be low-pressure ("call or book online anytime" — never "ACT NOW" or countdown language)`,
    `  ✓ Weave in network learnings naturally — never quote them verbatim`,
    `  ✓ Use the dealership phone number in CTAs when provided`,
    `  ✗ Do NOT write opt-out, unsubscribe, or legal disclaimer text — those are appended automatically`,
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
    `  "content": "the full message text (front-panel body for advanced designs)",\n` +
    (isAdvancedDesign ? layoutSpecSchema + "\n" : "") +
    `  "reasoning": "why this angle — mention which learnings you applied",\n` +
    `  "confidence": 0.85\n` +
    `}`;

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
