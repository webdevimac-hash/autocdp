/**
 * POST /api/leads/ai-reply
 *
 * Generates an AI-drafted reply for an inbound conquest lead using the Creative Agent.
 * Returns the draft for human review — does NOT send the message.
 * Call /api/leads/reply with the approved message to send.
 *
 * Body: { conquest_lead_id, channel: "sms"|"email", campaign_goal? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runCreativeAgent } from "@/lib/anthropic/agents/creative-agent";
import type { Customer, Visit } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    conquest_lead_id: string;
    channel?: "sms" | "email";
    campaign_goal?: string;
  };

  if (!body.conquest_lead_id) {
    return NextResponse.json({ error: "conquest_lead_id is required" }, { status: 400 });
  }

  const svc = createServiceClient();

  type UdRow = { dealership_id: string } | null;
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  // Load conquest lead
  type ConquestRow = {
    id: string; dealership_id: string; first_name: string | null; last_name: string | null;
    email: string | null; phone: string | null; address: Record<string, string> | null;
    vehicle_interest: string | null; source: string; notes: string | null;
    metadata: Record<string, unknown>;
  } | null;
  const { data: lead } = await svc
    .from("conquest_leads")
    .select("*")
    .eq("id", body.conquest_lead_id)
    .eq("dealership_id", ud.dealership_id)
    .single() as unknown as { data: ConquestRow };

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Check TCPA opt-out
  if (lead.metadata?.tcpa_optout) {
    return NextResponse.json({
      error: "TCPA_OPTOUT",
      message: "This contact has opted out of communications and cannot be messaged.",
    }, { status: 403 });
  }

  const channel = body.channel ?? (lead.phone ? "sms" : "email");

  type DealershipRow = {
    name: string; phone: string | null; address: Record<string, unknown> | null;
    hours: Record<string, string> | null; logo_url: string | null; website_url: string | null;
  } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("name, phone, address, hours, logo_url, website_url")
    .eq("id", ud.dealership_id)
    .single() as unknown as { data: DealershipRow };

  // Find or build a synthetic Customer object for the creative agent
  type CustomerRow = Customer | null;
  let customer: CustomerRow = null;

  if (lead.email) {
    const { data } = await svc
      .from("customers")
      .select("*")
      .eq("dealership_id", ud.dealership_id)
      .eq("email", lead.email)
      .maybeSingle() as unknown as { data: CustomerRow };
    customer = data;
  }

  // If no customer record yet, synthesize one from the lead
  if (!customer) {
    customer = {
      id: lead.id,
      dealership_id: ud.dealership_id,
      first_name: lead.first_name ?? "there",
      last_name: lead.last_name ?? "",
      email: lead.email,
      phone: lead.phone,
      address: (lead.address ?? {}) as Customer["address"],
      tags: [],
      lifecycle_stage: "prospect",
      total_visits: 0,
      total_spend: 0,
      last_visit_date: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Build a synthetic visit from the vehicle interest if available
  let recentVisit: Visit | null = null;
  if (lead.vehicle_interest) {
    const parts = lead.vehicle_interest.split(" ");
    const year = parts.find((p) => /^\d{4}$/.test(p));
    recentVisit = {
      id: "synthetic",
      dealership_id: ud.dealership_id,
      customer_id: lead.id,
      vin: null,
      make: parts.find((p) => p !== year && p.length > 2) ?? null,
      model: parts.slice(year ? 2 : 1).join(" ") || null,
      year: year ? parseInt(year, 10) : null,
      mileage: null,
      service_type: null,
      service_notes: lead.notes,
      technician: null,
      ro_number: null,
      total_amount: null,
      visit_date: lead.metadata?.request_date as string ?? new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  try {
    const result = await runCreativeAgent({
      context: {
        dealershipId: ud.dealership_id,
        dealershipName: dealership?.name ?? "the dealership",
      },
      customer,
      recentVisit,
      channel,
      campaignGoal: body.campaign_goal ?? `Follow up on ${lead.source} inquiry`,
      dealershipTone: "friendly, helpful, not salesy",
      dealershipProfile: {
        phone: dealership?.phone,
        address: dealership?.address as Customer["address"],
        hours: dealership?.hours,
        logo_url: dealership?.logo_url,
        website_url: dealership?.website_url,
      },
    });

    return NextResponse.json({
      success: true,
      draft: {
        content: result.content,
        subject: result.subject,
        channel,
        reasoning: result.reasoning,
        confidence: result.confidence,
        guardrails_applied: result.guardrailsApplied,
      },
      lead: {
        id: lead.id,
        name: `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim(),
        email: lead.email,
        phone: lead.phone,
        channel,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
