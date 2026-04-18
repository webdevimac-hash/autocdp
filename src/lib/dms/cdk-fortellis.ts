/**
 * CDK Fortellis API client.
 *
 * Auth: OAuth 2.0 Authorization Code flow via Fortellis Identity Server.
 * Data: Fortellis Marketplace APIs — Customers, Service ROs, Inventory, Deals/Sales.
 *
 * Env vars required:
 *   CDK_FORTELLIS_CLIENT_ID
 *   CDK_FORTELLIS_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL  (used to build the OAuth redirect URI)
 */

export const CDK_IDENTITY_URL = "https://identity.fortellis.io";
export const CDK_API_BASE = "https://api.fortellis.io";

export const CDK_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/cdk/callback`;

export interface CdkTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
  subscriptionId?: string; // Fortellis subscription / dealer identifier
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

export function getCdkAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.CDK_FORTELLIS_CLIENT_ID ?? "",
    redirect_uri: CDK_REDIRECT_URI,
    scope: "openid offline_access",
    state,
  });
  return `${CDK_IDENTITY_URL}/v1/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<CdkTokenSet> {
  const res = await fetch(`${CDK_IDENTITY_URL}/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CDK_REDIRECT_URI,
      client_id: process.env.CDK_FORTELLIS_CLIENT_ID ?? "",
      client_secret: process.env.CDK_FORTELLIS_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`CDK token exchange failed: ${res.status} ${txt}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshCdkTokens(refreshToken: string): Promise<CdkTokenSet> {
  const res = await fetch(`${CDK_IDENTITY_URL}/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.CDK_FORTELLIS_CLIENT_ID ?? "",
      client_secret: process.env.CDK_FORTELLIS_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`CDK token refresh failed: ${res.status} ${txt}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// ---------------------------------------------------------------------------
// API client with auto-refresh + retry/backoff
// ---------------------------------------------------------------------------

interface FetchOptions {
  tokens: CdkTokenSet;
  subscriptionId: string;
  onTokenRefresh?: (newTokens: CdkTokenSet) => Promise<void>;
}

async function cdkFetch<T>(
  path: string,
  opts: FetchOptions,
  retries = 3
): Promise<T> {
  // Refresh if token expires within 60 s
  let { tokens } = opts;
  if (tokens.expiresAt - Date.now() < 60_000) {
    tokens = await refreshCdkTokens(tokens.refreshToken);
    await opts.onTokenRefresh?.(tokens);
  }

  const url = `${CDK_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Subscription-Id": opts.subscriptionId,
      Accept: "application/json",
    },
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return cdkFetch(path, { ...opts, tokens }, retries - 1);
  }

  if (!res.ok) {
    throw new Error(`CDK API ${path} → ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

export interface CdkCustomer {
  customerId: string;
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

export interface CdkCustomerPage {
  items: CdkCustomer[];
  nextPageToken?: string;
}

export async function fetchCdkCustomers(
  opts: FetchOptions,
  since?: string,
  pageToken?: string
): Promise<CdkCustomerPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return cdkFetch<CdkCustomerPage>(
    `/v1/customers?${params}`,
    opts
  );
}

export interface CdkServiceRO {
  roNumber: string;
  customerId: string;
  openDate: string;
  closeDate?: string;
  status: string;
  laborTotal?: number;
  partsTotal?: number;
  totalAmount?: number;
  serviceAdvisor?: string;
  vehicleVin?: string;
  mileageIn?: number;
}

export interface CdkRoPage {
  items: CdkServiceRO[];
  nextPageToken?: string;
}

export async function fetchCdkServiceROs(
  opts: FetchOptions,
  since?: string,
  pageToken?: string
): Promise<CdkRoPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return cdkFetch<CdkRoPage>(`/v1/service/repair-orders?${params}`, opts);
}

export interface CdkVehicle {
  stockNumber: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  condition: "new" | "used" | "cpo";
  status: string;
  listPrice?: number;
  msrp?: number;
  mileage?: number;
  color?: string;
  daysInStock?: number;
  lastModifiedDate?: string;
}

export interface CdkVehiclePage {
  items: CdkVehicle[];
  nextPageToken?: string;
}

export async function fetchCdkInventory(
  opts: FetchOptions,
  since?: string,
  pageToken?: string
): Promise<CdkVehiclePage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return cdkFetch<CdkVehiclePage>(`/v1/inventory?${params}`, opts);
}

export interface CdkDeal {
  dealNumber: string;
  customerId: string;
  closeDate?: string;
  status: string;
  saleType: "new" | "used" | "lease";
  vehicleVin?: string;
  salePrice?: number;
  grossProfit?: number;
  financeManager?: string;
  lastModifiedDate?: string;
}

export interface CdkDealPage {
  items: CdkDeal[];
  nextPageToken?: string;
}

export async function fetchCdkDeals(
  opts: FetchOptions,
  since?: string,
  pageToken?: string
): Promise<CdkDealPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return cdkFetch<CdkDealPage>(`/v1/sales/deals?${params}`, opts);
}
