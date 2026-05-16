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

import { WritebackError, responseToWritebackError } from "./errors";

export const VINSOLUTIONS_API_BASE =
  process.env.VINSOLUTIONS_API_BASE ?? "https://api.vinsolutions.com/v2";

// ---------------------------------------------------------------------------
// Client — read-only (pull) with 429 retry
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
// Write helper — for push operations, throws WritebackError (not plain Error)
// so the retry queue can inspect isRetryable.
// ---------------------------------------------------------------------------

async function vinPush<T>(
  path: string,
  apiKey: string,
  dealerId: string,
  body: unknown,
  method: "POST" | "PATCH" | "PUT" = "POST",
  retries = 2
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${VINSOLUTIONS_API_BASE}${path}`, {
      method,
      headers: {
        "X-Api-Key":   apiKey,
        "X-Dealer-Id": dealerId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new WritebackError(
      `VinSolutions network error on ${method} ${path}: ${String(networkErr)}`,
      0
    );
  }

  if (res.status === 429 && retries > 0) {
    const after = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await new Promise((r) => setTimeout(r, after * 1000));
    return vinPush(path, apiKey, dealerId, body, method, retries - 1);
  }

  if (!res.ok) {
    throw await responseToWritebackError(res, `VinSolutions ${method} ${path}`);
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

// ---------------------------------------------------------------------------
// Push — Create activity against a contact (write-back after campaign / scan)
// ---------------------------------------------------------------------------

export interface VinActivityPayload {
  contactId: string;
  activityType: string;  // "AutoCDP Campaign" | "AutoCDP Scan" | "AutoCDP Booking"
  subject: string;
  notes: string;
  activityDate: string;  // ISO 8601
  completedDate?: string;
}

export async function createVinActivity(
  apiKey: string,
  dealerId: string,
  payload: VinActivityPayload
): Promise<{ activityId: string }> {
  return vinPush<{ activityId: string }>("/activities", apiKey, dealerId, payload);
}

// ---------------------------------------------------------------------------
// Push — Add note to a contact
// ---------------------------------------------------------------------------

export async function createVinNote(
  apiKey: string,
  dealerId: string,
  contactId: string,
  note: string
): Promise<{ noteId: string }> {
  return vinPush<{ noteId: string }>(
    `/contacts/${encodeURIComponent(contactId)}/notes`,
    apiKey,
    dealerId,
    { content: note }
  );
}

// ---------------------------------------------------------------------------
// Push — Update lead status
// ---------------------------------------------------------------------------

export async function updateVinLeadStatus(
  apiKey: string,
  dealerId: string,
  leadId: string,
  status: string
): Promise<void> {
  await vinPush<unknown>(
    `/leads/${encodeURIComponent(leadId)}`,
    apiKey,
    dealerId,
    { leadStatus: status },
    "PATCH"
  );
}
