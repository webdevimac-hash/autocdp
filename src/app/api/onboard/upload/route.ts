import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/onboard/upload
 *
 * Accepts parsed CSV rows for customers or visits.
 * Body: { type: "customers" | "visits"; rows: Record<string, string>[] }
 *
 * For customers: deduplicates on (email | phone) per dealership.
 * For visits: deduplicates on (customer_id, visit_date, ro_number).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single();

    if (!ud?.dealership_id) {
      return NextResponse.json({ error: "No dealership found" }, { status: 400 });
    }

    const body = await req.json();
    const { type, rows } = body as { type: "customers" | "visits"; rows: Record<string, string>[] };

    if (!type || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "type and rows are required" }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    if (type === "customers") {
      for (const row of rows) {
        try {
          const firstName = (row.first_name || row["First Name"] || row.first || "").trim();
          const lastName = (row.last_name || row["Last Name"] || row.last || "").trim();
          const email = (row.email || row.Email || "").trim().toLowerCase() || null;
          const phone = (row.phone || row.Phone || row.mobile || "").trim().replace(/\D/g, "") || null;

          if (!firstName && !lastName && !email && !phone) {
            skipped++;
            continue;
          }

          // Check for duplicate by email or phone
          if (email || phone) {
            let dupQuery = serviceClient
              .from("customers")
              .select("id")
              .eq("dealership_id", ud.dealership_id);

            if (email) dupQuery = dupQuery.eq("email", email);
            else if (phone) dupQuery = dupQuery.eq("phone", phone);

            const { data: existing } = await dupQuery.maybeSingle();
            if (existing) {
              skipped++;
              continue;
            }
          }

          const address: Record<string, string> = {};
          if (row.street || row.address || row.Address) address.street = (row.street || row.address || row.Address || "").trim();
          if (row.city || row.City) address.city = (row.city || row.City || "").trim();
          if (row.state || row.State) address.state = (row.state || row.State || "").trim();
          if (row.zip || row.Zip || row.postal_code) address.zip = (row.zip || row.Zip || row.postal_code || "").trim();

          await serviceClient.from("customers").insert({
            dealership_id: ud.dealership_id,
            first_name: firstName || "Unknown",
            last_name: lastName || "",
            email,
            phone: phone ? phone.slice(0, 20) : null,
            address: Object.keys(address).length > 0 ? address : {},
            lifecycle_stage: "prospect",
            total_visits: 0,
            total_spend: 0,
            tags: [],
            metadata: {},
          });
          inserted++;
        } catch (err) {
          errors.push(`Row ${inserted + skipped + 1}: ${err instanceof Error ? err.message : "Unknown error"}`);
          skipped++;
        }
      }
    } else if (type === "visits") {
      // Load customer map: email → id, phone → id
      const { data: existingCustomers } = await serviceClient
        .from("customers")
        .select("id, email, phone, first_name, last_name")
        .eq("dealership_id", ud.dealership_id);

      const emailToId = new Map<string, string>();
      const phoneToId = new Map<string, string>();
      for (const c of existingCustomers ?? []) {
        if (c.email) emailToId.set(c.email.toLowerCase(), c.id);
        if (c.phone) phoneToId.set(c.phone.replace(/\D/g, ""), c.id);
      }

      for (const row of rows) {
        try {
          const email = (row.email || row.Email || "").trim().toLowerCase();
          const phone = (row.phone || row.Phone || "").trim().replace(/\D/g, "");

          let customerId = row.customer_id || row.customer_uuid || "";
          if (!customerId && email) customerId = emailToId.get(email) ?? "";
          if (!customerId && phone) customerId = phoneToId.get(phone) ?? "";

          if (!customerId) {
            skipped++;
            errors.push(`Row ${inserted + skipped}: Could not match customer (no id, email, or phone match)`);
            continue;
          }

          const visitDate = row.visit_date || row.date || row.Date;
          if (!visitDate) { skipped++; continue; }

          const roNumber = row.ro_number || row.ro || row.repair_order || null;

          // Dedup on (customer_id, visit_date)
          const { data: dupVisit } = await serviceClient
            .from("visits")
            .select("id")
            .eq("customer_id", customerId)
            .eq("visit_date", visitDate)
            .maybeSingle();

          if (dupVisit) { skipped++; continue; }

          const amount = parseFloat(row.total || row.amount || row.invoice_total || "0") || null;
          const mileage = parseInt(row.mileage || row.odometer || "0", 10) || null;

          await serviceClient.from("visits").insert({
            dealership_id: ud.dealership_id,
            customer_id: customerId,
            vin: row.vin || row.VIN || null,
            make: row.make || row.Make || null,
            model: row.model || row.Model || null,
            year: parseInt(row.year || row.Year || "0", 10) || null,
            mileage,
            service_type: row.service_type || row.service || row.Service || null,
            service_notes: row.notes || row.service_notes || row.description || null,
            technician: row.technician || row.tech || null,
            ro_number: roNumber,
            total_amount: amount,
            visit_date: visitDate,
          });

          // Increment customer visit count
          await serviceClient.rpc("increment_customer_visits", {
            p_customer_id: customerId,
            p_amount: amount ?? 0,
          }).maybeSingle().catch(() => null);

          inserted++;
        } catch (err) {
          errors.push(`Row ${inserted + skipped + 1}: ${err instanceof Error ? err.message : "Unknown"}`);
          skipped++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error("[/api/onboard/upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
