/**
 * General CRM connector — covers Dealertrack, Elead, DealerSocket, DriveCentric, and others.
 *
 * Two ingestion paths:
 *   1. Generic REST API (if the CRM exposes a leads/contacts endpoint).
 *   2. CSV upload (dealer exports from their CRM and uploads via /api/integrations/general-crm/upload).
 *
 * Auth: API key + optional base URL (stored encrypted in dms_connections).
 *
 * Env vars:
 *   GENERAL_CRM_API_BASE  (default: https://api.generic-crm.example.com/v1)
 *   — overridden per-dealership via the baseUrl field in encrypted_tokens
 */

import { parseCsvRecords, parseDriveCentricName, DC_NULL_VALUES } from "@/lib/csv";

export const GENERAL_CRM_API_BASE =
  process.env.GENERAL_CRM_API_BASE ?? "https://api.generic-crm.example.com/v1";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

async function crmFetch<T>(
  path: string,
  apiKey: string,
  baseUrl: string,
  retries = 3
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return crmFetch(path, apiKey, baseUrl, retries - 1);
  }

  if (!res.ok) throw new Error(`General CRM API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Generic lead / contact shape (normalized across Dealertrack, Elead, DriveCentric, etc.)
// ---------------------------------------------------------------------------

export interface GeneralCrmLead {
  leadId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  leadSource?: string;
  leadStatus?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  vehicleInterest?: {
    year?: number;
    make?: string;
    model?: string;
    vin?: string;
  };
  lastNote?: string;
  lastActivityDate?: string;
  createdDate?: string;
  lastModifiedDate?: string;
}

export interface GeneralCrmLeadPage {
  items: GeneralCrmLead[];
  nextPageToken?: string;
}

export async function fetchGeneralCrmLeads(
  apiKey: string,
  baseUrl: string,
  since?: string,
  pageToken?: string
): Promise<GeneralCrmLeadPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return crmFetch<GeneralCrmLeadPage>(`/leads?${params}`, apiKey, baseUrl);
}

export interface GeneralCrmActivity {
  activityId: string;
  leadId: string;
  activityType: string;
  notes?: string;
  activityDate: string;
}

export interface GeneralCrmActivityPage {
  items: GeneralCrmActivity[];
  nextPageToken?: string;
}

export async function fetchGeneralCrmActivities(
  apiKey: string,
  baseUrl: string,
  since?: string,
  pageToken?: string
): Promise<GeneralCrmActivityPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return crmFetch<GeneralCrmActivityPage>(`/activities?${params}`, apiKey, baseUrl);
}

// ---------------------------------------------------------------------------
// CSV parsing — dealer-exported leads / customers file
//
// Natively understands two formats:
//
//  A) Standard format (Dealertrack, Elead, generic):
//       first_name, last_name, email, phone, lead_source, lead_status,
//       street, city, state, zip, vehicle_year, vehicle_make, vehicle_model,
//       vehicle_vin, created_date, last_modified_date
//
//  B) DriveCentric format:
//       Customer (multi-line "ML\n\nMiyah Lowe"), Store, Created,
//       Source, Source Description, Cell Phone, Home Phone, Phone,
//       Address 1, Address 2, City, State, Zip,
//       Current Stage, Last Note, Last DealLog Message, ...
//
// Column matching is case-insensitive and space-normalised.
// The parser uses an RFC 4180-compliant CSV reader that handles
// multi-line quoted fields — safe for DriveCentric exports.
// ---------------------------------------------------------------------------

/** Return first non-empty, non-DC-null value for any of the given normalised headers. */
function pick(
  row: string[],
  headerIndex: Map<string, number>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const idx = headerIndex.get(name);
    if (idx === undefined) continue;
    const v = (row[idx] ?? "").trim();
    if (v && !DC_NULL_VALUES.has(v.toLowerCase())) return v;
  }
  return undefined;
}

/** Normalise a header string the same way the parser does. */
function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseLeadsCsv(csv: string): GeneralCrmLead[] {
  const records = parseCsvRecords(csv);
  if (records.length < 2) return [];

  // Build a case-insensitive, space-normalised header index
  const rawHeaders = records[0].map((h) => h.trim());
  const headerIndex = new Map<string, number>();
  rawHeaders.forEach((h, i) => {
    headerIndex.set(normHeader(h), i);
    // Also store original (lower) so exact matches still work
    headerIndex.set(h.toLowerCase(), i);
  });

  const leads: GeneralCrmLead[] = [];

  records.slice(1).forEach((row, i) => {
    // ── Name ─────────────────────────────────────────────────────
    let firstName: string | undefined;
    let lastName:  string | undefined;

    // Standard columns first
    firstName = pick(row, headerIndex, "first_name");
    lastName  = pick(row, headerIndex, "last_name");

    if (!firstName && !lastName) {
      // DriveCentric combined "Customer" column
      const customerRaw = pick(row, headerIndex, "customer");
      if (customerRaw) {
        const parsed = parseDriveCentricName(customerRaw);
        if (parsed.firstName) firstName = parsed.firstName;
        if (parsed.lastName)  lastName  = parsed.lastName;
      }
    }

    if (!firstName && !lastName) {
      // Check Store column — some DriveCentric records shift the name there
      const storeRaw = pick(row, headerIndex, "store");
      if (storeRaw && /\n/.test(storeRaw)) {
        const parsed = parseDriveCentricName(storeRaw);
        if (parsed.firstName) firstName = parsed.firstName;
        if (parsed.lastName)  lastName  = parsed.lastName;
      }
    }

    // ── Contact ───────────────────────────────────────────────────
    const email = pick(row, headerIndex, "email");
    // DriveCentric: prefer Cell Phone for SMS, fall back to Phone / Home Phone
    const phone = pick(
      row, headerIndex,
      "cell_phone", "phone", "mobile", "home_phone"
    );

    // Skip entirely empty rows
    if (!firstName && !lastName && !email && !phone) return;

    // ── Lead identity ─────────────────────────────────────────────
    const leadId =
      pick(row, headerIndex, "lead_id", "id") ??
      pick(row, headerIndex, "dms_deal_no.", "dms_deal_no") ??
      `csv-row-${i + 2}`;

    // ── Address ───────────────────────────────────────────────────
    // Standard: street | DriveCentric: address_1 / address 1
    const street = pick(row, headerIndex, "street", "address_1", "address 1");
    const city   = pick(row, headerIndex, "city");
    const state  = pick(row, headerIndex, "state");
    const zip    = pick(row, headerIndex, "zip", "postal_code");

    // ── Lead metadata ─────────────────────────────────────────────
    // Standard: lead_source | DriveCentric: source_description
    const leadSource =
      pick(row, headerIndex, "lead_source") ??
      pick(row, headerIndex, "source_description", "source description");

    // Standard: lead_status | DriveCentric: current_stage
    const leadStatus =
      pick(row, headerIndex, "lead_status") ??
      pick(row, headerIndex, "current_stage", "current stage");

    // ── Vehicle interest ──────────────────────────────────────────
    const vehicleYearRaw = pick(row, headerIndex, "vehicle_year");
    const vehicleYear    = vehicleYearRaw ? parseInt(vehicleYearRaw, 10) : undefined;

    const vehicleInterest: GeneralCrmLead["vehicleInterest"] = {
      year:  isNaN(vehicleYear ?? NaN) ? undefined : vehicleYear,
      make:  pick(row, headerIndex, "vehicle_make"),
      model: pick(row, headerIndex, "vehicle_model"),
      vin:   pick(row, headerIndex, "vehicle_vin"),
    };

    const hasVehicleInterest = Object.values(vehicleInterest).some((v) => v !== undefined);

    // ── Notes (DriveCentric "Last Note" / "Last DealLog Message") ──
    const lastNote =
      pick(row, headerIndex, "last_note") ??
      pick(row, headerIndex, "last_deallog_message", "last deallog message");

    // ── Dates ─────────────────────────────────────────────────────
    // Ignore DriveCentric relative dates ("7 days ago") — they can't be parsed.
    function parseAbsoluteDate(raw: string | undefined): string | undefined {
      if (!raw) return undefined;
      if (/ago|yesterday|tomorrow/i.test(raw)) return undefined; // relative, skip
      const d = new Date(raw.trim().replace(/\//g, "-"));
      return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
    }

    const createdDate      = parseAbsoluteDate(pick(row, headerIndex, "created_date", "created"));
    const lastModifiedDate = parseAbsoluteDate(pick(row, headerIndex, "last_modified_date", "last_modified"));

    leads.push({
      leadId,
      firstName: firstName ?? "",
      lastName:  lastName  ?? "",
      email,
      phone,
      leadSource,
      leadStatus,
      address: (street || city || state || zip)
        ? { street, city, state, zip }
        : undefined,
      vehicleInterest: hasVehicleInterest ? vehicleInterest : undefined,
      lastNote,
      createdDate,
      lastModifiedDate,
    });
  });

  return leads;
}
