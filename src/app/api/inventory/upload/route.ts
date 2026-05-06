import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseDriveCentricVehicle, DC_NULL_VALUES } from "@/lib/csv";

/**
 * POST /api/inventory/upload
 * Body: { rows: Record<string, string>[] }
 *
 * Accepts standard DMS inventory columns AND DriveCentric export format:
 *
 * DriveCentric columns handled:
 *   Vehicle      → year + make + model (parsed from combined string)
 *   Stock Number → unique upsert key when no VIN is present
 *   Pricing      → price
 *   Msrp         → also accepted for price fallback
 *   Age          → days_on_lot
 *   Sold         → status ("Yes" → "sold", otherwise "available")
 *   Trim         → trim (exact match to standard column)
 *   Mileage      → mileage (exact match to standard column)
 *
 * Standard columns (backward-compatible):
 *   vin, year, make, model, trim, color, mileage, price, condition, days_on_lot, status
 *
 * Condition is inferred from mileage when not explicitly provided:
 *   ≤ 500 miles  → "new"
 *   > 500 miles  → "used"
 *   Explicit column values "new" / "used" / "certified" always take precedence.
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
    const rows  = body.rows as Record<string, string>[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows required" }, { status: 400 });
    }

    const svc = createServiceClient();

    // ── Pre-load existing inventory for dedup / upsert ─────────
    // Builds two lookup maps so we avoid per-row DB queries.

    const { data: existing } = await svc
      .from("inventory")
      .select("id, vin, metadata")
      .eq("dealership_id", ud.dealership_id) as {
        data: { id: string; vin: string | null; metadata: Record<string, unknown> }[] | null;
      };

    const vinMap      = new Map<string, string>(); // normalised VIN → row id
    const stockNumMap = new Map<string, string>(); // normalised stock # → row id

    for (const v of existing ?? []) {
      if (v.vin) vinMap.set(v.vin.trim().toUpperCase(), v.id);
      const sn = v.metadata?.stock_number as string | undefined;
      if (sn) stockNumMap.set(sn.trim().toUpperCase(), v.id);
    }

    // ── Column helper (skips DC null sentinels) ─────────────────

    function col(...pairs: [Record<string, string>, ...string[]]): string {
      const [row, ...keys] = pairs;
      for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null) {
          const t = String(v).trim();
          if (t && !DC_NULL_VALUES.has(t.toLowerCase())) return t;
        }
      }
      return "";
    }

    // ── Condition inference ─────────────────────────────────────

    function inferCondition(
      explicit: string,
      mileage:  number | null
    ): "new" | "used" | "certified" {
      const v = explicit.toLowerCase();
      if (v === "new" || v === "used" || v === "certified") return v;
      if (mileage !== null && mileage <= 500) return "new";
      return "used";
    }

    // ── Process rows ────────────────────────────────────────────

    let upserted = 0;
    let skipped  = 0;
    const warnings: string[] = [];

    for (const row of rows) {

      // ── Identify columns ──────────────────────────────────────

      // VIN — standard only (DriveCentric list exports omit VIN)
      const vin      = col(row, "vin", "VIN") || null;

      // Stock Number — DriveCentric unique identifier
      const stockNum = col(row, "Stock Number", "stock_number", "stock_num") || null;

      if (!vin && !stockNum) {
        warnings.push("Row skipped — no VIN or Stock Number.");
        skipped++;
        continue;
      }

      // ── Vehicle identity (year / make / model) ────────────────
      let year:  number | null = null;
      let make:  string        = "";
      let model: string        = "";

      const vehicleRaw = col(row, "Vehicle", "vehicle");
      if (vehicleRaw) {
        // DriveCentric combined field: "2023 BMW X5"
        const parsed = parseDriveCentricVehicle(vehicleRaw);
        year  = parsed.year;
        make  = parsed.make;
        model = parsed.model;
      }

      // Explicit year / make / model override the parsed values
      const explicitYear = col(row, "year", "Year");
      if (explicitYear) {
        const n = parseInt(explicitYear, 10);
        if (!isNaN(n)) year = n;
      }
      const explicitMake  = col(row, "make", "Make");
      const explicitModel = col(row, "model", "Model");
      if (explicitMake)  make  = explicitMake;
      if (explicitModel) model = explicitModel;

      // ── Numeric fields ────────────────────────────────────────
      const mileageRaw = col(row, "Mileage", "mileage", "odometer");
      const mileage    = mileageRaw ? (parseInt(mileageRaw.replace(/[,\s]/g, ""), 10) || null) : null;

      // Price: prefer explicit price/Price, then Pricing (DC), then Msrp
      const priceRaw = col(row, "price", "Price", "Pricing", "Msrp", "msrp");
      const price    = priceRaw ? (parseFloat(priceRaw.replace(/[$,\s]/g, "")) || null) : null;

      // Days on lot: explicit days_on_lot, then "Age" (DriveCentric)
      const daysRaw   = col(row, "days_on_lot", "days", "Age", "age");
      const daysOnLot = daysRaw ? (parseInt(daysRaw, 10) || 0) : 0;

      // ── Status ────────────────────────────────────────────────
      // DriveCentric "Sold" column (Yes/No) → sold / available
      const soldRaw        = col(row, "Sold", "sold");
      const explicitStatus = col(row, "status", "Status");
      let status: "available" | "sold" | "reserved" | "pending";

      if (explicitStatus && ["available", "sold", "reserved", "pending"].includes(explicitStatus.toLowerCase())) {
        status = explicitStatus.toLowerCase() as typeof status;
      } else if (soldRaw.toLowerCase() === "yes") {
        status = "sold";
      } else {
        status = "available";
      }

      // ── Condition ─────────────────────────────────────────────
      const conditionRaw = col(row, "condition", "Condition");
      const condition    = inferCondition(conditionRaw, mileage);

      // ── Trim / Color ──────────────────────────────────────────
      const trim  = col(row, "Trim", "trim")   || null;
      const color = col(row, "color", "Color") || null;

      const payload = {
        dealership_id: ud.dealership_id,
        vin,
        year,
        make:       make  || null,
        model:      model || null,
        trim,
        color,
        mileage,
        condition,
        price,
        days_on_lot: daysOnLot,
        status,
        metadata:   stockNum ? { stock_number: stockNum } : {},
        updated_at: new Date().toISOString(),
      };

      try {
        if (vin) {
          // VIN-based update-or-insert using the pre-loaded map
          const existingId = vinMap.get(vin.toUpperCase());
          if (existingId) {
            const { error } = await svc
              .from("inventory")
              .update(payload)
              .eq("id", existingId);
            if (error) throw error;
          } else {
            const { error } = await svc.from("inventory").insert(payload);
            if (error) throw error;
            vinMap.set(vin.toUpperCase(), "pending");
          }
        } else {
          // Stock-number based update-or-insert (DriveCentric exports without VIN)
          const existingId = stockNumMap.get(stockNum!.toUpperCase());
          if (existingId) {
            const { error } = await svc
              .from("inventory")
              .update(payload)
              .eq("id", existingId);
            if (error) throw error;
          } else {
            const { error } = await svc.from("inventory").insert(payload);
            if (error) throw error;
          }
          if (stockNum) stockNumMap.set(stockNum.toUpperCase(), "pending");
        }

        upserted++;
      } catch (err) {
        warnings.push(
          `Row skipped — ${err instanceof Error ? err.message : String(err)}`
        );
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      upserted,
      skipped,
      inserted: upserted, // alias for CsvUploader compatibility
      warnings: warnings.slice(0, 20),
    });
  } catch (error) {
    console.error("[/api/inventory/upload]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
