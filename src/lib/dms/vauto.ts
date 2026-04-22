/**
 * vAuto (Cox Automotive) Inventory API client.
 *
 * Auth: API key + dealer ID (Authorization: Bearer <apiKey>, X-Dealer-Id header).
 * Data: Vehicle inventory only (VIN, make, model, year, price, days on lot, condition).
 *
 * Env vars:
 *   VAUTO_API_BASE  (default: https://api.vauto.com/v1)
 *   — actual keys stored per-dealership in dms_connections.encrypted_tokens
 */

export const VAUTO_API_BASE =
  process.env.VAUTO_API_BASE ?? "https://api.vauto.com/v1";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

async function vautoFetch<T>(
  path: string,
  apiKey: string,
  dealerId: string,
  retries = 3
): Promise<T> {
  const res = await fetch(`${VAUTO_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Dealer-Id": dealerId,
      Accept: "application/json",
    },
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return vautoFetch(path, apiKey, dealerId, retries - 1);
  }

  if (!res.ok) {
    throw new Error(`vAuto API ${path} → ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export interface VAutoVehicle {
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
  daysOnLot?: number;
  appraisalValue?: number;
  lastModifiedDate?: string;
}

export interface VAutoVehiclePage {
  items: VAutoVehicle[];
  nextPageToken?: string;
}

export async function fetchVAutoInventory(
  apiKey: string,
  dealerId: string,
  since?: string,
  pageToken?: string
): Promise<VAutoVehiclePage> {
  const params = new URLSearchParams({ limit: "200" });
  if (since) params.set("modifiedSince", since);
  if (pageToken) params.set("pageToken", pageToken);
  return vautoFetch<VAutoVehiclePage>(`/inventory?${params}`, apiKey, dealerId);
}
