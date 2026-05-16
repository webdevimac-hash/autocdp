/**
 * Elead CRM (CDK Global) API adapter.
 *
 * Auth: Bearer API key (X-Api-Key header).
 * Data PULL: Leads, Contacts, Activities.
 * Data PUSH: Create activity, create note, update lead status.
 *
 * Env vars:
 *   ELEAD_API_BASE  (default: https://api.elead-crm.com/v2)
 *   — api_key + dealer_id stored per-dealership in dms_connections.encrypted_tokens
 */

export const ELEAD_API_BASE =
  process.env.ELEAD_API_BASE ?? "https://api.elead-crm.com/v2";

// ---------------------------------------------------------------------------
// Base fetch helper
// ---------------------------------------------------------------------------

async function eleadFetch<T>(
  path: string,
  apiKey: string,
  dealerId: string,
  options: RequestInit = {},
  retries = 3
): Promise<T> {
  const res = await fetch(`${ELEAD_API_BASE}${path}`, {
    ...options,
    headers: {
      "X-Api-Key": apiKey,
      "X-Dealer-Id": dealerId,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 429 && retries > 0) {
    const after = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await new Promise((r) => setTimeout(r, after * 1000));
    return eleadFetch(path, apiKey, dealerId, options, retries - 1);
  }
  if (!res.ok) throw new Error(`Elead API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Pull — Leads (→ customers with lifecycle_stage = "prospect")
// ---------------------------------------------------------------------------

export interface EleadLead {
  leadId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  leadSource?: string;
  leadStatus?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  vehicleInterest?: { year?: number; make?: string; model?: string; vin?: string };
  createdDate?: string;
  lastModifiedDate?: string;
}

export interface EleadLeadPage {
  items: EleadLead[];
  nextPageToken?: string;
}

export async function fetchEleadLeads(
  apiKey: string,
  dealerId: string,
  since?: string,
  pageToken?: string
): Promise<EleadLeadPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return eleadFetch<EleadLeadPage>(`/leads?${params}`, apiKey, dealerId);
}

// ---------------------------------------------------------------------------
// Pull — Contacts (established customer records)
// ---------------------------------------------------------------------------

export interface EleadContact {
  contactId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  lastModifiedDate?: string;
}

export interface EleadContactPage {
  items: EleadContact[];
  nextPageToken?: string;
}

export async function fetchEleadContacts(
  apiKey: string,
  dealerId: string,
  since?: string,
  pageToken?: string
): Promise<EleadContactPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return eleadFetch<EleadContactPage>(`/contacts?${params}`, apiKey, dealerId);
}

// ---------------------------------------------------------------------------
// Pull — Activities (→ visits with service_type = "crm_activity")
// ---------------------------------------------------------------------------

export interface EleadActivity {
  activityId: string;
  leadId: string;
  activityType: string;
  subject?: string;
  notes?: string;
  activityDate: string;
}

export interface EleadActivityPage {
  items: EleadActivity[];
  nextPageToken?: string;
}

export async function fetchEleadActivities(
  apiKey: string,
  dealerId: string,
  since?: string,
  pageToken?: string
): Promise<EleadActivityPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return eleadFetch<EleadActivityPage>(`/activities?${params}`, apiKey, dealerId);
}

// ---------------------------------------------------------------------------
// Push — Create activity on a lead
// ---------------------------------------------------------------------------

export interface EleadActivityPayload {
  activityType: string;
  subject: string;
  notes: string;
  activityDate: string; // ISO 8601
  completedDate?: string;
}

export async function createEleadActivity(
  apiKey: string,
  dealerId: string,
  leadId: string,
  payload: EleadActivityPayload
): Promise<{ activityId: string }> {
  return eleadFetch<{ activityId: string }>(
    `/leads/${encodeURIComponent(leadId)}/activities`,
    apiKey,
    dealerId,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

// ---------------------------------------------------------------------------
// Push — Create note on a lead
// ---------------------------------------------------------------------------

export async function createEleadNote(
  apiKey: string,
  dealerId: string,
  leadId: string,
  note: string
): Promise<{ noteId: string }> {
  return eleadFetch<{ noteId: string }>(
    `/leads/${encodeURIComponent(leadId)}/notes`,
    apiKey,
    dealerId,
    { method: "POST", body: JSON.stringify({ content: note }) }
  );
}

// ---------------------------------------------------------------------------
// Push — Update lead status
// ---------------------------------------------------------------------------

export async function updateEleadLeadStatus(
  apiKey: string,
  dealerId: string,
  leadId: string,
  status: string
): Promise<void> {
  await eleadFetch<unknown>(
    `/leads/${encodeURIComponent(leadId)}`,
    apiKey,
    dealerId,
    { method: "PATCH", body: JSON.stringify({ leadStatus: status }) }
  );
}
