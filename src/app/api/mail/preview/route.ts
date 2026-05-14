import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runCreativeAgent } from "@/lib/anthropic/agents/creative-agent";
import { buildPreviewQRImageUrl } from "@/lib/qrcode-gen";
import { loadDealershipMemories, formatMemoriesForPrompt } from "@/lib/memories";
import { loadBaselineExamples } from "@/lib/anthropic/baseline";
import { resolveVehiclePhoto, placeholderPhotoFor } from "@/lib/inventory-photos";
import type { Customer, Visit, CommunicationChannel, MailTemplateType } from "@/types";

/**
 * POST /api/mail/preview
 *
 * Generates AI-personalized copy for one customer without sending.
 * Supports all channels — direct_mail (default), sms, email.
 *
 * Body:
 *   customerId    string
 *   templateType  MailTemplateType    (direct_mail only)
 *   campaignGoal  string
 *   channel?      CommunicationChannel  (default: "direct_mail")
 *   tone?         string
 */
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
    const { customerId, templateType, campaignGoal, channel = "direct_mail", tone, designStyle = "standard" } = body;

    if (!customerId || !campaignGoal) {
      return NextResponse.json({ error: "customerId and campaignGoal are required" }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
    }

    const [{ data: customer }, { data: visits }, dealerMemories, baselineExamples] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .eq("dealership_id", ud.dealership_id)
        .single(),
      supabase
        .from("visits")
        .select("*")
        .eq("customer_id", customerId)
        .eq("dealership_id", ud.dealership_id)
        .order("visit_date", { ascending: false })
        .limit(1),
      loadDealershipMemories(ud.dealership_id),
      loadBaselineExamples(ud.dealership_id),
    ]);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const resolvedChannel = (channel as CommunicationChannel) || "direct_mail";

    // Channel-specific template hint (direct_mail intentionally omitted — the creative agent's
    // channel guide already enforces the correct structure and word count per template type)
    let templateHint: string | undefined;
    if (resolvedChannel === "sms") {
      templateHint = "Write an SMS message. Max 160 characters. Include the customer's first name and a clear call-to-action with the dealership phone number or reply STOP to opt out.";
    } else if (resolvedChannel === "email") {
      templateHint = "Write a full HTML email. Subject line + personalized body (2–3 paragraphs). Include a clear CTA button linking to 'tel:{{phone}}'. Keep it warm and specific. Return subject and body_html as separate fields.";
    }

    const creative = await runCreativeAgent({
      context: {
        dealershipId: ud.dealership_id,
        dealershipName: (dealership?.name as string) ?? "Your Dealership",
      },
      customer: customer as Customer,
      recentVisit: (visits?.[0] as Visit | undefined) ?? null,
      channel: resolvedChannel,
      campaignGoal,
      dealershipTone: tone,
      template: templateHint,
      designStyle: resolvedChannel === "direct_mail" ? designStyle : undefined,
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
    });

    // QR preview URL — only relevant for direct mail
    const previewTrackingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/track/preview`;
    const previewQrUrl = resolvedChannel === "direct_mail"
      ? buildPreviewQRImageUrl(previewTrackingUrl, 120)
      : null;

    // Vehicle photo — look up inventory for a real photo, else deterministic Unsplash placeholder
    const recentVisit = visits?.[0];
    const vehicleString = recentVisit
      ? [recentVisit.year, recentVisit.make, recentVisit.model].filter(Boolean).join(" ")
      : null;

    let vehiclePhotoUrl: string | null = null;
    if (resolvedChannel === "direct_mail") {
      if (recentVisit?.make) {
        // Try to match the customer's specific vehicle make/model from inventory
        const { data: invRow } = await supabase
          .from("inventory")
          .select("id, metadata")
          .eq("dealership_id", ud.dealership_id)
          .ilike("make", recentVisit.make)
          .ilike("model", recentVisit.model ?? "")
          .limit(1)
          .single() as { data: { id: string; metadata: Record<string, unknown> } | null };

        vehiclePhotoUrl = invRow
          ? resolveVehiclePhoto(invRow.id, invRow.metadata)
          : placeholderPhotoFor(vehicleString ?? "car");
      } else {
        // No visit history (prospect) — show any available inventory photo so the
        // postcard front renders a real vehicle rather than the gradient placeholder
        const { data: anyInv } = await supabase
          .from("inventory")
          .select("id, metadata")
          .eq("dealership_id", ud.dealership_id)
          .limit(1)
          .single() as { data: { id: string; metadata: Record<string, unknown> } | null };

        vehiclePhotoUrl = anyInv
          ? resolveVehiclePhoto(anyInv.id, anyInv.metadata)
          : placeholderPhotoFor(customer.id ?? "vehicle");
      }
    }

    return NextResponse.json({
      customerId,
      customerName: `${customer.first_name} ${customer.last_name}`,
      templateType: (templateType as MailTemplateType) ?? null,
      channel: resolvedChannel,
      content: creative.content,
      subject: creative.subject ?? null,
      reasoning: creative.reasoning,
      confidence: creative.confidence,
      previewQrUrl,
      designStyle: resolvedChannel === "direct_mail" ? designStyle : null,
      layoutSpec: creative.layoutSpec ?? null,
      vehicle: vehicleString,
      vehiclePhotoUrl,
      lastVisitDate: recentVisit?.visit_date ?? null,
      offer: creative.offer ?? null,
      headline: creative.headline ?? null,
      structured: creative.structured ?? null,
      // Convenience — cleaned SMS body (strip HTML if any)
      smsBody: resolvedChannel === "sms" ? creative.content.replace(/<[^>]+>/g, "").slice(0, 160) : null,
    });
  } catch (error) {
    console.error("[/api/mail/preview]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
