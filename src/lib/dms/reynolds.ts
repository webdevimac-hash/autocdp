/**
 * Reynolds & Reynolds DealerLink API client.
 *
 * Auth: API key passed as X-API-Key header (dealer provides key from ERA-IGNITE portal).
 * Data: Customers, Service ROs, Inventory, Sales Deals.
 *
 * Env vars:
 *   REYNOLDS_API_BASE  (default: https://api.reyrey.net/v1)
 *   — actual key is stored per-dealership in dms_connections.encrypted_tokens
 */

export const REYNOLDS_API_BASE =
  process.env.REYNOLDS_API_BASE ?? "https://api.reyrey.net/v1";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

async function reynoldsFetch<T>(
  path: string,
  apiKey: string,
  retries = 3
): Promise<T> {
  const res = await fetch(`${REYNOLDS_API_BASE}${path}`, {
    headers: {
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return reynoldsFetch(path, apiKey, retries - 1);
  }

  if (!res.ok) {
    throw new Error(`Reynolds API ${path} → ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Data types (normalized to match CDK shapes for easier mapping)
// ---------------------------------------------------------------------------

export interface ReynoldsCustomer {
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

export interface ReynoldsCustomerPage {
  items: ReynoldsCustomer[];
  nextPageToken?: string;
}

export async function fetchReynoldsCustomers(
  apiKey: string,
  since?: string,
  pageToken?: string
): Promise<ReynoldsCustomerPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return reynoldsFetch<ReynoldsCustomerPage>(`/customers?${params}`, apiKey);
}

export interface ReynoldsServiceRO {
  roNumber: string;
  customerId: string;
  openDate: string;
  closeDate?: string;
  status: string;
  laborTotal?: number;
  partsTotal?: number;
  totalAmount?: number;
  vehicleVin?: string;
  mileageIn?: number;
}

export interface ReynoldsRoPage {
  items: ReynoldsServiceRO[];
  nextPageToken?: string;
}

export async function fetchReynoldsServiceROs(
  apiKey: string,
  since?: string,
  pageToken?: string
): Promise<ReynoldsRoPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return reynoldsFetch<ReynoldsRoPage>(`/service/repair-orders?${params}`, apiKey);
}

export interface ReynoldsVehicle {
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

export interface ReynoldsVehiclePage {
  items: ReynoldsVehicle[];
  nextPageToken?: string;
}

export async function fetchReynoldsInventory(
  apiKey: string,
  since?: string,
  pageToken?: string
): Promise<ReynoldsVehiclePage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return reynoldsFetch<ReynoldsVehiclePage>(`/inventory?${params}`, apiKey);
}

export interface ReynoldsDeal {
  dealNumber: string;
  customerId: string;
  closeDate?: string;
  status: string;
  saleType: "new" | "used" | "lease";
  vehicleVin?: string;
  salePrice?: number;
  lastModifiedDate?: string;
}

export interface ReynoldsDealPage {
  items: ReynoldsDeal[];
  nextPageToken?: string;
}

export async function fetchReynoldsDeals(
  apiKey: string,
  since?: string,
  pageToken?: string
): Promise<ReynoldsDealPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return reynoldsFetch<ReynoldsDealPage>(`/sales/deals?${params}`, apiKey);
}
