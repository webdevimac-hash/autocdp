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
 * Each variant uses the same customer + campaign goal but a different
 * creative approach: Relationship / Value Offer / Timely Hook.
 *
 * Body: customerId, templateType, campaignGoal, designStyle?
 */

const STYLE_VARIANTS = [
  {
    label: "Relationship",
    focus: "Personal connection — service history, named advisor, warm and specific",
    hint: "Open with a personal reference to their exact vehicle or how long they've been a customer. Write as if from their service advisor. Warm, specific, relationship-first. The offer is secondary to the connection.",
  },
  {
    label: "Value Offer",
    focus: "Lead with a specific, compelling offer relevant to their vehicle",
    hint: "Open directly with a concrete, specific service offer relevant to their vehicle age or mileage. Be direct about the value. Reference the vehicle by name. Strong, clear call to action. Relationship details support the offer.",
  },
  {
    label: "Timely Hook",
    focus: "Time-sensitive — mileage milestone, seasonal service, or 'it's been X months'",
    hint: "Open with a time-based hook tied to their last visit date, season, or upcoming mileage milestone. Make it feel naturally urgent without pressure. Reference their specific vehicle and the exact service type it needs.",
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

    // Run all 3 style variants in parallel — one Claude call per variant
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
      return {
        variantLabel: v.label,
        variantFocus: v.focus,
        content: creative.content,
        reasoning: creative.reasoning,
        confidence: creative.confidence,
        previewQrUrl,
        vehicle,
        lastVisitDate: visits?.[0]?.visit_date ?? null,
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
