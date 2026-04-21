import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/onboard/upload
 *
 * Accepts parsed CSV rows for customers or visits.
 * Body: { type: "customers" | "visits"; rows: Record<string, string>[] }
 *
 * Customers: deduplicates on (email | phone | first+last+zip) per dealership.
 *            Normalizes email, phone, state, zip before writing.
 * Visits:    deduplicates on (customer_id, visit_date) and (customer_id, ro_number).
 *            Validates date format and numeric fields before writing.
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
    const errors: { row: number; field?: string; message: string }[] = [];

    // ── Column helpers ─────────────────────────────────────────

    function col(row: Record<string, string>, ...keys: string[]): string {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) return String(row[k]).trim();
      }
      return "";
    }

    // ── Normalizers ────────────────────────────────────────────

    function normalizeEmail(raw: string): string | null {
      const v = raw.trim().toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
    }

    function normalizePhone(raw: string): string | null {
      const digits = raw.replace(/\D/g, "");
      // Accept 10-digit US or 11-digit with leading 1
      if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
      if (digits.length === 10) return digits;
      return null;
    }

    const US_STATES = new Set([
      "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
      "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
      "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
      "VA","WA","WV","WI","WY","DC",
    ]);

    function normalizeState(raw: string): string | null {
      const v = raw.trim().toUpperCase();
      return US_STATES.has(v) ? v : null;
    }

    function normalizeZip(raw: string): string | null {
      const digits = raw.trim().replace(/\D/g, "");
      if (digits.length === 5) return digits;
      if (digits.length === 9) return digits.slice(0, 5); // ZIP+4
      return null;
    }

    function parseDate(raw: string): string | null {
      if (!raw) return null;
      // Attempt ISO, M/D/Y, M-D-Y, etc.
      const cleaned = raw.trim().replace(/\//g, "-");
      const d = new Date(cleaned);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    function parseAmount(raw: string): number | null {
      const n = parseFloat(raw.replace(/[$,\s]/g, ""));
      return isNaN(n) || n < 0 ? null : n;
    }

    function parseMileage(raw: string): number | null {
      const n = parseInt(raw.replace(/[,\s]/g, ""), 10);
      return isNaN(n) || n < 0 || n > 1_000_000 ? null : n;
    }

    function parseYear(raw: string): number | null {
      const n = parseInt(raw, 10);
      const currentYear = new Date().getFullYear();
      return isNaN(n) || n < 1980 || n > currentYear + 1 ? null : n;
    }

    // ── Customers ──────────────────────────────────────────────

    if (type === "customers") {
      // Load existing email + phone set for fast dedup without per-row queries
      const { data: existing } = await serviceClient
        .from("customers")
        .select("email, phone, first_name, last_name, address")
        .eq("dealership_id", ud.dealership_id) as {
          data: { email: string | null; phone: string | null; first_name: string; last_name: string; address: Record<string, string> | null }[] | null;
        };

      const emailSet = new Set<string>();
      const phoneSet = new Set<string>();
      const nameZipSet = new Set<string>(); // "first|last|zip"

      for (const c of existing ?? []) {
        if (c.email) emailSet.add(c.email.toLowerCase());
        if (c.phone) phoneSet.add(c.phone.replace(/\D/g, ""));
        const zip = c.address?.zip ?? "";
        if (c.first_name && c.last_name && zip) {
          nameZipSet.add(`${c.first_name.toLowerCase()}|${c.last_name.toLowerCase()}|${zip}`);
        }
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;

        try {
          const firstName = col(row, "first_name", "First Name", "first");
          const lastName  = col(row, "last_name",  "Last Name",  "last");
          const rawEmail  = col(row, "email",  "Email");
          const rawPhone  = col(row, "phone",  "Phone",  "mobile");

          // Skip entirely empty rows
          if (!firstName && !lastName && !rawEmail && !rawPhone) {
            skipped++;
            continue;
          }

          // Normalize
          const email = rawEmail ? normalizeEmail(rawEmail) : null;
          const phone = rawPhone ? normalizePhone(rawPhone) : null;

          // Warn on invalid email/phone but don't skip (they may still have name)
          if (rawEmail && !email) {
            errors.push({ row: rowNum, field: "email", message: `Invalid email format: "${rawEmail}"` });
          }
          if (rawPhone && !phone) {
            errors.push({ row: rowNum, field: "phone", message: `Invalid phone (expected 10 digits): "${rawPhone}"` });
          }

          // Dedup by email, phone, or name+zip
          const rawState = col(row, "state", "State");
          const rawZip   = col(row, "zip",   "Zip",  "postal_code");
          const zip      = normalizeZip(rawZip) ?? rawZip.trim();

          const isDup =
            (email && emailSet.has(email)) ||
            (phone && phoneSet.has(phone)) ||
            (firstName && lastName && zip &&
              nameZipSet.has(`${firstName.toLowerCase()}|${lastName.toLowerCase()}|${zip}`));

          if (isDup) {
            skipped++;
            continue;
          }

          const rawStreet = col(row, "street", "address", "Address");
          const rawCity   = col(row, "city",   "City");
          const state     = normalizeState(rawState) ?? (rawState.toUpperCase() || undefined);

          const address: Record<string, string> = {};
          if (rawStreet)  address.street = rawStreet;
          if (rawCity)    address.city   = rawCity;
          if (state)      address.state  = state;
          if (zip)        address.zip    = zip;

          const newCustomer = {
            dealership_id:   ud.dealership_id,
            first_name:      firstName || "Unknown",
            last_name:       lastName  || "",
            email:           email ?? null,
            phone:           phone    ?? null,
            address:         Object.keys(address).length > 0 ? address : {},
            lifecycle_stage: "prospect",
            total_visits:    0,
            total_spend:     0,
            tags:            [],
            metadata:        {},
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertErr } = await serviceClient.from("customers").insert(newCustomer as any);
          if (insertErr) throw new Error(insertErr.message);

          // Update in-memory dedup sets so later rows in this batch don't duplicate
          if (email) emailSet.add(email);
          if (phone) phoneSet.add(phone);
          if (firstName && lastName && zip) {
            nameZipSet.add(`${firstName.toLowerCase()}|${lastName.toLowerCase()}|${zip}`);
          }

          inserted++;
        } catch (err) {
          errors.push({
            row: rowNum,
            message: err instanceof Error ? err.message : "Unknown error",
          });
          skipped++;
        }
      }
    }

    // ── Visits ─────────────────────────────────────────────────

    else if (type === "visits") {
      const { data: existingCustomers } = await serviceClient
        .from("customers")
        .select("id, email, phone")
        .eq("dealership_id", ud.dealership_id) as {
          data: { id: string; email: string | null; phone: string | null }[] | null;
        };

      const emailToId = new Map<string, string>();
      const phoneToId = new Map<string, string>();
      for (const c of existingCustomers ?? []) {
        if (c.email) emailToId.set(c.email.toLowerCase(), c.id);
        if (c.phone) phoneToId.set(c.phone.replace(/\D/g, ""), c.id);
      }

      // Cache existing visit keys per customer to avoid per-row DB queries
      const visitKeys = new Set<string>(); // "customerId|YYYY-MM-DD" and "customerId|ro_number"
      const { data: existingVisits } = await serviceClient
        .from("visits")
        .select("customer_id, visit_date, ro_number")
        .eq("dealership_id", ud.dealership_id) as {
          data: { customer_id: string; visit_date: string | null; ro_number: string | null }[] | null;
        };

      for (const v of existingVisits ?? []) {
        const date = v.visit_date?.slice(0, 10);
        if (date) visitKeys.add(`${v.customer_id}|${date}`);
        if (v.ro_number) visitKeys.add(`ro|${v.customer_id}|${v.ro_number}`);
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;

        try {
          const rawEmail  = col(row, "email", "Email").toLowerCase();
          const rawPhone  = col(row, "phone", "Phone").replace(/\D/g, "");

          let customerId = col(row, "customer_id", "customer_uuid");
          if (!customerId && rawEmail) customerId = emailToId.get(rawEmail) ?? "";
          if (!customerId && rawPhone) customerId = phoneToId.get(rawPhone) ?? "";

          if (!customerId) {
            skipped++;
            errors.push({ row: rowNum, message: "No customer match — no id, email, or phone found in your customer list" });
            continue;
          }

          const rawDate = col(row, "visit_date", "date", "Date", "service_date");
          if (!rawDate) {
            skipped++;
            errors.push({ row: rowNum, field: "visit_date", message: "Missing visit date" });
            continue;
          }

          const visitDate = parseDate(rawDate);
          if (!visitDate) {
            skipped++;
            errors.push({ row: rowNum, field: "visit_date", message: `Unrecognised date format: "${rawDate}"` });
            continue;
          }

          const roNumber = col(row, "ro_number", "ro", "repair_order") || null;

          // Dedup by visit_date or ro_number
          if (visitKeys.has(`${customerId}|${visitDate}`)) { skipped++; continue; }
          if (roNumber && visitKeys.has(`ro|${customerId}|${roNumber}`)) { skipped++; continue; }

          const rawAmount  = col(row, "total_amount", "total", "amount", "invoice_total");
          const rawMileage = col(row, "mileage", "odometer");
          const rawYear    = col(row, "year", "Year");

          const amount  = rawAmount  ? parseAmount(rawAmount)   : null;
          const mileage = rawMileage ? parseMileage(rawMileage) : null;
          const year    = rawYear    ? parseYear(rawYear)        : null;

          if (rawAmount && amount === null) {
            errors.push({ row: rowNum, field: "total_amount", message: `Invalid amount value: "${rawAmount}"` });
          }
          if (rawYear && year === null) {
            errors.push({ row: rowNum, field: "year", message: `Year out of valid range (1980–${new Date().getFullYear() + 1}): "${rawYear}"` });
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertErr } = await serviceClient.from("visits").insert({
            dealership_id: ud.dealership_id,
            customer_id:   customerId,
            vin:           col(row, "vin", "VIN")                   || null,
            make:          col(row, "make", "Make")                  || null,
            model:         col(row, "model", "Model")                || null,
            year,
            mileage,
            service_type:  col(row, "service_type", "service", "Service") || null,
            service_notes: col(row, "notes", "service_notes", "description") || null,
            technician:    col(row, "technician", "tech")            || null,
            ro_number:     roNumber,
            total_amount:  amount,
            visit_date:    visitDate,
          } as any);

          if (insertErr) throw new Error(insertErr.message);

          // Update in-memory dedup cache
          visitKeys.add(`${customerId}|${visitDate}`);
          if (roNumber) visitKeys.add(`ro|${customerId}|${roNumber}`);

          // Increment customer visit count + spend
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (serviceClient.rpc as any)("increment_customer_visits", {
            p_customer_id: customerId,
            p_amount:      amount ?? 0,
          }).catch(() => null);

          inserted++;
        } catch (err) {
          errors.push({
            row: rowNum,
            message: err instanceof Error ? err.message : "Unknown error",
          });
          skipped++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      // Return up to 50 structured errors so the UI can display them clearly
      errors: errors.slice(0, 50),
    });
  } catch (error) {
    console.error("[/api/onboard/upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
