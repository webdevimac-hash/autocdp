import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runCreativeAgent } from "@/lib/anthropic/agents/creative-agent";
import { buildPreviewQRImageUrl } from "@/lib/qrcode-gen";
import { loadDealershipMemories, formatMemoriesForPrompt } from "@/lib/memories";
import { loadBaselineExamples } from "@/lib/anthropic/baseline";
import type { Customer, Visit, MailTemplateType, DesignStyle } from "@/types";

/**
 * POST /api/mail/variations
 *
 * Generates 3 creative style variations for a single customer in parallel.
 * Each variant uses the same customer + campaign goal but a meaningfully
 * different creative approach — Relationship / Bold Offer / Urgency Hook —
 * so each produces distinct copy, layoutSuggestion, and visual treatment.
 *
 * Returns full structured output (headline, bodyCopy, couponBlock, ctaText,
 * urgencyLine, layoutSuggestion, offer) so the UI can render TemplatePreview
 * for each variant and let the dealer "Apply" the one they prefer.
 *
 * Body: customerId, templateType, campaignGoal, designStyle?
 */

// Three genuinely distinct creative strategies.
// Each hint explicitly tells Claude which VISUAL TREATMENT to suggest in its
// layoutSuggestion so the three cards look meaningfully different.
const STYLE_VARIANTS = [
  {
    label: "Relationship",
    focus: "Personal connection — advisor tone, service history, warm + specific",
    hint: [
      "VARIANT APPROACH — RELATIONSHIP:",
      "Write as the customer's personal service advisor. Open with a warm, specific",
      "reference to their exact vehicle and how long they've been a customer.",
      "The offer is secondary — the human connection is the hook.",
      "Voice: intimate, personal, like a note from someone who actually knows them.",
      "",
      "For your layoutSuggestion: Recommend the visual DNA's primary layout style.",
      "Prioritise the handwritten-note aesthetic — headline is warm and personal",
      "(not promotional), hero vehicle photo prominent, offer badge understated.",
      "Eye path: vehicle photo → personal headline → advisor message → soft CTA.",
    ].join("\n"),
    accentHue: "relationship",
  },
  {
    label: "Bold Offer",
    focus: "Oversized offer badge dominates — value drives the eye first",
    hint: [
      "VARIANT APPROACH — BOLD OFFER:",
      "Lead directly with the single most compelling, concrete service offer.",
      "Open with the dollar amount or named service — make the value unmissable.",
      "Reference the vehicle by year/make/model. Strong, direct CTA.",
      "Voice: confident, direct, value-forward. Relationship details support the offer.",
      "",
      "For your layoutSuggestion: Suggest a HIGH-CONTRAST layout where the offer",
      "badge / coupon strip is the DOMINANT visual element — oversized, centre-stage.",
      "Recommend premium-fluorescent style if the visual DNA examples show dark",
      "backgrounds, OR a bold-badge treatment on a light background otherwise.",
      "Eye path: offer badge → vehicle name → short body → urgent CTA.",
    ].join("\n"),
    accentHue: "offer",
  },
  {
    label: "Urgency Hook",
    focus: "Deadline banner + mileage milestone — time creates action",
    hint: [
      "VARIANT APPROACH — URGENCY HOOK:",
      "Open with a time-based hook that creates genuine, non-pushy urgency:",
      "exact months since last visit, upcoming mileage milestone, or seasonal window.",
      "Name the specific service the vehicle is due for. Expiry date prominent.",
      "Voice: matter-of-fact, timely, not salesy. 'Your Accord is 18 months out.'",
      "",
      "For your layoutSuggestion: Recommend a layout with a prominent URGENCY BANNER",
      "or deadline ribbon — top strip or bottom strip with expiry date large.",
      "Suggest the complex-fold or multi-panel format if visual DNA shows folded",
      "pieces; otherwise suggest a standard postcard with an urgency strip overlay.",
      "Eye path: urgency banner → vehicle/service hook → offer → CTA with date.",
    ].join("\n"),
    accentHue: "urgency",
  },
] as const;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.json({ error: "No dealership" }, { status: 400 });
    }

    const { data: dealership } = await supabase
      .from("dealerships")
      .select("name, phone, address, hours, logo_url, website_url")
      .eq("id", ud.dealership_id)
      .single() as { data: Record<string, unknown> | null };

    const body = await req.json();
    const { customerId, templateType, campaignGoal, designStyle = "standard" } = body;

    if (!customerId || !campaignGoal) {
      return NextResponse.json({ error: "customerId and campaignGoal are required" }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
    }

    const [{ data: customer }, { data: visits }, dealerMemories, baselineExamples] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).eq("dealership_id", ud.dealership_id).single(),
      supabase.from("visits").select("*").eq("customer_id", customerId).eq("dealership_id", ud.dealership_id).order("visit_date", { ascending: false }).limit(1),
      loadDealershipMemories(ud.dealership_id),
      loadBaselineExamples(ud.dealership_id),
    ]);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const previewQrUrl = buildPreviewQRImageUrl(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/track/preview`,
      120
    );

    const sharedInput = {
      context: {
        dealershipId: ud.dealership_id,
        dealershipName: (dealership?.name as string) ?? "Your Dealership",
      },
      customer: customer as Customer,
      recentVisit: (visits?.[0] as Visit | undefined) ?? null,
      channel: "direct_mail" as const,
      campaignGoal,
      designStyle: designStyle as DesignStyle,
      dealerMemories: dealerMemories.length ? formatMemoriesForPrompt(dealerMemories) : undefined,
      baselineExamples: baselineExamples.length ? baselineExamples : undefined,
      includeDisclaimer: false,
      dealershipProfile: {
        phone: dealership?.phone as string | null,
        address: dealership?.address as { street?: string; city?: string; state?: string; zip?: string } | null,
        hours: dealership?.hours as Record<string, string> | null,
        logo_url: dealership?.logo_url as string | null,
        website_url: dealership?.website_url as string | null,
      },
      customerCreditTier:
        ((customer?.metadata as Record<string, unknown> | null)?.credit_tier as string | undefined) ?? undefined,
    };

    // Run all 3 style variants in parallel — one Claude call per variant.
    // Each call gets a unique `template` hint that forces a distinct creative approach
    // AND a distinct layoutSuggestion (see STYLE_VARIANTS above).
    const settled = await Promise.allSettled(
      STYLE_VARIANTS.map((v) => runCreativeAgent({ ...sharedInput, template: v.hint }))
    );

    const vehicle = visits?.[0]
      ? [visits[0].year, visits[0].make, visits[0].model].filter(Boolean).join(" ")
      : null;

    const variants = STYLE_VARIANTS.map((v, i) => {
      const result = settled[i];
      if (result.status === "rejected") return null;
      const creative = result.value;

      // Pull structured fields — these drive TemplatePreview rendering on the client
      const couponBlock = creative.structured?.couponBlock as
        | { offerText?: string; expiresText?: string; conditionsText?: string }
        | undefined;

      return {
        variantLabel:      v.label,
        variantFocus:      v.focus,
        accentHue:         v.accentHue,
        // Copy
        content:           creative.content,
        reasoning:         creative.reasoning,
        confidence:        creative.confidence,
        // Structured fields for TemplatePreview
        headline:          creative.headline ?? null,
        subHeadline:       creative.structured?.subHeadline ?? null,
        offer:             creative.offer ?? null,
        ctaText:           creative.structured?.ctaText ?? null,
        urgencyLine:       creative.structured?.urgencyLine ?? null,
        expiresText:       couponBlock?.expiresText ?? null,
        conditionsText:    couponBlock?.conditionsText ?? null,
        // Layout signals
        layoutSuggestion:  creative.layoutSuggestion ?? null,
        // Metadata
        previewQrUrl,
        vehicle,
        lastVisitDate:     visits?.[0]?.visit_date ?? null,
      };
    }).filter((v): v is NonNullable<typeof v> => v !== null);

    return NextResponse.json({
      customerId,
      customerName: `${(customer as Customer).first_name} ${(customer as Customer).last_name}`,
      templateType: (templateType as MailTemplateType) ?? null,
      variants,
    });
  } catch (error) {
    console.error("[/api/mail/variations]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
