import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/conquest/upload
 * Body: { rows: Record<string, string>[] }
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

    if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const body = await req.json();
    const rows = body.rows as Record<string, string>[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows required" }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const email = (row.email || row.Email || "").trim().toLowerCase() || null;
      const phone = (row.phone || row.Phone || "").trim().replace(/\D/g, "") || null;

      const address: Record<string, string> = {};
      if (row.street || row.address) address.street = (row.street || row.address || "").trim();
      if (row.city || row.City) address.city = (row.city || row.City || "").trim();
      if (row.state || row.State) address.state = (row.state || row.State || "").trim();
      if (row.zip || row.Zip) address.zip = (row.zip || row.Zip || "").trim();

      try {
        await serviceClient.from("conquest_leads").insert({
          dealership_id: ud.dealership_id,
          first_name: (row.first_name || row["First Name"] || "").trim() || null,
          last_name: (row.last_name || row["Last Name"] || "").trim() || null,
          email,
          phone: phone || null,
          address: Object.keys(address).length > 0 ? address : null,
          vehicle_interest: row.vehicle || row.vehicle_interest || row.interest || null,
          source: row.source || "import",
          score: parseInt(row.score || "0", 10) || 0,
          status: "new",
          notes: row.notes || null,
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
