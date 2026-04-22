/**
 * VinSolutions CRM API client.
 *
 * Auth: API key + dealer ID (X-Api-Key + X-Dealer-Id headers).
 * Data: Contacts (customers), Leads, Activities, Email engagement history.
 *
 * Env vars:
 *   VINSOLUTIONS_API_BASE  (default: https://api.vinsolutions.com/v2)
 *   — actual keys stored per-dealership in dms_connections.encrypted_tokens
 */

export const VINSOLUTIONS_API_BASE =
  process.env.VINSOLUTIONS_API_BASE ?? "https://api.vinsolutions.com/v2";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

async function vinFetch<T>(
  path: string,
  apiKey: string,
  dealerId: string,
  retries = 3
): Promise<T> {
  const res = await fetch(`${VINSOLUTIONS_API_BASE}${path}`, {
    headers: {
      "X-Api-Key": apiKey,
      "X-Dealer-Id": dealerId,
      Accept: "application/json",
    },
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return vinFetch(path, apiKey, dealerId, retries - 1);
  }

  if (!res.ok) {
    throw new Error(`VinSolutions API ${path} → ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Contacts (→ customers)
// ---------------------------------------------------------------------------

export interface VinContact {
  contactId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  lastModifiedDate?: string;
}

export interface VinContactPage {
  items: VinContact[];
  nextPageToken?: string;
}

export async function fetchVinContacts(
  apiKey: string,
  dealerId: string,
  since?: string,
  pageToken?: string
): Promise<VinContactPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return vinFetch<VinContactPage>(`/contacts?${params}`, apiKey, dealerId);
}

// ---------------------------------------------------------------------------
// Leads (→ customers with lifecycle_stage = "prospect")
// ---------------------------------------------------------------------------

export interface VinLead {
  leadId: string;
  contactId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  leadSource?: string;
  leadStatus?: string;
  vehicleInterest?: {
    year?: number;
    make?: string;
    model?: string;
    vin?: string;
  };
  createdDate?: string;
  lastModifiedDate?: string;
}

export interface VinLeadPage {
  items: VinLead[];
  nextPageToken?: string;
}

export async function fetchVinLeads(
  apiKey: string,
  dealerId: string,
  since?: string,
  pageToken?: string
): Promise<VinLeadPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return vinFetch<VinLeadPage>(`/leads?${params}`, apiKey, dealerId);
}

// ---------------------------------------------------------------------------
// Activities (→ visits with service_type = "crm_activity")
// ---------------------------------------------------------------------------

export interface VinActivity {
  activityId: string;
  contactId: string;
  activityType: string;
  subject?: string;
  notes?: string;
  activityDate: string;
  completedDate?: string;
  createdDate?: string;
}

export interface VinActivityPage {
  items: VinActivity[];
  nextPageToken?: string;
}

export async function fetchVinActivities(
  apiKey: string,
  dealerId: string,
  since?: string,
  pageToken?: string
): Promise<VinActivityPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return vinFetch<VinActivityPage>(`/activities?${params}`, apiKey, dealerId);
}

// ---------------------------------------------------------------------------
// Email engagement history (→ visits with service_type = "email_engagement")
// ---------------------------------------------------------------------------

export interface VinEmailEvent {
  eventId: string;
  contactId: string;
  campaignName?: string;
  eventType: "open" | "click" | "bounce" | "unsubscribe";
  eventDate: string;
  url?: string;
}

export interface VinEmailEventPage {
  items: VinEmailEvent[];
  nextPageToken?: string;
}

export async function fetchVinEmailEvents(
  apiKey: string,
  dealerId: string,
  since?: string,
  pageToken?: string
): Promise<VinEmailEventPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return vinFetch<VinEmailEventPage>(`/email/events?${params}`, apiKey, dealerId);
}
