import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseDriveCentricName, DC_NULL_VALUES } from "@/lib/csv";

/**
 * POST /api/conquest/upload
 * Body: { rows: Record<string, string>[] }
 *
 * Accepts standard conquest columns AND DriveCentric CRM export format.
 *
 * DriveCentric columns handled:
 *   Customer        → first_name + last_name (parsed from "ML\n\nMiyah Lowe")
 *   Cell Phone      → phone (preferred over Phone / Home Phone)
 *   Address 1       → address.street
 *   Source Description → source
 *   Current Stage   → status (mapped to new/contacted/converted/disqualified)
 *   Last Note       → notes
 *
 * Standard columns (backward-compatible):
 *   first_name, last_name, email, phone, street/address, city, state, zip,
 *   vehicle_interest, source, score, notes
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
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const body = await req.json();
    const rows = body.rows as Record<string, string>[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows required" }, { status: 400 });
    }

    function col(row: Record<string, string>, ...keys: string[]): string {
      for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null) {
          const t = String(v).trim();
          if (t && !DC_NULL_VALUES.has(t.toLowerCase())) return t;
        }
      }
      return "";
    }

    function mapStage(raw: string): "new" | "contacted" | "converted" | "disqualified" {
      const s = raw.toLowerCase().trim();
      if (/sold|closed|converted|delivered|won/.test(s)) return "converted";
      if (/contact|working|in.progress|open|appt|appointment|follow/.test(s)) return "contacted";
      if (/dead|lost|disqualif|inactive|not.interest/.test(s)) return "disqualified";
      return "new";
    }

    const serviceClient = createServiceClient();
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      // ── Name ──────────────────────────────────────────────────────
      let firstName = col(row, "first_name", "First Name");
      let lastName  = col(row, "last_name",  "Last Name");

      if (!firstName && !lastName) {
        const customerRaw = row["Customer"] ?? "";
        if (customerRaw.trim()) {
          const parsed = parseDriveCentricName(customerRaw);
          firstName = parsed.firstName;
          lastName  = parsed.lastName;
        }
      }

      // ── Contact ───────────────────────────────────────────────────
      const rawEmail = col(row, "email", "Email");
      const email = rawEmail ? rawEmail.toLowerCase() : null;

      const rawPhone = col(row, "Cell Phone", "phone", "Phone", "mobile", "Home Phone");
      const phone = rawPhone ? rawPhone.replace(/\D/g, "") || null : null;

      // Skip entirely empty rows
      if (!firstName && !lastName && !email && !phone) {
        skipped++;
        continue;
      }

      // ── Address ───────────────────────────────────────────────────
      const street = col(row, "Address 1", "street", "address", "Address");
      const city   = col(row, "city", "City");
      const state  = col(row, "state", "State");
      const zip    = col(row, "zip", "Zip", "postal_code");

      const address = (street || city || state || zip)
        ? { street: street || null, city: city || null, state: state || null, zip: zip || null }
        : null;

      // ── Vehicle interest ──────────────────────────────────────────
      const vehicleInterest =
        col(row, "vehicle_interest", "vehicle", "interest", "Vehicle Interest") || null;

      // ── Source ────────────────────────────────────────────────────
      const source =
        col(row, "Source Description", "source_description", "source", "Source", "lead_source") ||
        "import";

      // ── Score ─────────────────────────────────────────────────────
      const scoreRaw = col(row, "score", "Score");
      const score    = Math.min(100, Math.max(0, parseInt(scoreRaw || "0", 10) || 0));

      // ── Status (from DriveCentric Current Stage) ──────────────────
      const stageRaw = col(row, "Current Stage", "current_stage", "status", "Status", "lead_status");
      const status   = stageRaw ? mapStage(stageRaw) : "new";

      // ── Notes ─────────────────────────────────────────────────────
      const notes =
        (col(row, "Last Note", "last_note", "notes", "Notes") || "").slice(0, 1000) || null;

      try {
        await serviceClient.from("conquest_leads").insert({
          dealership_id:    ud.dealership_id,
          first_name:       firstName || null,
          last_name:        lastName  || null,
          email,
          phone,
          address,
          vehicle_interest: vehicleInterest,
          source,
          score,
          status,
          notes,
          metadata: {},
        });
        inserted++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({ success: true, inserted, skipped });
  } catch (error) {
    console.error("[/api/conquest/upload]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
