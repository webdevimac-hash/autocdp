/**
 * POST /api/leads/export-adf
 *
 * Export conquest leads as ADF XML (or JSON) to the dealer's CRM.
 * Supports two-to-one routing: primary target + optional fallback.
 *
 * Body: {
 *   lead_ids?: string[];      // specific leads (omit for all "new" leads)
 *   primary: CrmDeliveryTarget;
 *   fallback?: CrmDeliveryTarget;
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { conquestLeadToAdf, routeLeadToCrm } from "@/lib/leads/adf-sender";
import type { CrmDeliveryTarget } from "@/lib/leads/adf-sender";
import type { ConquestLead } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    lead_ids?: string[];
    primary: CrmDeliveryTarget;
    fallback?: CrmDeliveryTarget;
  };

  const { lead_ids, primary, fallback } = body;
  if (!primary?.type) {
    return NextResponse.json({ error: "primary delivery target is required" }, { status: 400 });
  }

  const svc = createServiceClient();

  type UdRow = { dealership_id: string } | null;
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  type DealershipRow = { name: string; phone: string | null } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("name, phone")
    .eq("id", ud.dealership_id)
    .single() as unknown as { data: DealershipRow };

  // Fetch leads
  let query = svc
    .from("conquest_leads")
    .select("*")
    .eq("dealership_id", ud.dealership_id);

  if (lead_ids?.length) {
    query = query.in("id", lead_ids);
  } else {
    query = query.eq("status", "new");
  }

  const { data: leads } = await query as unknown as { data: ConquestLead[] | null };
  if (!leads?.length) {
    return NextResponse.json({ success: true, exported: 0, message: "No leads to export" });
  }

  // Route each lead
  const results = await Promise.allSettled(
    leads.map((lead) =>
      routeLeadToCrm(conquestLeadToAdf(lead), {
        vendorName: "AutoCDP",
        dealershipName: dealership?.name,
        primary,
        fallback,
      })
    )
  );

  let exported = 0;
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && r.value.delivered) {
      exported++;
      // Mark lead as contacted after successful export
      await svc
        .from("conquest_leads")
        .update({ status: "contacted" } as never)
        .eq("id", leads[i].id);
    } else {
      const err = r.status === "rejected"
        ? String(r.reason)
        : (r.value.fallbackResult?.error ?? r.value.primaryResult.error ?? "unknown");
      errors.push(`Lead ${leads[i].id}: ${err}`);
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    exported,
    failed: leads.length - exported,
    errors: errors.slice(0, 10),
  });
}
