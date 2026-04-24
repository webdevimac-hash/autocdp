/**
 * POST /api/leads/inbound
 *
 * Webhook endpoint for DealerFunnel, Xcel Media, and any ADF-compliant provider.
 * Accepts ADF 1.0 XML or JSON. Creates/upserts a conquest_lead and optionally
 * a customer record, then optionally routes the lead back to the dealer CRM.
 *
 * Auth: ?secret=INBOUND_LEAD_SECRET header or query param (shared webhook secret).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseAdf, parseJsonLead, detectBodyFormat } from "@/lib/leads/adf-parser";
import { routeLeadToCrm } from "@/lib/leads/adf-sender";
import type { ParsedLead } from "@/lib/leads/adf-parser";

const INBOUND_SECRET = process.env.INBOUND_LEAD_SECRET ?? "";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function verifySecret(req: NextRequest): boolean {
  if (!INBOUND_SECRET) return true; // secret not configured — open (dev only)
  const header = req.headers.get("x-lead-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  const query = req.nextUrl.searchParams.get("secret");
  return header === INBOUND_SECRET || query === INBOUND_SECRET;
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) return unauthorized();

  // Resolve dealership — from query param or body
  const dealershipSlug = req.nextUrl.searchParams.get("dealership");
  if (!dealershipSlug) {
    return NextResponse.json({ error: "Missing ?dealership= query param" }, { status: 400 });
  }

  const rawBody = await req.text();
  const fmt = detectBodyFormat(rawBody);

  let lead: ParsedLead;
  if (fmt === "adf") {
    lead = parseAdf(rawBody);
  } else if (fmt === "json") {
    try {
      lead = parseJsonLead(JSON.parse(rawBody), dealershipSlug);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Unrecognized body format (expected ADF XML or JSON)" }, { status: 415 });
  }

  const supabase = createServiceClient();

  // Look up dealership
  type DealershipRow = { id: string; name: string; phone: string | null; settings: Record<string, unknown> } | null;
  const { data: dealership } = await supabase
    .from("dealerships")
    .select("id, name, phone, settings")
    .eq("slug", dealershipSlug)
    .single() as unknown as { data: DealershipRow };

  if (!dealership) {
    return NextResponse.json({ error: `Dealership '${dealershipSlug}' not found` }, { status: 404 });
  }

  // Upsert conquest lead
  type ConquestRow = { id: string } | null;
  const { data: conquestLead } = await supabase
    .from("conquest_leads")
    .upsert(
      {
        dealership_id: dealership.id,
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        address: lead.address as Record<string, string>,
        vehicle_interest: lead.vehicle
          ? [lead.vehicle.year, lead.vehicle.make, lead.vehicle.model].filter(Boolean).join(" ")
          : null,
        source: lead.source,
        score: 70, // default score for inbound leads
        status: "new",
        notes: lead.comments,
        metadata: {
          external_id: lead.externalId,
          request_date: lead.requestDate,
          vehicle: lead.vehicle,
          phone_type: lead.phoneType,
          raw_format: fmt,
        },
      },
      {
        onConflict: "dealership_id,email",
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single() as unknown as { data: ConquestRow };

  // Optional: forward lead to dealer CRM if configured in dealership.settings
  const settings = dealership.settings ?? {};
  const crmEmail = settings.crm_email as string | undefined;
  const crmEndpoint = settings.crm_webhook as string | undefined;

  let routingResult;
  if (crmEmail || crmEndpoint) {
    const adfLead = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      vehicleInterest: lead.vehicle
        ? [lead.vehicle.year, lead.vehicle.make, lead.vehicle.model].filter(Boolean).join(" ")
        : null,
      comments: lead.comments,
      source: lead.source,
      externalId: lead.externalId,
    };

    routingResult = await routeLeadToCrm(adfLead, {
      vendorName: "AutoCDP",
      dealershipName: dealership.name,
      primary: crmEmail
        ? { type: "email", toEmail: crmEmail, format: "adf" }
        : { type: "http", endpointUrl: crmEndpoint!, format: "adf" },
      fallback: crmEmail && crmEndpoint
        ? { type: "http", endpointUrl: crmEndpoint, format: "adf" }
        : undefined,
    });
  }

  return NextResponse.json({
    success: true,
    conquest_lead_id: conquestLead?.id ?? null,
    crm_routed: routingResult?.delivered ?? false,
    format: fmt,
    lead: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
    },
  });
}
