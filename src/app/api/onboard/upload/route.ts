import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseDriveCentricName, DC_NULL_VALUES } from "@/lib/csv";
import { isSuperAdmin } from "@/lib/admin";

/**
 * POST /api/onboard/upload
 *
 * Body: { type: "customers" | "visits"; rows: Record<string, string>[] }
 *
 * customers — auto-detects source format:
 *
 *   DMS household (Braman / CDK / Reynolds — has CUST_NO, SOLD_DATE, SVC_DATE):
 *     • Batch upserts on dms_external_id → idempotent re-imports
 *     • Derives lifecycle_stage, tags, metadata from CSV fields
 *     • Inserts purchase + service visit records per row;
 *       the update_customer_stats trigger then corrects total_visits /
 *       total_spend / last_visit_date from real visit data
 *
 *   Generic CRM (DriveCentric, Elead, DealerSocket …):
 *     • Deduplicates on email | phone | first+last+zip
 *     • Normalises email / phone / state / zip
 *
 * visits — links rows to existing customers via email / phone / explicit id.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { type, rows, targetDealershipId } = body as {
      type: "customers" | "visits";
      rows: Record<string, string>[];
      targetDealershipId?: string;
    };

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single() as { data: { dealership_id: string } | null };

    // Super-admin can upload to any dealership via targetDealershipId
    const resolvedId =
      targetDealershipId && isSuperAdmin(user.email)
        ? targetDealershipId
        : ud?.dealership_id;

    if (!resolvedId) {
      return NextResponse.json({ error: "No dealership found" }, { status: 400 });
    }

    const resolvedUd = { dealership_id: resolvedId };

    if (!type || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "type and rows are required" }, { status: 400 });
    }

    const svc = createServiceClient();
    let inserted = 0;
    let skipped  = 0;
    const errors: { row: number; field?: string; message: string }[] = [];

    // ── Helpers ────────────────────────────────────────────────────────────────

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

    function normaliseKeys(raw: Record<string, string>): Record<string, string> {
      return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]));
    }

    function normalizeEmail(raw: string): string | null {
      const v = raw.trim().toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
    }

    function normalizePhone(raw: string): string | null {
      const d = raw.replace(/\D/g, "");
      if (d.length === 11 && d.startsWith("1")) return `+${d}`;
      if (d.length === 10) return `+1${d}`;
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
      const d = raw.trim().replace(/\D/g, "");
      if (d.length === 5) return d;
      if (d.length === 9) return d.slice(0, 5);
      if (d.length === 4) return "0" + d;
      return null;
    }

    function parseDate(raw: string): string | null {
      if (!raw) return null;
      const d = new Date(raw.trim().replace(/\//g, "-"));
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
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
      const yr = new Date().getFullYear();
      return isNaN(n) || n < 1980 || n > yr + 2 ? null : n;
    }

    type LifecycleStage = "prospect" | "active" | "at_risk" | "lapsed" | "vip";

    // Lifecycle from CRM stage string (DriveCentric)
    function mapLifecycleStage(raw: string): LifecycleStage {
      switch (raw.trim().toLowerCase()) {
        case "active": case "customer": case "won": return "active";
        case "dead": case "lost": case "no follow-up": return "lapsed";
        case "at risk": return "at_risk";
        case "vip": return "vip";
        default: return "prospect";
      }
    }

    // Lifecycle from last-visit recency + spend (DMS household)
    function deriveLifecycleFromRecency(
      lastVisitDate: string | null,
      totalSpend: number,
    ): LifecycleStage {
      if (!lastVisitDate) return "prospect";
      const days = (Date.now() - new Date(lastVisitDate).getTime()) / 86_400_000;
      if (totalSpend >= 40_000 && days <= 365) return "vip";
      if (days <= 180) return "active";
      if (days <= 540) return "at_risk";
      return "lapsed";
    }

    // Auto-generated tags from DMS row data
    function deriveDmsTags(
      row: Record<string, string>,
      daysSince: number | null,
      price: number,
    ): string[] {
      const tags = new Set<string>(["dms_import"]);

      const soldType = col(row, "sold_type").toUpperCase();
      const dealType = col(row, "dealtype").toUpperCase();

      if (dealType === "P" || soldType) tags.add("buyer");
      if (soldType === "N") tags.add("new_car_buyer");
      else if (soldType === "U") tags.add("used_car_buyer");

      const make = col(row, "make").toLowerCase().replace(/[\s-]+/g, "_");
      if (make) tags.add(`${make}_owner`);

      const vt = col(row, "vehicletype").toLowerCase();
      if (vt.includes("multipurpose") || vt.includes("mpv")) tags.add("suv_owner");
      else if (vt.includes("passenger"))                      tags.add("sedan_owner");
      else if (vt.includes("truck"))                          tags.add("truck_owner");

      const term    = parseInt(col(row, "term"), 10);
      const payment = parseAmount(col(row, "payment")) ?? 0;
      if (!isNaN(term) && term > 0 && payment > 0) tags.add("financed");
      else if (price > 0)                          tags.add("cash_buyer");

      if (daysSince !== null) {
        if (daysSince <= 90)  tags.add("recent_customer");
        if (daysSince > 365)  tags.add("service_due");
      }

      return [...tags];
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CUSTOMERS
    // ══════════════════════════════════════════════════════════════════════════

    if (type === "customers") {

      // Detect DMS household format (CUST_NO + date columns present)
      const firstRow = normaliseKeys(rows[0]);
      const isDmsHousehold =
        firstRow.cust_no !== undefined ||
        (firstRow.sold_date !== undefined && firstRow.svc_date !== undefined);

      // ── DMS FAST PATH — merge-aware upsert + visit records ──────────────
      if (isDmsHousehold) {
        type CustRow  = Record<string, unknown>;
        type VisitRow = Record<string, unknown>;

        // ── Step 1: pre-fetch existing customers by email / phone ─────────
        // Collect normalised emails + phones from every row in this batch
        const batchEmails: string[] = [];
        const batchPhones: string[] = [];
        for (const rawRow of rows) {
          const r = normaliseKeys(rawRow);
          const e = normalizeEmail(col(r, "email"));
          if (e) batchEmails.push(e);
          for (const raw of [col(r, "phonecell"), col(r, "phone"), col(r, "phone2")]) {
            if (raw) { const p = normalizePhone(raw); if (p) { batchPhones.push(p); break; } }
          }
        }

        // Two parallel lookups — deduplicate values to keep IN clauses small
        type ExistingRow = { id: string; email: string | null; phone: string | null };
        const [emailLookup, phoneLookup] = await Promise.all([
          batchEmails.length > 0
            ? svc.from("customers")
                .select("id, email, phone")
                .eq("dealership_id", resolvedUd.dealership_id)
                .in("email", [...new Set(batchEmails)])
            : Promise.resolve({ data: [] as ExistingRow[] }),
          batchPhones.length > 0
            ? svc.from("customers")
                .select("id, email, phone")
                .eq("dealership_id", resolvedUd.dealership_id)
                .in("phone", [...new Set(batchPhones)])
            : Promise.resolve({ data: [] as ExistingRow[] }),
        ]);

        const emailToId = new Map<string, string>();
        const phoneToId = new Map<string, string>();
        for (const c of [
          ...((emailLookup as { data: ExistingRow[] | null }).data ?? []),
          ...((phoneLookup  as { data: ExistingRow[] | null }).data ?? []),
        ]) {
          if (c.email) emailToId.set(c.email.toLowerCase(), c.id);
          if (c.phone) phoneToId.set(c.phone, c.id); // already E.164 in DB
        }

        // ── Step 2: build per-row enriched data; split update vs insert ───
        const custsToUpdate: CustRow[] = []; // existing rows → backfill derived fields
        const custsToInsert: CustRow[] = []; // net-new rows
        const visitsByCustNo = new Map<string, VisitRow[]>();

        for (const rawRow of rows) {
          const row = normaliseKeys(rawRow);

          // Name
          let firstName = col(row, "first_name", "first name", "first");
          let lastName  = col(row, "last_name",  "last name",  "last");
          if (!firstName && !lastName) {
            const rawCust = row["customer"] ?? "";
            if (rawCust.trim()) {
              const p = parseDriveCentricName(rawCust);
              firstName = p.firstName; lastName = p.lastName;
            }
          }
          if (!firstName && !lastName) { skipped++; continue; }

          // Contact — prefer PHONECELL (SMS-capable)
          const rawEmail = col(row, "email");
          const email    = rawEmail ? normalizeEmail(rawEmail) : null;
          let phone: string | null = null;
          for (const raw of [col(row, "phonecell"), col(row, "phone"), col(row, "phone2")]) {
            if (raw) { phone = normalizePhone(raw); if (phone) break; }
          }

          // Address
          const rawStreet = col(row, "address 1", "street", "address");
          const rawCity   = col(row, "city");
          const rawState  = col(row, "state");
          const rawZip    = col(row, "zip", "postal_code");
          const zip   = normalizeZip(rawZip)    ?? rawZip.trim();
          const state = normalizeState(rawState) ?? (rawState.trim().toUpperCase() || undefined);
          const address: Record<string, string> = {};
          if (rawStreet) address.street = rawStreet;
          if (rawCity)   address.city   = rawCity;
          if (state)     address.state  = state;
          if (zip)       address.zip    = zip;

          // Vehicle
          const vYear    = parseYear(col(row, "year"));
          const vMake    = col(row, "make");
          const vModel   = col(row, "model");
          const vVin     = col(row, "vin");
          const stockNo  = col(row, "stockno");
          const vMileage = parseMileage(col(row, "mileage"));

          // Dates
          const soldDate = parseDate(col(row, "sold_date", "del_date"));
          const svcDate  = parseDate(col(row, "svc_date"));
          const lastDate = parseDate(col(row, "last_date"));
          const uniqueDates = [...new Set([soldDate, svcDate, lastDate].filter(Boolean) as string[])].sort();
          const lastVisitDate = uniqueDates.at(-1) ?? null;
          const daysSince = lastVisitDate
            ? (Date.now() - new Date(lastVisitDate).getTime()) / 86_400_000
            : null;

          // Visit count
          const hasSale = !!soldDate;
          const hasSvc  = !!(svcDate && svcDate !== soldDate);
          const totalVisits = hasSale || hasSvc
            ? (hasSale ? 1 : 0) + (hasSvc ? 1 : 0)
            : lastVisitDate ? 1 : 0;

          // Spend
          const price   = parseAmount(col(row, "price")) ?? 0;
          const svcAmt  = parseAmount(col(row, "lastsvcamount")) ?? 0;
          const pmtTerm = (() => {
            const pmt  = parseAmount(col(row, "payment")) ?? 0;
            const term = parseInt(col(row, "term"), 10);
            return pmt > 0 && !isNaN(term) && term > 0 ? pmt * term : 0;
          })();
          const totalSpend = price > 0 ? price + svcAmt : pmtTerm + svcAmt;

          // Lifecycle + tags
          const lifecycleStage = deriveLifecycleFromRecency(lastVisitDate, totalSpend);
          const tags           = deriveDmsTags(row, daysSince, price);

          // Metadata
          const term    = parseInt(col(row, "term"), 10);
          const payment = parseAmount(col(row, "payment")) ?? 0;
          const apr     = parseAmount(col(row, "apr"));
          const metadata: Record<string, unknown> = { import_source: "braman_dms" };
          if (vMake || vModel || vVin) {
            metadata.current_vehicle = {
              year: vYear, make: vMake || null, model: vModel || null,
              vin: vVin || null, stock_no: stockNo || null,
              mileage: vMileage, vehicle_type: col(row, "vehicletype") || null,
            };
          }
          if (price > 0 || col(row, "dealtype")) {
            metadata.deal = {
              type:      col(row, "dealtype")  || null,
              sold_type: col(row, "sold_type") || null,
              price:     price  || null,
              payment:   payment || null,
              term:      (!isNaN(term) && term > 0) ? term : null,
              apr,
              del_date:  soldDate,
              term_end:  parseDate(col(row, "termend")),
              trade_vin: col(row, "soldtradevin") || null,
            };
          }
          const salesRep = col(row, "salesname", "sls");
          if (salesRep)   metadata.sales_rep             = salesRep;
          if (svcAmt > 0) metadata.last_service_amount   = svcAmt;

          // DMS ID
          const custNo = col(row, "cust_no");
          const dmsId  = custNo ? `braman_dms:${custNo}` : null;

          const custRow: CustRow = {
            dealership_id:   resolvedUd.dealership_id,
            dms_external_id: dmsId,
            first_name:      firstName || "Unknown",
            last_name:       lastName  || "",
            email:           email  ?? null,
            phone:           phone  ?? null,
            address:         Object.keys(address).length > 0 ? address : {},
            lifecycle_stage: lifecycleStage,
            total_visits:    totalVisits,
            total_spend:     totalSpend,
            last_visit_date: lastVisitDate,
            tags,
            metadata,
          };

          // Route: update existing (backfill) or insert new
          const existingId =
            (email && emailToId.get(email)) ||
            (phone && phoneToId.get(phone));

          if (existingId) {
            custsToUpdate.push({ ...custRow, id: existingId });
          } else {
            custsToInsert.push(custRow);
          }

          // Visit records
          if (custNo) {
            const visits: VisitRow[] = [];
            if (soldDate) {
              const st = col(row, "sold_type").toUpperCase();
              visits.push({
                dealership_id:   resolvedUd.dealership_id,
                dms_external_id: `braman_dms:sale:${custNo}:${soldDate}`,
                vin: vVin || null, make: vMake || null, model: vModel || null,
                year: vYear, mileage: parseMileage(col(row, "del_miles")),
                service_type:  "purchase",
                service_notes: st === "N" ? "New vehicle sale"
                              : st === "U" ? "Used vehicle sale"
                              : "Vehicle sale",
                total_amount: price || null,
                visit_date:   soldDate,
              });
            }
            if (svcDate && svcDate !== soldDate) {
              visits.push({
                dealership_id:   resolvedUd.dealership_id,
                dms_external_id: `braman_dms:svc:${custNo}:${svcDate}`,
                vin: vVin || null, make: vMake || null, model: vModel || null,
                year: vYear, mileage: vMileage,
                service_type: "service",
                total_amount: svcAmt || null,
                visit_date:   svcDate,
              });
            }
            if (visits.length > 0) visitsByCustNo.set(custNo, visits);
          }
        }

        // ── Step 3: execute database writes ──────────────────────────────
        skipped += rows.length - custsToUpdate.length - custsToInsert.length;
        const allUpserted: Array<{ id: string; dms_external_id: string | null }> = [];

        // Update existing customers: backfill dms_external_id + all derived fields
        if (custsToUpdate.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: updated, error: updateErr } = await (svc
            .from("customers")
            .upsert(custsToUpdate as any, { onConflict: "id" })
            .select("id, dms_external_id") as any) as {
              data: Array<{ id: string; dms_external_id: string | null }> | null;
              error: { message: string } | null;
            };
          if (updateErr) {
            errors.push({ row: 0, message: `Merge update failed: ${updateErr.message}` });
          } else {
            allUpserted.push(...(updated ?? []));
            inserted += updated?.length ?? 0;
          }
        }

        // Insert net-new customers
        if (custsToInsert.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newRows, error: insertErr } = await (svc
            .from("customers")
            .upsert(custsToInsert as any, { onConflict: "dealership_id,dms_external_id" })
            .select("id, dms_external_id") as any) as {
              data: Array<{ id: string; dms_external_id: string | null }> | null;
              error: { message: string } | null;
            };
          if (insertErr) {
            errors.push({ row: 0, message: `Customer insert failed: ${insertErr.message}` });
            skipped += custsToInsert.length;
          } else {
            allUpserted.push(...(newRows ?? []));
            inserted += newRows?.length ?? 0;
          }
        }

        // ── Step 4: batch upsert visits; trigger corrects denorm stats ───
        const visitsToInsert: VisitRow[] = [];
        for (const c of allUpserted) {
          if (!c.dms_external_id) continue;
          const custNo = c.dms_external_id.replace("braman_dms:", "");
          for (const v of visitsByCustNo.get(custNo) ?? []) {
            visitsToInsert.push({ ...v, customer_id: c.id });
          }
        }
        if (visitsToInsert.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: visitErr } = await (svc
            .from("visits")
            .upsert(visitsToInsert as any, { onConflict: "dealership_id,dms_external_id" }) as any
          ) as { error: { message: string } | null };
          if (visitErr) {
            errors.push({ row: 0, message: `Visit upsert warning: ${visitErr.message}` });
          }
        }

      // ── GENERIC CRM PATH ──────────────────────────────────────────────────
      } else {
        const { data: existing } = await svc
          .from("customers")
          .select("email, phone, first_name, last_name, address")
          .eq("dealership_id", resolvedUd.dealership_id) as {
            data: {
              email: string | null; phone: string | null;
              first_name: string; last_name: string;
              address: Record<string, string> | null;
            }[] | null;
          };

        const emailSet   = new Set<string>();
        const phoneSet   = new Set<string>();
        const nameZipSet = new Set<string>();

        for (const c of existing ?? []) {
          if (c.email) emailSet.add(c.email.toLowerCase());
          if (c.phone) phoneSet.add(c.phone.replace(/\D/g, ""));
          const zip = c.address?.zip ?? "";
          if (c.first_name && c.last_name && zip) {
            nameZipSet.add(`${c.first_name.toLowerCase()}|${c.last_name.toLowerCase()}|${zip}`);
          }
        }

        for (let i = 0; i < rows.length; i++) {
          const row    = normaliseKeys(rows[i]);
          const rowNum = i + 1;

          try {
            // Name
            let firstName = col(row, "first_name", "first name", "first");
            let lastName  = col(row, "last_name",  "last name",  "last");

            if (!firstName && !lastName) {
              const rawCust = row["customer"] ?? "";
              if (rawCust.trim()) {
                const p = parseDriveCentricName(rawCust);
                firstName = p.firstName; lastName = p.lastName;
              }
            }

            // Contact
            const rawEmail = col(row, "email");
            const rawPhone = col(row, "cell phone", "phonecell", "phone", "mobile", "home phone");

            if (!firstName && !lastName && !rawEmail && !rawPhone) { skipped++; continue; }

            const email = rawEmail ? normalizeEmail(rawEmail) : null;
            let   phone: string | null = null;
            for (const raw of [
              col(row, "cell phone"), col(row, "phonecell"),
              col(row, "phone"),      col(row, "mobile"),
              col(row, "home phone"), col(row, "phone2"),
            ]) {
              if (raw) { phone = normalizePhone(raw); if (phone) break; }
            }

            if (rawEmail && !email)
              errors.push({ row: rowNum, field: "email", message: `Invalid email: "${rawEmail}"` });

            // Address
            const rawStreet = col(row, "address 1", "street", "address");
            const rawCity   = col(row, "city");
            const rawState  = col(row, "state");
            const rawZip    = col(row, "zip", "postal_code");

            const zip   = normalizeZip(rawZip)    ?? rawZip.trim();
            const state = normalizeState(rawState) ?? (rawState.toUpperCase() || undefined);

            // Dedup
            const isDup =
              (email && emailSet.has(email)) ||
              (phone && phoneSet.has(phone.replace(/\D/g, ""))) ||
              (firstName && lastName && zip &&
                nameZipSet.has(`${firstName.toLowerCase()}|${lastName.toLowerCase()}|${zip}`));

            if (isDup) { skipped++; continue; }

            const address: Record<string, string> = {};
            if (rawStreet) address.street = rawStreet;
            if (rawCity)   address.city   = rawCity;
            if (state)     address.state  = state;
            if (zip)       address.zip    = zip;

            const sourceDesc   = col(row, "source description", "lead_source");
            const currentStage = col(row, "current stage",      "lead_status");
            const lastNote     = col(row, "last note", "last deallog message", "service_notes");
            const store        = col(row, "store");
            const buyer        = col(row, "buyer");

            const extraMeta: Record<string, unknown> = {};
            if (sourceDesc)   extraMeta.lead_source  = sourceDesc;
            if (currentStage) extraMeta.lead_status  = currentStage;
            if (lastNote)     extraMeta.last_note     = lastNote.slice(0, 1000);
            if (store)        extraMeta.dms_store     = store;
            if (buyer)        extraMeta.assigned_to   = buyer;

            const lifecycleStage: LifecycleStage = currentStage
              ? mapLifecycleStage(currentStage)
              : "prospect";

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: insertErr } = await svc.from("customers").insert({
              dealership_id:   resolvedUd.dealership_id,
              first_name:      firstName || "Unknown",
              last_name:       lastName  || "",
              email:           email  ?? null,
              phone:           phone  ?? null,
              address:         Object.keys(address).length > 0 ? address : {},
              lifecycle_stage: lifecycleStage,
              total_visits:    0,
              total_spend:     0,
              tags:            [],
              metadata:        extraMeta,
            } as any);
            if (insertErr) throw new Error(insertErr.message);

            if (email) emailSet.add(email);
            if (phone) phoneSet.add(phone.replace(/\D/g, ""));
            if (firstName && lastName && zip) {
              nameZipSet.add(`${firstName.toLowerCase()}|${lastName.toLowerCase()}|${zip}`);
            }

            inserted++;
          } catch (err) {
            errors.push({ row: rowNum, message: err instanceof Error ? err.message : "Unknown error" });
            skipped++;
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // VISITS
    // ══════════════════════════════════════════════════════════════════════════

    else if (type === "visits") {
      const { data: existingCustomers } = await svc
        .from("customers")
        .select("id, email, phone")
        .eq("dealership_id", resolvedUd.dealership_id) as {
          data: { id: string; email: string | null; phone: string | null }[] | null;
        };

      const emailToId = new Map<string, string>();
      const phoneToId = new Map<string, string>();
      for (const c of existingCustomers ?? []) {
        if (c.email) emailToId.set(c.email.toLowerCase(), c.id);
        if (c.phone) phoneToId.set(c.phone.replace(/\D/g, ""), c.id);
      }

      const visitKeys = new Set<string>();
      const { data: existingVisits } = await svc
        .from("visits")
        .select("customer_id, visit_date, ro_number")
        .eq("dealership_id", resolvedUd.dealership_id) as {
          data: { customer_id: string; visit_date: string | null; ro_number: string | null }[] | null;
        };

      for (const v of existingVisits ?? []) {
        const d = v.visit_date?.slice(0, 10);
        if (d) visitKeys.add(`${v.customer_id}|${d}`);
        if (v.ro_number) visitKeys.add(`ro|${v.customer_id}|${v.ro_number}`);
      }

      for (let i = 0; i < rows.length; i++) {
        const row    = normaliseKeys(rows[i]);
        const rowNum = i + 1;

        try {
          const rawEmail = col(row, "email").toLowerCase();
          const rawPhone = col(row, "phone", "cell phone", "phonecell").replace(/\D/g, "");

          let customerId = col(row, "customer_id", "customer_uuid");
          if (!customerId && rawEmail) customerId = emailToId.get(rawEmail) ?? "";
          if (!customerId && rawPhone) customerId = phoneToId.get(rawPhone) ?? "";

          if (!customerId) {
            skipped++;
            errors.push({ row: rowNum, message: "No customer match — no id, email, or phone" });
            continue;
          }

          const rawDate = col(row, "visit_date", "date", "service_date", "svc_date");
          if (!rawDate) {
            skipped++;
            errors.push({ row: rowNum, field: "visit_date", message: "Missing visit date" });
            continue;
          }

          const visitDate = parseDate(rawDate);
          if (!visitDate) {
            skipped++;
            errors.push({ row: rowNum, field: "visit_date", message: `Bad date: "${rawDate}"` });
            continue;
          }

          const roNumber = col(row, "ro_number", "ro", "repair_order") || null;

          if (visitKeys.has(`${customerId}|${visitDate}`)) { skipped++; continue; }
          if (roNumber && visitKeys.has(`ro|${customerId}|${roNumber}`)) { skipped++; continue; }

          const rawAmount  = col(row, "total_amount", "total", "amount", "invoice_total", "lastsvcamount");
          const rawMileage = col(row, "mileage", "odometer");
          const rawYear    = col(row, "year");

          const amount  = rawAmount  ? parseAmount(rawAmount)   : null;
          const mileage = rawMileage ? parseMileage(rawMileage) : null;
          const year    = rawYear    ? parseYear(rawYear)       : null;

          if (rawAmount && amount === null)
            errors.push({ row: rowNum, field: "total_amount", message: `Invalid amount: "${rawAmount}"` });
          if (rawYear && year === null)
            errors.push({ row: rowNum, field: "year", message: `Year out of range: "${rawYear}"` });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertErr } = await svc.from("visits").insert({
            dealership_id: resolvedUd.dealership_id,
            customer_id:   customerId,
            vin:           col(row, "vin") || null,
            make:          col(row, "make") || null,
            model:         col(row, "model") || null,
            year, mileage,
            service_type:  col(row, "service_type", "service") || null,
            service_notes: col(row, "notes", "service_notes", "description") || null,
            technician:    col(row, "technician", "tech") || null,
            ro_number:     roNumber,
            total_amount:  amount,
            visit_date:    visitDate,
          } as any);

          if (insertErr) throw new Error(insertErr.message);

          visitKeys.add(`${customerId}|${visitDate}`);
          if (roNumber) visitKeys.add(`ro|${customerId}|${roNumber}`);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (svc.rpc as any)("increment_customer_visits", {
            p_customer_id: customerId,
            p_amount:      amount ?? 0,
          }).catch(() => null);

          inserted++;
        } catch (err) {
          errors.push({ row: rowNum, message: err instanceof Error ? err.message : "Unknown error" });
          skipped++;
        }
      }
    }

    return NextResponse.json({ success: true, inserted, skipped, errors: errors.slice(0, 50) });
  } catch (error) {
    console.error("[/api/onboard/upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
