/**
 * POST /api/integrations/general-crm/upload
 *
 * CSV upload endpoint for dealers who export leads from Dealertrack, Elead, etc.
 * Accepts multipart/form-data with a "file" field containing a CSV.
 * Parses the CSV and upserts as customers + visits via the sync engine pattern.
 *
 * Expected CSV headers (order flexible):
 *   first_name, last_name, email, phone, lead_source, lead_status,
 *   street, city, state, zip, vehicle_year, vehicle_make, vehicle_model,
 *   vehicle_vin, created_date, last_modified_date
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseLeadsCsv } from "@/lib/dms/general-crm";

export const dynamic = "force-dynamic";

function dmsId(leadId: string): string {
  return `general_crm:${leadId}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  if (!ud?.dealership_id) {
    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided. Send a CSV as form field 'file'." }, { status: 400 });
  }

  const csvText = await file.text();
  const leads = parseLeadsCsv(csvText);

  if (leads.length === 0) {
    return NextResponse.json({ error: "CSV contained no valid rows." }, { status: 400 });
  }

  let customerCount = 0;

  for (const batch of chunk(leads, 100)) {
    const rows = batch.map((l) => ({
      dealership_id: ud.dealership_id,
      dms_external_id: dmsId(l.leadId),
      first_name: l.firstName,
      last_name: l.lastName,
      email: l.email ?? null,
      phone: l.phone ?? null,
      address: l.address
        ? {
            street: l.address.street ?? null,
            city: l.address.city ?? null,
            state: l.address.state ?? null,
            zip: l.address.zip ?? null,
          }
        : null,
      lifecycle_stage: "prospect" as const,
      metadata: {
        dms_source: { provider: "general_crm", id: l.leadId },
        lead_source: l.leadSource ?? null,
        lead_status: l.leadStatus ?? null,
        vehicle_interest: l.vehicleInterest ?? null,
        last_note: l.lastNote ? l.lastNote.slice(0, 1000) : null,
        csv_import: true,
      },
    }));

    const { error } = await svc
      .from("customers")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });

    if (!error) customerCount += batch.length;
  }

  return NextResponse.json({
    ok: true,
    parsed: leads.length,
    upserted: customerCount,
  });
}
