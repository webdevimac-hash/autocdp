/**
 * General CRM connector — covers Dealertrack, Elead, DealerSocket, and others.
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

  if (!res.ok) {
    throw new Error(`General CRM API ${path} → ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Generic lead / contact shape (normalized across Dealertrack, Elead, etc.)
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
// CSV parsing — dealer-exported leads file
//
// Expected columns (order flexible, matched by header name):
//   first_name, last_name, email, phone, lead_source, lead_status,
//   street, city, state, zip, vehicle_year, vehicle_make, vehicle_model,
//   vehicle_vin, created_date, last_modified_date
// ---------------------------------------------------------------------------

export function parseLeadsCsv(csv: string): GeneralCrmLead[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const col = (row: string[], name: string): string | undefined => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? (row[idx]?.trim() || undefined) : undefined;
  };

  return lines.slice(1).map((line, i): GeneralCrmLead => {
    // Handle quoted CSV values naively (no embedded commas in quotes)
    const row = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    return {
      leadId: col(row, "lead_id") ?? col(row, "id") ?? `csv-row-${i + 2}`,
      firstName: col(row, "first_name") ?? "",
      lastName: col(row, "last_name") ?? "",
      email: col(row, "email"),
      phone: col(row, "phone"),
      leadSource: col(row, "lead_source"),
      leadStatus: col(row, "lead_status"),
      address: {
        street: col(row, "street"),
        city: col(row, "city"),
        state: col(row, "state"),
        zip: col(row, "zip"),
      },
      vehicleInterest: {
        year: col(row, "vehicle_year") ? parseInt(col(row, "vehicle_year")!, 10) : undefined,
        make: col(row, "vehicle_make"),
        model: col(row, "vehicle_model"),
        vin: col(row, "vehicle_vin"),
      },
      createdDate: col(row, "created_date"),
      lastModifiedDate: col(row, "last_modified_date"),
    };
  }).filter((l) => l.firstName || l.lastName || l.email);
}
