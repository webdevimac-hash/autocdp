import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/inventory/upload
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
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const body = await req.json();
    const rows = body.rows as Record<string, string>[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows required" }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    let upserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const vin = (row.vin || row.VIN || "").trim() || null;
      const make = (row.make || row.Make || "").trim() || null;
      const model = (row.model || row.Model || "").trim() || null;
      const year = parseInt(row.year || row.Year || "0", 10) || null;
      const price = parseFloat(row.price || row.Price || row.msrp || "0") || null;
      const mileage = parseInt(row.mileage || row.Mileage || row.odometer || "0", 10) || null;
      const condition = (row.condition || row.Condition || "used").toLowerCase();
      const daysOnLot = parseInt(row.days_on_lot || row.days || "0", 10) || 0;

      try {
        if (vin) {
          // Upsert by VIN
          await serviceClient.from("inventory").upsert({
            dealership_id: ud.dealership_id,
            vin,
            year,
            make,
            model,
            trim: row.trim || row.Trim || null,
            color: row.color || row.Color || null,
            mileage,
            condition: ["new", "used", "certified"].includes(condition) ? condition : "used",
            price,
            days_on_lot: daysOnLot,
            status: "available",
            metadata: {},
            updated_at: new Date().toISOString(),
          }, { onConflict: "vin,dealership_id" });
        } else {
          await serviceClient.from("inventory").insert({
            dealership_id: ud.dealership_id,
            year,
            make,
            model,
            trim: row.trim || null,
            color: row.color || null,
            mileage,
            condition: ["new", "used", "certified"].includes(condition) ? condition : "used",
            price,
            days_on_lot: daysOnLot,
            status: "available",
            metadata: {},
          });
        }
        upserted++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({ success: true, upserted, skipped });
  } catch (error) {
    console.error("[/api/inventory/upload]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
