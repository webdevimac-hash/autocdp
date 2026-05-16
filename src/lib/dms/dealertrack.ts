/**
 * Dealertrack CRM API adapter (Cox Automotive DT Connect).
 *
 * Auth: OAuth 2.0 client_credentials.
 *   Token endpoint: https://identity.coxauto.com/as/token.oauth2
 * Data PULL: Leads, Contacts, Activities.
 * Data PUSH: Create activity, create note, update lead status.
 *
 * Env vars:
 *   DEALERTRACK_API_BASE        (default: https://api.dealertrack.com/crm/v1)
 *   DEALERTRACK_TOKEN_ENDPOINT  (default: https://identity.coxauto.com/as/token.oauth2)
 *   — client_id + client_secret stored per-dealership in dms_connections.encrypted_tokens
 */

export const DEALERTRACK_API_BASE =
  process.env.DEALERTRACK_API_BASE ?? "https://api.dealertrack.com/crm/v1";

export const DEALERTRACK_TOKEN_ENDPOINT =
  process.env.DEALERTRACK_TOKEN_ENDPOINT ??
  "https://identity.coxauto.com/as/token.oauth2";

// ---------------------------------------------------------------------------
// Token management (in-memory cache; tokens are valid ~3600s)
// ---------------------------------------------------------------------------

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

const tokenCache = new Map<string, TokenCache>(); // key = clientId

export async function getDealertrackToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const cached = tokenCache.get(clientId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;

  const res = await fetch(DEALERTRACK_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid crm.leads.read crm.leads.write crm.activities.write",
    }),
  });

  if (!res.ok) throw new Error(`Dealertrack token fetch failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const cache: TokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  tokenCache.set(clientId, cache);
  return cache.accessToken;
}

// ---------------------------------------------------------------------------
// Base fetch helper
// ---------------------------------------------------------------------------

async function dtFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
  retries = 3
): Promise<T> {
  const res = await fetch(`${DEALERTRACK_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 429 && retries > 0) {
    const after = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await new Promise((r) => setTimeout(r, after * 1000));
    return dtFetch(path, token, options, retries - 1);
  }
  if (!res.ok) throw new Error(`Dealertrack API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Pull — Leads (→ customers with lifecycle_stage = "prospect")
// ---------------------------------------------------------------------------

export interface DealertrackLead {
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

export interface DealertrackLeadPage {
  items: DealertrackLead[];
  nextPageToken?: string;
}

export async function fetchDealertrackLeads(
  token: string,
  since?: string,
  pageToken?: string
): Promise<DealertrackLeadPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return dtFetch<DealertrackLeadPage>(`/leads?${params}`, token);
}

// ---------------------------------------------------------------------------
// Pull — Contacts (established customer records)
// ---------------------------------------------------------------------------

export interface DealertrackContact {
  contactId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  lastModifiedDate?: string;
}

export interface DealertrackContactPage {
  items: DealertrackContact[];
  nextPageToken?: string;
}

export async function fetchDealertrackContacts(
  token: string,
  since?: string,
  pageToken?: string
): Promise<DealertrackContactPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return dtFetch<DealertrackContactPage>(`/contacts?${params}`, token);
}

// ---------------------------------------------------------------------------
// Pull — Activities (→ visits with service_type = "crm_activity")
// ---------------------------------------------------------------------------

export interface DealertrackActivity {
  activityId: string;
  leadId: string;
  activityType: string;
  subject?: string;
  notes?: string;
  activityDate: string;
}

export interface DealertrackActivityPage {
  items: DealertrackActivity[];
  nextPageToken?: string;
}

export async function fetchDealertrackActivities(
  token: string,
  since?: string,
  pageToken?: string
): Promise<DealertrackActivityPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return dtFetch<DealertrackActivityPage>(`/activities?${params}`, token);
}

// ---------------------------------------------------------------------------
// Push — Create activity on a lead (write-back after campaign send / QR scan)
// ---------------------------------------------------------------------------

export interface DealertrackActivityPayload {
  activityType: string;      // "AutoCDP Campaign" | "AutoCDP Scan" | "AutoCDP Booking"
  subject: string;
  notes: string;
  activityDate: string;      // ISO 8601
  completedDate?: string;
}

export async function createDealertrackActivity(
  token: string,
  leadId: string,
  payload: DealertrackActivityPayload
): Promise<{ activityId: string }> {
  return dtFetch<{ activityId: string }>(
    `/leads/${encodeURIComponent(leadId)}/activities`,
    token,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

// ---------------------------------------------------------------------------
// Push — Create note on a lead
// ---------------------------------------------------------------------------

export async function createDealertrackNote(
  token: string,
  leadId: string,
  note: string
): Promise<{ noteId: string }> {
  return dtFetch<{ noteId: string }>(
    `/leads/${encodeURIComponent(leadId)}/notes`,
    token,
    { method: "POST", body: JSON.stringify({ content: note }) }
  );
}

// ---------------------------------------------------------------------------
// Push — Update lead status
// ---------------------------------------------------------------------------

export async function updateDealertrackLeadStatus(
  token: string,
  leadId: string,
  status: string
): Promise<void> {
  await dtFetch<unknown>(
    `/leads/${encodeURIComponent(leadId)}`,
    token,
    { method: "PATCH", body: JSON.stringify({ leadStatus: status }) }
  );
}
