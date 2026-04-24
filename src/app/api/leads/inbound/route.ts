/**
 * POST /api/leads/inbound
 *
 * Webhook for DealerFunnel, Xcel Media, and any ADF-compliant provider.
 * Accepts ADF 1.0 XML or JSON.
 *
 * On receipt:
 *   1. Parses the lead (ADF or JSON)
 *   2. Upserts a conquest_lead record
 *   3. Upserts a customers record (source: provider, or "dealerfunnel" from DealerFunnel)
 *   4. Enforces TCPA opt-out: if the lead carries an opt-out flag, marks the customer
 *      with tag "tcpa_optout" and skips any outbound sends.
 *   5. Optionally routes the ADF back to the dealer CRM (two-to-one)
 *
 * Auth: per-dealership secret stored in dealership.settings.inbound_lead_secret,
 *       passed as ?secret= query param or x-lead-secret / Authorization header.
 *       Falls back to global INBOUND_LEAD_SECRET env var if no per-dealer secret is set.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseAdf, parseJsonLead, detectBodyFormat } from "@/lib/leads/adf-parser";
import { routeLeadToCrm } from "@/lib/leads/adf-sender";
import type { ParsedLead } from "@/lib/leads/adf-parser";

const GLOBAL_SECRET = process.env.INBOUND_LEAD_SECRET ?? "";

function extractSecret(req: NextRequest): string {
  return (
    req.headers.get("x-lead-secret") ??
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    req.nextUrl.searchParams.get("secret") ??
    ""
  );
}

/** Detect TCPA/SMS opt-out from raw JSON body fields DealerFunnel may send. */
function detectOptOut(raw: Record<string, unknown>): boolean {
  const fields = [
    "opt_out", "optout", "tcpa_opt_out", "sms_opt_out", "email_opt_out",
    "unsubscribed", "do_not_contact", "dnc",
  ];
  for (const f of fields) {
    const v = raw[f];
    if (v === true || v === "true" || v === "1" || v === 1 || v === "yes") return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const dealershipSlug = req.nextUrl.searchParams.get("dealership");
  if (!dealershipSlug) {
    return NextResponse.json({ error: "Missing ?dealership= query param" }, { status: 400 });
  }

  const rawBody = await req.text();
  const fmt = detectBodyFormat(rawBody);

  let lead: ParsedLead;
  let rawJson: Record<string, unknown> = {};

  if (fmt === "adf") {
    lead = parseAdf(rawBody);
  } else if (fmt === "json") {
    try {
      rawJson = JSON.parse(rawBody) as Record<string, unknown>;
      lead = parseJsonLead(rawJson, dealershipSlug);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Unrecognized body format (expected ADF XML or JSON)" }, { status: 415 });
  }

  const svc = createServiceClient();

  // Load dealership
  type DealershipRow = {
    id: string; name: string; slug: string; phone: string | null;
    settings: Record<string, unknown>;
  } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("id, name, slug, phone, settings")
    .eq("slug", dealershipSlug)
    .single() as unknown as { data: DealershipRow };

  if (!dealership) {
    return NextResponse.json({ error: `Dealership '${dealershipSlug}' not found` }, { status: 404 });
  }

  // Auth: per-dealership secret or global fallback
  const dealerSecret = dealership.settings?.inbound_lead_secret as string | undefined;
  const expectedSecret = dealerSecret || GLOBAL_SECRET;
  if (expectedSecret) {
    const provided = extractSecret(req);
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const isOptOut = detectOptOut(rawJson);

  // Derive canonical source label
  const source = lead.source?.toLowerCase().includes("dealerfunnel")
    ? "dealerfunnel"
    : (lead.source || "adf_webhook");

  const vehicleInterest = lead.vehicle
    ? [lead.vehicle.year, lead.vehicle.make, lead.vehicle.model].filter(Boolean).join(" ")
    : null;

  // ── 1. Upsert conquest_lead ───────────────────────────────────
  type ConquestRow = { id: string } | null;
  const { data: conquestLead } = await svc
    .from("conquest_leads")
    .upsert(
      {
        dealership_id: dealership.id,
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        address: lead.address as Record<string, string>,
        vehicle_interest: vehicleInterest,
        source,
        score: 70,
        status: "new",
        notes: lead.comments,
        metadata: {
          external_id: lead.externalId,
          request_date: lead.requestDate,
          vehicle: lead.vehicle,
          phone_type: lead.phoneType,
          raw_format: fmt,
          tcpa_optout: isOptOut,
        },
      },
      { onConflict: "dealership_id,email", ignoreDuplicates: false }
    )
    .select("id")
    .single() as unknown as { data: ConquestRow };

  // ── 2. Upsert customers record ────────────────────────────────
  type CustomerRow = { id: string; tags: string[]; metadata: Record<string, unknown> } | null;

  let customerId: string | null = null;

  if (lead.email) {
    const { data: existing } = await svc
      .from("customers")
      .select("id, tags, metadata")
      .eq("dealership_id", dealership.id)
      .eq("email", lead.email)
      .maybeSingle() as unknown as { data: CustomerRow };

    if (existing) {
      customerId = existing.id;
      // Merge opt-out tag without duplicates
      const tags = Array.from(new Set([
        ...(existing.tags ?? []),
        ...(isOptOut ? ["tcpa_optout"] : []),
      ]));
      await svc.from("customers").update({
        first_name: lead.firstName ?? existing.metadata?.first_name,
        last_name: lead.lastName ?? existing.metadata?.last_name,
        phone: lead.phone ?? undefined,
        tags,
        metadata: {
          ...(existing.metadata ?? {}),
          source,
          tcpa_optout: isOptOut || (existing.metadata?.tcpa_optout as boolean) || false,
        },
      } as never).eq("id", existing.id);
    } else {
      const tags: string[] = ["prospect"];
      if (isOptOut) tags.push("tcpa_optout");

      const { data: newCustomer } = await svc
        .from("customers")
        .insert({
          dealership_id: dealership.id,
          first_name: lead.firstName ?? "",
          last_name: lead.lastName ?? "",
          email: lead.email,
          phone: lead.phone,
          address: lead.address ?? {},
          tags,
          lifecycle_stage: "prospect",
          total_visits: 0,
          total_spend: 0,
          metadata: {
            source,
            external_id: lead.externalId,
            vehicle_interest: vehicleInterest,
            tcpa_optout: isOptOut,
          },
        } as never)
        .select("id")
        .single() as unknown as { data: { id: string } | null };

      customerId = newCustomer?.id ?? null;
    }
  }

  // ── 3. Route to dealer CRM if configured ─────────────────────
  const settings = dealership.settings ?? {};
  const crmEmail = settings.crm_email as string | undefined;
  const crmEndpoint = settings.crm_webhook as string | undefined;

  let routingResult;
  if (crmEmail || crmEndpoint) {
    routingResult = await routeLeadToCrm(
      {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        address: lead.address,
        vehicleInterest,
        comments: lead.comments,
        source,
        externalId: lead.externalId,
      },
      {
        vendorName: "AutoCDP",
        dealershipName: dealership.name,
        primary: crmEmail
          ? { type: "email", toEmail: crmEmail, format: "adf" }
          : { type: "http", endpointUrl: crmEndpoint!, format: "adf" },
        fallback: crmEmail && crmEndpoint
          ? { type: "http", endpointUrl: crmEndpoint, format: "adf" }
          : undefined,
      }
    );
  }

  return NextResponse.json({
    success: true,
    conquest_lead_id: conquestLead?.id ?? null,
    customer_id: customerId,
    tcpa_optout: isOptOut,
    crm_routed: routingResult?.delivered ?? false,
    source,
    format: fmt,
  });
}
