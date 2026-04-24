/**
 * Reynolds DealerVault API client.
 *
 * DealerVault is Reynolds & Reynolds' hosted data warehouse.
 * It exposes a REST API for pulling customer, RO, and inventory data
 * that may not be available through the standard Reynolds ERA-IGNITE DMS feed.
 *
 * Docs: https://developer.reyrey.com/dealervault (requires partner agreement)
 */

export interface DealerVaultConfig {
  /** DealerVault API base URL (varies by Reynolds environment) */
  baseUrl: string;
  /** OAuth2 client_id issued by Reynolds */
  clientId: string;
  /** OAuth2 client_secret issued by Reynolds */
  clientSecret: string;
  /** Dealer code (7-digit Reynolds dealer identifier) */
  dealerCode: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface DvCustomer {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  };
  lastRoDate: string | null;
  totalRoCount: number;
}

interface DvRepairOrder {
  roNumber: string;
  customerId: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileageIn: number | null;
  laborAmount: number;
  partsAmount: number;
  totalAmount: number;
  closedDate: string;
  technicianId: string | null;
  laborLines: { opCode: string; description: string; amount: number }[];
}

interface DvInventoryVehicle {
  stockNumber: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  color: string | null;
  mileage: number;
  condition: "new" | "used" | "certified";
  price: number;
  daysOnLot: number;
  status: "available" | "sold" | "reserved";
}

interface DvSyncResult {
  customers: DvCustomer[];
  repairOrders: DvRepairOrder[];
  inventory: DvInventoryVehicle[];
  cursor: string | null;
}

export class DealerVaultClient {
  private config: DealerVaultConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: DealerVaultConfig) {
    this.config = config;
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 30_000) {
      return this.accessToken;
    }

    const res = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: "dealervault.read",
      }),
    });

    if (!res.ok) {
      throw new Error(`DealerVault OAuth failed: ${res.status} ${await res.text()}`);
    }

    const token = await res.json() as TokenResponse;
    this.accessToken = token.access_token;
    this.tokenExpiry = Date.now() + token.expires_in * 1000;
    return this.accessToken;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const token = await this.getToken();
    const url = new URL(`${this.config.baseUrl}/v1/dealers/${this.config.dealerCode}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`DealerVault API error ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  /** Pull a page of customers. cursor is an ISO date string (modifiedSince). */
  async getCustomers(cursor?: string, pageSize = 500): Promise<{ items: DvCustomer[]; nextCursor: string | null }> {
    const params: Record<string, string> = { pageSize: String(pageSize) };
    if (cursor) params.modifiedSince = cursor;

    const data = await this.get<{ customers: DvCustomer[]; nextPage: string | null }>("/customers", params);
    return { items: data.customers ?? [], nextCursor: data.nextPage ?? null };
  }

  /** Pull repair orders for a date range. */
  async getRepairOrders(fromDate: string, toDate?: string, pageSize = 500): Promise<{ items: DvRepairOrder[]; nextCursor: string | null }> {
    const params: Record<string, string> = { fromDate, pageSize: String(pageSize) };
    if (toDate) params.toDate = toDate;

    const data = await this.get<{ repairOrders: DvRepairOrder[]; nextPage: string | null }>("/repair-orders", params);
    return { items: data.repairOrders ?? [], nextCursor: data.nextPage ?? null };
  }

  /** Pull current inventory snapshot. */
  async getInventory(): Promise<DvInventoryVehicle[]> {
    const data = await this.get<{ vehicles: DvInventoryVehicle[] }>("/inventory");
    return data.vehicles ?? [];
  }

  /** Full sync: customers + ROs since cursor + inventory. */
  async fullSync(cursor?: string): Promise<DvSyncResult> {
    const [customersPage, roPage, inventory] = await Promise.all([
      this.getCustomers(cursor),
      this.getRepairOrders(cursor ?? new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10)),
      this.getInventory(),
    ]);

    return {
      customers: customersPage.items,
      repairOrders: roPage.items,
      inventory,
      cursor: new Date().toISOString(),
    };
  }
}

// ── Data mappers for AutoCDP schema ──────────────────────────

export function dvCustomerToAutocdp(dv: DvCustomer) {
  return {
    first_name: dv.firstName,
    last_name: dv.lastName,
    email: dv.email,
    phone: dv.phone,
    address: {
      street: dv.address.street ?? undefined,
      city: dv.address.city ?? undefined,
      state: dv.address.state ?? undefined,
      zip: dv.address.postalCode ?? undefined,
    },
    metadata: {
      reynolds_customer_id: dv.customerId,
      total_ro_count: dv.totalRoCount,
      last_ro_date: dv.lastRoDate,
    },
  };
}

export function dvRoToAutocdp(ro: DvRepairOrder) {
  return {
    vin: ro.vin,
    make: ro.make,
    model: ro.model,
    year: ro.year,
    mileage: ro.mileageIn,
    service_type: ro.laborLines[0]?.opCode ?? null,
    service_notes: ro.laborLines.map((l) => l.description).join("; ") || null,
    ro_number: ro.roNumber,
    total_amount: ro.totalAmount,
    visit_date: ro.closedDate,
  };
}

export function dvVehicleToAutocdp(v: DvInventoryVehicle) {
  return {
    vin: v.vin,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    color: v.color,
    mileage: v.mileage,
    condition: v.condition,
    price: v.price,
    days_on_lot: v.daysOnLot,
    status: v.status === "sold" ? "sold" : v.status === "reserved" ? "reserved" : "available",
    metadata: { stock_number: v.stockNumber },
  };
}
