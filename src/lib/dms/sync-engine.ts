/**
 * DMS Sync Engine
 *
 * Shared data-mapping, upsert logic, and Data Agent trigger.
 * Used by both CDK Fortellis and Reynolds sync routes.
 *
 * Key design decisions:
 *   - dms_external_id format: "<provider>:<record_id>"  e.g. "cdk_fortellis:CUST-001"
 *     This column has a UNIQUE index per (dealership_id, dms_external_id) from
 *     migration 009, which makes .upsert({ onConflict: "dealership_id,dms_external_id" })
 *     safe and idempotent on every re-sync.
 *   - Column names match the actual DB schema from migrations 001 + 005:
 *       customers: address JSONB, total_visits, total_spend, last_visit_date
 *       visits:    total_amount, vin, service_notes (no visit_type, close_date, notes)
 *       inventory: price, days_on_lot (no list_price, days_in_stock, stock_number)
 *   - Inventory condition "cpo" is remapped to "certified" to satisfy the
 *     CHECK constraint in migration 005.
 *   - buildCustomerIdMap queries by dms_external_id directly — no full-table scan.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { runDataAgent } from "@/lib/anthropic/agents/data-agent";
import {
  fetchCdkCustomers,
  fetchCdkServiceROs,
  fetchCdkInventory,
  fetchCdkDeals,
  type CdkTokenSet,
  type CdkCustomer,
  type CdkServiceRO,
  type CdkVehicle,
  type CdkDeal,
} from "./cdk-fortellis";
import {
  fetchReynoldsCustomers,
  fetchReynoldsServiceROs,
  fetchReynoldsInventory,
  fetchReynoldsDeals,
  type ReynoldsCustomer,
  type ReynoldsServiceRO,
  type ReynoldsVehicle,
  type ReynoldsDeal,
} from "./reynolds";
import {
  fetchVinContacts,
  fetchVinLeads,
  fetchVinActivities,
  fetchVinEmailEvents,
  type VinContact,
  type VinLead,
  type VinActivity,
  type VinEmailEvent,
} from "./vinsolutions";
import {
  fetchVAutoInventory,
  type VAutoVehicle,
} from "./vauto";
import {
  fetchCreditTierBatch,
  type CreditTier,
} from "./seven-hundred-credit";
import {
  fetchGeneralCrmLeads,
  fetchGeneralCrmActivities,
  type GeneralCrmLead,
  type GeneralCrmActivity,
} from "./general-crm";
import { decryptTokens, encryptTokens } from "./encrypt";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DmsProvider =
  | "cdk_fortellis"
  | "reynolds"
  | "vinsolutions"
  | "vauto"
  | "seven_hundred_credit"
  | "general_crm";

export interface SyncContext {
  dealershipId: string;
  connectionId: string;
  provider: DmsProvider;
  jobType: "full" | "delta";
  since?: string; // ISO timestamp for delta syncs
}

interface SyncCounts {
  customers: number;
  visits: number;
  inventory: number;
  deals: number;
}

// ---------------------------------------------------------------------------
// dms_external_id helpers
// ---------------------------------------------------------------------------

/** Stable unique key for a DMS record within a dealership. */
function dmsId(provider: DmsProvider, recordId: string): string {
  return `${provider}:${recordId}`;
}

/** Invert a dms_external_id back to the raw DMS record ID. */
function rawId(externalId: string): string {
  // Format is "<provider>:<id>" — split on first colon only
  const idx = externalId.indexOf(":");
  return idx === -1 ? externalId : externalId.slice(idx + 1);
}

// ---------------------------------------------------------------------------
// Condition mapping (DMS "cpo" → DB "certified")
// ---------------------------------------------------------------------------

function normalizeCondition(cond: string): "new" | "used" | "certified" {
  if (cond === "cpo") return "certified";
  if (cond === "new" || cond === "used" || cond === "certified") return cond;
  return "used"; // safe fallback
}

// ---------------------------------------------------------------------------
// Logging helpers (writes to sync_logs)
// ---------------------------------------------------------------------------

async function log(
  jobId: string,
  level: "info" | "warn" | "error",
  message: string,
  data?: unknown
) {
  const supabase = createServiceClient();
  await supabase
    .from("sync_logs")
    .insert({ job_id: jobId, level, message, data: data ?? null });
}

// ---------------------------------------------------------------------------
// Mapping: CDK → DB rows
// ---------------------------------------------------------------------------

function mapCdkCustomer(c: CdkCustomer, dealershipId: string, provider: DmsProvider) {
  return {
    dealership_id: dealershipId,
    dms_external_id: dmsId(provider, c.customerId),
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email ?? null,
    phone: c.phone ?? null,
    // customers.address is JSONB {street, city, state, zip}
    address: {
      street: c.address?.street ?? null,
      city: c.address?.city ?? null,
      state: c.address?.state ?? null,
      zip: c.address?.zip ?? null,
    },
    metadata: { dms_source: { provider, id: c.customerId } },
  };
}

function mapCdkRo(
  ro: CdkServiceRO,
  customerId: string,
  dealershipId: string,
  provider: DmsProvider
) {
  return {
    dealership_id: dealershipId,
    dms_external_id: dmsId(provider, ro.roNumber),
    customer_id: customerId,
    visit_date: ro.openDate,
    // visits schema: total_amount (not total_spend), vin (not vehicle_vin),
    // service_notes (not notes). No visit_type or close_date columns.
    total_amount: ro.totalAmount ?? (ro.laborTotal ?? 0) + (ro.partsTotal ?? 0),
    vin: ro.vehicleVin ?? null,
    mileage: ro.mileageIn ?? null,
    service_type: "service",
    service_notes: ro.serviceAdvisor ? `Advisor: ${ro.serviceAdvisor}` : null,
    metadata: { dms_source: { provider, id: ro.roNumber } },
  };
}

function mapCdkDeal(
  deal: CdkDeal,
  customerId: string,
  dealershipId: string,
  provider: DmsProvider
) {
  return {
    dealership_id: dealershipId,
    dms_external_id: dmsId(provider, deal.dealNumber),
    customer_id: customerId,
    visit_date: deal.closeDate!,
    total_amount: deal.salePrice ?? 0,
    vin: deal.vehicleVin ?? null,
    service_type: "sale",
    metadata: { dms_source: { provider, id: deal.dealNumber } },
  };
}

function mapCdkVehicle(v: CdkVehicle, dealershipId: string, provider: DmsProvider) {
  return {
    dealership_id: dealershipId,
    dms_external_id: dmsId(provider, v.stockNumber),
    vin: v.vin,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim ?? null,
    // inventory schema: condition CHECK ('new','used','certified'); map 'cpo' → 'certified'
    condition: normalizeCondition(v.condition),
    status: v.status,
    // inventory schema: price (not list_price), days_on_lot (not days_in_stock)
    // no stock_number column in schema
    price: v.listPrice ?? v.msrp ?? null,
    mileage: v.mileage ?? null,
    color: v.color ?? null,
    days_on_lot: v.daysInStock ?? null,
    metadata: { dms_source: { provider, id: v.stockNumber } },
  };
}

// ---------------------------------------------------------------------------
// Mapping: Reynolds → DB rows (same target schema)
// ---------------------------------------------------------------------------

function mapReynoldsCustomer(
  c: ReynoldsCustomer,
  dealershipId: string,
  provider: DmsProvider
) {
  return {
    dealership_id: dealershipId,
    dms_external_id: dmsId(provider, c.customerId),
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email ?? null,
    phone: c.phone ?? null,
    address: {
      street: c.address?.street ?? null,
      city: c.address?.city ?? null,
      state: c.address?.state ?? null,
      zip: c.address?.zip ?? null,
    },
    metadata: { dms_source: { provider, id: c.customerId } },
  };
}

function mapReynoldsRo(
  ro: ReynoldsServiceRO,
  customerId: string,
  dealershipId: string,
  provider: DmsProvider
) {
  return {
    dealership_id: dealershipId,
    dms_external_id: dmsId(provider, ro.roNumber),
    customer_id: customerId,
    visit_date: ro.openDate,
    total_amount: ro.totalAmount ?? (ro.laborTotal ?? 0) + (ro.partsTotal ?? 0),
    vin: ro.vehicleVin ?? null,
    mileage: ro.mileageIn ?? null,
    service_type: "service",
    service_notes: null,
    metadata: { dms_source: { provider, id: ro.roNumber } },
  };
}

function mapReynoldsDeal(
  deal: ReynoldsDeal,
  customerId: string,
  dealershipId: string,
  provider: DmsProvider
) {
  return {
    dealership_id: dealershipId,
    dms_external_id: dmsId(provider, deal.dealNumber),
    customer_id: customerId,
    visit_date: deal.closeDate!,
    total_amount: deal.salePrice ?? 0,
    vin: deal.vehicleVin ?? null,
    service_type: "sale",
    metadata: { dms_source: { provider, id: deal.dealNumber } },
  };
}

function mapReynoldsVehicle(
  v: ReynoldsVehicle,
  dealershipId: string,
  provider: DmsProvider
) {
  return {
    dealership_id: dealershipId,
    dms_external_id: dmsId(provider, v.stockNumber),
    vin: v.vin,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim ?? null,
    condition: normalizeCondition(v.condition),
    status: v.status,
    price: v.listPrice ?? v.msrp ?? null,
    mileage: v.mileage ?? null,
    color: v.color ?? null,
    days_on_lot: v.daysInStock ?? null,
    metadata: { dms_source: { provider, id: v.stockNumber } },
  };
}

// ---------------------------------------------------------------------------
// Generic paginated fetch
// ---------------------------------------------------------------------------

type PageFetcher<Page> = (
  since?: string,
  cursor?: string
) => Promise<Page & { nextPageToken?: string }>;

async function paginateAll<T, Page extends { items: T[] }>(
  fetcher: PageFetcher<Page>
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetcher(undefined, cursor);
    all.push(...page.items);
    cursor = page.nextPageToken;
  } while (cursor);
  return all;
}

// ---------------------------------------------------------------------------
// CDK full sync
// ---------------------------------------------------------------------------

async function syncCdkFull(ctx: SyncContext, jobId: string): Promise<SyncCounts> {
  const supabase = createServiceClient();
  const counts: SyncCounts = { customers: 0, visits: 0, inventory: 0, deals: 0 };
  const provider: DmsProvider = "cdk_fortellis";

  const { data: conn } = await supabase
    .from("dms_connections")
    .select("encrypted_tokens, metadata")
    .eq("id", ctx.connectionId)
    .single();
  if (!conn?.encrypted_tokens) throw new Error("No tokens for CDK connection");

  let tokens = await decryptTokens<CdkTokenSet>(conn.encrypted_tokens);
  const subscriptionId =
    (conn.metadata as Record<string, string>)?.subscription_id ?? "";

  const fetchOpts = {
    tokens,
    subscriptionId,
    onTokenRefresh: async (newTokens: CdkTokenSet) => {
      tokens = newTokens;
      const blob = await encryptTokens(
        newTokens as unknown as Record<string, unknown>
      );
      await supabase
        .from("dms_connections")
        .update({ encrypted_tokens: blob, updated_at: new Date().toISOString() })
        .eq("id", ctx.connectionId);
    },
  };

  // --- Customers ---
  await log(jobId, "info", "Fetching CDK customers…");
  const cdkCustomers = await paginateAll<
    CdkCustomer,
    Awaited<ReturnType<typeof fetchCdkCustomers>>
  >((_, cursor) => fetchCdkCustomers(fetchOpts, ctx.since, cursor));

  for (const batch of chunk(cdkCustomers, 100)) {
    const rows = batch.map((c) => mapCdkCustomer(c, ctx.dealershipId, provider));
    const { error } = await supabase
      .from("customers")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Customer upsert error: ${error.message}`);
    else counts.customers += batch.length;
  }

  // --- ROs → visits ---
  await log(jobId, "info", "Fetching CDK service ROs…");
  const cdkRos = await paginateAll<
    CdkServiceRO,
    Awaited<ReturnType<typeof fetchCdkServiceROs>>
  >((_, cursor) => fetchCdkServiceROs(fetchOpts, ctx.since, cursor));

  const roDmsIds = [...new Set(cdkRos.map((r) => r.customerId))];
  const customerIdMap = await buildCustomerIdMap(
    ctx.dealershipId,
    provider,
    roDmsIds
  );

  for (const batch of chunk(cdkRos, 100)) {
    const rows = batch
      .map((ro) => {
        const dbCustId = customerIdMap.get(ro.customerId);
        if (!dbCustId) return null;
        return mapCdkRo(ro, dbCustId, ctx.dealershipId, provider);
      })
      .filter(Boolean) as ReturnType<typeof mapCdkRo>[];

    if (rows.length === 0) continue;
    const { error } = await supabase
      .from("visits")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Visit upsert error: ${error.message}`);
    else counts.visits += rows.length;
  }

  // --- Inventory ---
  await log(jobId, "info", "Fetching CDK inventory…");
  const cdkVehicles = await paginateAll<
    CdkVehicle,
    Awaited<ReturnType<typeof fetchCdkInventory>>
  >((_, cursor) => fetchCdkInventory(fetchOpts, ctx.since, cursor));

  for (const batch of chunk(cdkVehicles, 100)) {
    const rows = batch.map((v) => mapCdkVehicle(v, ctx.dealershipId, provider));
    const { error } = await supabase
      .from("inventory")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Inventory upsert error: ${error.message}`);
    else counts.inventory += batch.length;
  }

  // --- Deals → visits (type "sale") ---
  await log(jobId, "info", "Fetching CDK deals…");
  const cdkDeals = await paginateAll<
    CdkDeal,
    Awaited<ReturnType<typeof fetchCdkDeals>>
  >((_, cursor) => fetchCdkDeals(fetchOpts, ctx.since, cursor));

  const dealDmsIds = [...new Set(cdkDeals.map((d) => d.customerId))];
  const dealCustomerIdMap = await buildCustomerIdMap(
    ctx.dealershipId,
    provider,
    dealDmsIds
  );

  for (const batch of chunk(cdkDeals, 100)) {
    const rows = batch
      .map((deal) => {
        const dbCustId = dealCustomerIdMap.get(deal.customerId);
        if (!dbCustId || !deal.closeDate) return null;
        return mapCdkDeal(deal, dbCustId, ctx.dealershipId, provider);
      })
      .filter(Boolean) as ReturnType<typeof mapCdkDeal>[];

    if (rows.length === 0) continue;
    const { error } = await supabase
      .from("visits")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Deal upsert error: ${error.message}`);
    else counts.deals += rows.length;
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Reynolds full sync
// ---------------------------------------------------------------------------

async function syncReynoldsFull(ctx: SyncContext, jobId: string): Promise<SyncCounts> {
  const supabase = createServiceClient();
  const counts: SyncCounts = { customers: 0, visits: 0, inventory: 0, deals: 0 };
  const provider: DmsProvider = "reynolds";

  const { data: conn } = await supabase
    .from("dms_connections")
    .select("encrypted_tokens")
    .eq("id", ctx.connectionId)
    .single();
  if (!conn?.encrypted_tokens) throw new Error("No tokens for Reynolds connection");

  const { apiKey } = await decryptTokens<{ apiKey: string }>(conn.encrypted_tokens);

  // --- Customers ---
  await log(jobId, "info", "Fetching Reynolds customers…");
  const customers = await paginateAll<
    ReynoldsCustomer,
    Awaited<ReturnType<typeof fetchReynoldsCustomers>>
  >((_, cursor) => fetchReynoldsCustomers(apiKey, ctx.since, cursor));

  for (const batch of chunk(customers, 100)) {
    const rows = batch.map((c) =>
      mapReynoldsCustomer(c, ctx.dealershipId, provider)
    );
    const { error } = await supabase
      .from("customers")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Customer upsert error: ${error.message}`);
    else counts.customers += batch.length;
  }

  // --- ROs → visits ---
  await log(jobId, "info", "Fetching Reynolds service ROs…");
  const ros = await paginateAll<
    ReynoldsServiceRO,
    Awaited<ReturnType<typeof fetchReynoldsServiceROs>>
  >((_, cursor) => fetchReynoldsServiceROs(apiKey, ctx.since, cursor));

  const roDmsIds = [...new Set(ros.map((r) => r.customerId))];
  const customerIdMap = await buildCustomerIdMap(
    ctx.dealershipId,
    provider,
    roDmsIds
  );

  for (const batch of chunk(ros, 100)) {
    const rows = batch
      .map((ro) => {
        const dbCustId = customerIdMap.get(ro.customerId);
        if (!dbCustId) return null;
        return mapReynoldsRo(ro, dbCustId, ctx.dealershipId, provider);
      })
      .filter(Boolean) as ReturnType<typeof mapReynoldsRo>[];

    if (rows.length === 0) continue;
    const { error } = await supabase
      .from("visits")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Visit upsert error: ${error.message}`);
    else counts.visits += rows.length;
  }

  // --- Inventory ---
  await log(jobId, "info", "Fetching Reynolds inventory…");
  const vehicles = await paginateAll<
    ReynoldsVehicle,
    Awaited<ReturnType<typeof fetchReynoldsInventory>>
  >((_, cursor) => fetchReynoldsInventory(apiKey, ctx.since, cursor));

  for (const batch of chunk(vehicles, 100)) {
    const rows = batch.map((v) =>
      mapReynoldsVehicle(v, ctx.dealershipId, provider)
    );
    const { error } = await supabase
      .from("inventory")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Inventory upsert error: ${error.message}`);
    else counts.inventory += batch.length;
  }

  // --- Deals → visits ---
  await log(jobId, "info", "Fetching Reynolds deals…");
  const deals = await paginateAll<
    ReynoldsDeal,
    Awaited<ReturnType<typeof fetchReynoldsDeals>>
  >((_, cursor) => fetchReynoldsDeals(apiKey, ctx.since, cursor));

  const dealDmsIds = [...new Set(deals.map((d) => d.customerId))];
  const dealCustomerIdMap = await buildCustomerIdMap(
    ctx.dealershipId,
    provider,
    dealDmsIds
  );

  for (const batch of chunk(deals, 100)) {
    const rows = batch
      .map((deal) => {
        const dbCustId = dealCustomerIdMap.get(deal.customerId);
        if (!dbCustId || !deal.closeDate) return null;
        return mapReynoldsDeal(deal, dbCustId, ctx.dealershipId, provider);
      })
      .filter(Boolean) as ReturnType<typeof mapReynoldsDeal>[];

    if (rows.length === 0) continue;
    const { error } = await supabase
      .from("visits")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Deal upsert error: ${error.message}`);
    else counts.deals += rows.length;
  }

  return counts;
}

// ---------------------------------------------------------------------------
// VinSolutions full sync
// ---------------------------------------------------------------------------

async function syncVinSolutionsFull(ctx: SyncContext, jobId: string): Promise<SyncCounts> {
  const supabase = createServiceClient();
  const counts: SyncCounts = { customers: 0, visits: 0, inventory: 0, deals: 0 };
  const provider: DmsProvider = "vinsolutions";

  const { data: conn } = await supabase
    .from("dms_connections")
    .select("encrypted_tokens")
    .eq("id", ctx.connectionId)
    .single();
  if (!conn?.encrypted_tokens) throw new Error("No tokens for VinSolutions connection");

  const { apiKey, dealerId } = await decryptTokens<{ apiKey: string; dealerId: string }>(
    conn.encrypted_tokens
  );

  // --- Contacts → customers ---
  await log(jobId, "info", "Fetching VinSolutions contacts…");
  const contacts = await paginateAll<
    VinContact,
    Awaited<ReturnType<typeof fetchVinContacts>>
  >((_, cursor) => fetchVinContacts(apiKey, dealerId, ctx.since, cursor));

  for (const batch of chunk(contacts, 100)) {
    const rows = batch.map((c) => ({
      dealership_id: ctx.dealershipId,
      dms_external_id: dmsId(provider, c.contactId),
      first_name: c.firstName,
      last_name: c.lastName,
      email: c.email ?? null,
      phone: c.phone ?? null,
      address: {
        street: c.address?.street ?? null,
        city: c.address?.city ?? null,
        state: c.address?.state ?? null,
        zip: c.address?.zip ?? null,
      },
      metadata: { dms_source: { provider, id: c.contactId } },
    }));
    const { error } = await supabase
      .from("customers")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Contact upsert error: ${error.message}`);
    else counts.customers += batch.length;
  }

  // --- Leads → customers (lifecycle_stage = prospect) ---
  await log(jobId, "info", "Fetching VinSolutions leads…");
  const leads = await paginateAll<
    VinLead,
    Awaited<ReturnType<typeof fetchVinLeads>>
  >((_, cursor) => fetchVinLeads(apiKey, dealerId, ctx.since, cursor));

  for (const batch of chunk(leads, 100)) {
    const rows = batch.map((l) => ({
      dealership_id: ctx.dealershipId,
      dms_external_id: dmsId(provider, `lead:${l.leadId}`),
      first_name: l.firstName,
      last_name: l.lastName,
      email: l.email ?? null,
      phone: l.phone ?? null,
      address: null,
      lifecycle_stage: "prospect" as const,
      metadata: {
        dms_source: { provider, id: l.leadId },
        lead_source: l.leadSource ?? null,
        lead_status: l.leadStatus ?? null,
        vehicle_interest: l.vehicleInterest ?? null,
      },
    }));
    const { error } = await supabase
      .from("customers")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Lead upsert error: ${error.message}`);
    else counts.customers += batch.length;
  }

  // --- Activities → visits ---
  await log(jobId, "info", "Fetching VinSolutions activities…");
  const activities = await paginateAll<
    VinActivity,
    Awaited<ReturnType<typeof fetchVinActivities>>
  >((_, cursor) => fetchVinActivities(apiKey, dealerId, ctx.since, cursor));

  const actDmsIds = [...new Set(activities.map((a) => a.contactId))];
  const actCustomerIdMap = await buildCustomerIdMap(ctx.dealershipId, provider, actDmsIds);

  for (const batch of chunk(activities, 100)) {
    const rows = batch
      .map((a) => {
        const dbCustId = actCustomerIdMap.get(a.contactId);
        if (!dbCustId) return null;
        return {
          dealership_id: ctx.dealershipId,
          dms_external_id: dmsId(provider, `act:${a.activityId}`),
          customer_id: dbCustId,
          visit_date: a.activityDate,
          service_type: "crm_activity",
          service_notes: a.subject
            ? `${a.activityType}: ${a.subject}${a.notes ? ` — ${a.notes}` : ""}`
            : a.notes ?? null,
          metadata: { dms_source: { provider, id: a.activityId }, activity_type: a.activityType },
        };
      })
      .filter(Boolean) as object[];

    if (rows.length === 0) continue;
    const { error } = await supabase
      .from("visits")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Activity upsert error: ${error.message}`);
    else counts.visits += rows.length;
  }

  // --- Email events → visits ---
  await log(jobId, "info", "Fetching VinSolutions email events…");
  const emailEvents = await paginateAll<
    VinEmailEvent,
    Awaited<ReturnType<typeof fetchVinEmailEvents>>
  >((_, cursor) => fetchVinEmailEvents(apiKey, dealerId, ctx.since, cursor));

  const emailDmsIds = [...new Set(emailEvents.map((e) => e.contactId))];
  const emailCustomerIdMap = await buildCustomerIdMap(ctx.dealershipId, provider, emailDmsIds);

  for (const batch of chunk(emailEvents, 100)) {
    const rows = batch
      .map((e) => {
        const dbCustId = emailCustomerIdMap.get(e.contactId);
        if (!dbCustId) return null;
        return {
          dealership_id: ctx.dealershipId,
          dms_external_id: dmsId(provider, `email:${e.eventId}`),
          customer_id: dbCustId,
          visit_date: e.eventDate,
          service_type: "email_engagement",
          service_notes: `${e.eventType}${e.campaignName ? ` — ${e.campaignName}` : ""}`,
          metadata: { dms_source: { provider, id: e.eventId }, event_type: e.eventType },
        };
      })
      .filter(Boolean) as object[];

    if (rows.length === 0) continue;
    const { error } = await supabase
      .from("visits")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Email event upsert error: ${error.message}`);
    else counts.visits += rows.length;
  }

  return counts;
}

// ---------------------------------------------------------------------------
// vAuto full sync (inventory only)
// ---------------------------------------------------------------------------

async function syncVAutoFull(ctx: SyncContext, jobId: string): Promise<SyncCounts> {
  const supabase = createServiceClient();
  const counts: SyncCounts = { customers: 0, visits: 0, inventory: 0, deals: 0 };
  const provider: DmsProvider = "vauto";

  const { data: conn } = await supabase
    .from("dms_connections")
    .select("encrypted_tokens")
    .eq("id", ctx.connectionId)
    .single();
  if (!conn?.encrypted_tokens) throw new Error("No tokens for vAuto connection");

  const { apiKey, dealerId } = await decryptTokens<{ apiKey: string; dealerId: string }>(
    conn.encrypted_tokens
  );

  await log(jobId, "info", "Fetching vAuto inventory…");
  const vehicles = await paginateAll<
    VAutoVehicle,
    Awaited<ReturnType<typeof fetchVAutoInventory>>
  >((_, cursor) => fetchVAutoInventory(apiKey, dealerId, ctx.since, cursor));

  for (const batch of chunk(vehicles, 100)) {
    const rows = batch.map((v) => ({
      dealership_id: ctx.dealershipId,
      dms_external_id: dmsId(provider, v.stockNumber),
      vin: v.vin,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim ?? null,
      condition: normalizeCondition(v.condition),
      status: v.status,
      price: v.listPrice ?? v.msrp ?? null,
      mileage: v.mileage ?? null,
      color: v.color ?? null,
      days_on_lot: v.daysOnLot ?? null,
      metadata: {
        dms_source:            { provider, id: v.stockNumber },
        appraisal_value:       v.appraisalValue       ?? null,
        market_price:          v.marketPrice          ?? null,
        price_to_market:       v.priceToMarket        ?? null,
        market_days_supply:    v.marketDaysSupply     ?? null,
        retail_rating:         v.retailRating         ?? null,
        suggested_retail:      v.suggestedRetailPrice ?? null,
        turnover_days:         v.turnoverDays         ?? null,
        demand_index:          v.demandIndex          ?? null,
        similar_sold_30d:      v.similarSoldCount30d  ?? null,
      },
    }));
    const { error } = await supabase
      .from("inventory")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Inventory upsert error: ${error.message}`);
    else counts.inventory += batch.length;
  }

  return counts;
}

// ---------------------------------------------------------------------------
// 700Credit sync — soft-pull credit tier enrichment
// ---------------------------------------------------------------------------

async function sync700CreditFull(ctx: SyncContext, jobId: string): Promise<SyncCounts> {
  const supabase = createServiceClient();
  const counts: SyncCounts = { customers: 0, visits: 0, inventory: 0, deals: 0 };

  const { data: conn } = await supabase
    .from("dms_connections")
    .select("encrypted_tokens")
    .eq("id", ctx.connectionId)
    .single();
  if (!conn?.encrypted_tokens) throw new Error("No tokens for 700Credit connection");

  const { apiKey } = await decryptTokens<{ apiKey: string }>(conn.encrypted_tokens);

  // FCRA: only enrich customers with at least 1 prior visit (existing relationship)
  await log(jobId, "info", "Loading customers with existing relationship for 700Credit…");
  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone, address, credit_tier")
    .eq("dealership_id", ctx.dealershipId)
    .gt("total_visits", 0)
    .is("credit_tier", null)
    .limit(500);

  if (!customers || customers.length === 0) {
    await log(jobId, "info", "No customers needing credit enrichment.");
    return counts;
  }

  await log(jobId, "info", `Soft-pulling credit tiers for ${customers.length} customers…`);

  const inputs = customers.map((c) => ({
    externalId: c.id as string,
    consumer: {
      firstName: c.first_name as string,
      lastName: c.last_name as string,
      email: (c.email ?? undefined) as string | undefined,
      phone: (c.phone ?? undefined) as string | undefined,
      address: (c.address as { street?: string; city?: string; state?: string; zip?: string } | null) ?? undefined,
    },
  }));

  // Batch in groups of 50 (API limit)
  for (const batch of chunk(inputs, 50)) {
    const results = await fetchCreditTierBatch(batch, apiKey);
    for (const res of results) {
      await supabase
        .from("customers")
        .update({ credit_tier: res.tier as CreditTier })
        .eq("id", res.externalId)
        .eq("dealership_id", ctx.dealershipId);
      counts.customers++;
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// General CRM full sync
// ---------------------------------------------------------------------------

async function syncGeneralCrmFull(ctx: SyncContext, jobId: string): Promise<SyncCounts> {
  const supabase = createServiceClient();
  const counts: SyncCounts = { customers: 0, visits: 0, inventory: 0, deals: 0 };
  const provider: DmsProvider = "general_crm";

  const { data: conn } = await supabase
    .from("dms_connections")
    .select("encrypted_tokens")
    .eq("id", ctx.connectionId)
    .single();
  if (!conn?.encrypted_tokens) throw new Error("No tokens for General CRM connection");

  const { apiKey, baseUrl } = await decryptTokens<{ apiKey: string; baseUrl?: string }>(
    conn.encrypted_tokens
  );
  const resolvedBase = baseUrl ?? (process.env.GENERAL_CRM_API_BASE ?? "");

  // --- Leads → customers ---
  await log(jobId, "info", "Fetching General CRM leads…");
  const leads = await paginateAll<
    GeneralCrmLead,
    Awaited<ReturnType<typeof fetchGeneralCrmLeads>>
  >((_, cursor) => fetchGeneralCrmLeads(apiKey, resolvedBase, ctx.since, cursor));

  for (const batch of chunk(leads, 100)) {
    const rows = batch.map((l) => ({
      dealership_id: ctx.dealershipId,
      dms_external_id: dmsId(provider, l.leadId),
      first_name: l.firstName,
      last_name: l.lastName,
      email: l.email ?? null,
      phone: l.phone ?? null,
      address: l.address
        ? {
            street: l.address.street ?? null,
            city: l.address.city ?? null,
            state: l.address.state ?? null,
            zip: l.address.zip ?? null,
          }
        : null,
      lifecycle_stage: "prospect" as const,
      metadata: {
        dms_source: { provider, id: l.leadId },
        lead_source: l.leadSource ?? null,
        lead_status: l.leadStatus ?? null,
        vehicle_interest: l.vehicleInterest ?? null,
      },
    }));
    const { error } = await supabase
      .from("customers")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Lead upsert error: ${error.message}`);
    else counts.customers += batch.length;
  }

  // --- Activities → visits ---
  await log(jobId, "info", "Fetching General CRM activities…");
  const activities = await paginateAll<
    GeneralCrmActivity,
    Awaited<ReturnType<typeof fetchGeneralCrmActivities>>
  >((_, cursor) => fetchGeneralCrmActivities(apiKey, resolvedBase, ctx.since, cursor));

  const actDmsIds = [...new Set(activities.map((a) => a.leadId))];
  const customerIdMap = await buildCustomerIdMap(ctx.dealershipId, provider, actDmsIds);

  for (const batch of chunk(activities, 100)) {
    const rows = batch
      .map((a) => {
        const dbCustId = customerIdMap.get(a.leadId);
        if (!dbCustId) return null;
        return {
          dealership_id: ctx.dealershipId,
          dms_external_id: dmsId(provider, `act:${a.activityId}`),
          customer_id: dbCustId,
          visit_date: a.activityDate,
          service_type: "crm_activity",
          service_notes: a.notes ?? null,
          metadata: { dms_source: { provider, id: a.activityId }, activity_type: a.activityType },
        };
      })
      .filter(Boolean) as object[];

    if (rows.length === 0) continue;
    const { error } = await supabase
      .from("visits")
      .upsert(rows, { onConflict: "dealership_id,dms_external_id" });
    if (error) await log(jobId, "warn", `Activity upsert error: ${error.message}`);
    else counts.visits += rows.length;
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Main public function: runSync
// ---------------------------------------------------------------------------

export async function runSync(
  ctx: SyncContext
): Promise<{ jobId: string; counts: SyncCounts }> {
  const supabase = createServiceClient();

  const { data: job, error: jobErr } = await supabase
    .from("sync_jobs")
    .insert({
      dealership_id: ctx.dealershipId,
      connection_id: ctx.connectionId,
      provider: ctx.provider,
      job_type: ctx.jobType,
      status: "running",
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    throw new Error(`Failed to create sync job: ${jobErr?.message}`);
  }
  const jobId = job.id as string;

  await log(jobId, "info", `Starting ${ctx.jobType} sync for ${ctx.provider}`);

  let counts: SyncCounts = { customers: 0, visits: 0, inventory: 0, deals: 0 };

  try {
    if (ctx.provider === "cdk_fortellis") {
      counts = await syncCdkFull(ctx, jobId);
    } else if (ctx.provider === "reynolds") {
      counts = await syncReynoldsFull(ctx, jobId);
    } else if (ctx.provider === "vinsolutions") {
      counts = await syncVinSolutionsFull(ctx, jobId);
    } else if (ctx.provider === "vauto") {
      counts = await syncVAutoFull(ctx, jobId);
    } else if (ctx.provider === "seven_hundred_credit") {
      counts = await sync700CreditFull(ctx, jobId);
    } else if (ctx.provider === "general_crm") {
      counts = await syncGeneralCrmFull(ctx, jobId);
    }

    await supabase
      .from("sync_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_synced: counts,
        cursor: new Date().toISOString(),
      })
      .eq("id", jobId);

    await supabase
      .from("dms_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        status: "active",
        last_error: null,
      })
      .eq("id", ctx.connectionId);

    await log(jobId, "info", "Sync complete", counts);

    // Fire Data Agent in background so swarm re-analyzes fresh data
    void triggerDataAgent(ctx.dealershipId).catch((e) =>
      console.warn("[sync-engine] Data Agent trigger failed:", e)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await log(jobId, "error", `Sync failed: ${message}`);
    await supabase
      .from("sync_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", jobId);
    await supabase
      .from("dms_connections")
      .update({ status: "error", last_error: message })
      .eq("id", ctx.connectionId);
    throw err;
  }

  return { jobId, counts };
}

// ---------------------------------------------------------------------------
// Data Agent trigger (post-sync)
// ---------------------------------------------------------------------------

async function triggerDataAgent(dealershipId: string) {
  const supabase = createServiceClient();

  const [{ data: dealership }, { data: customers }, { data: visits }] =
    await Promise.all([
      supabase
        .from("dealerships")
        .select("name")
        .eq("id", dealershipId)
        .single(),
      supabase
        .from("customers")
        .select("*")
        .eq("dealership_id", dealershipId)
        .limit(200),
      supabase
        .from("visits")
        .select("*")
        .eq("dealership_id", dealershipId)
        .gte(
          "visit_date",
          new Date(Date.now() - 30 * 86400_000).toISOString()
        )
        .limit(100),
    ]);

  if (!dealership || !customers) return;

  await runDataAgent({
    context: {
      dealershipId,
      dealershipName: (dealership as { name: string }).name,
      userId: "system",
    },
    customers: customers as never[],
    recentVisits: visits ?? [],
    question:
      "Post-DMS sync: update segment distribution and flag new churn risks.",
  });
}

// ---------------------------------------------------------------------------
// buildCustomerIdMap — efficient targeted lookup via dms_external_id
// ---------------------------------------------------------------------------

/**
 * Returns a Map<dmsRecordId → db UUID> for the given DMS customer IDs.
 * Queries only the rows we need (by dms_external_id) instead of
 * loading the full customer table.
 */
async function buildCustomerIdMap(
  dealershipId: string,
  provider: DmsProvider,
  dmsIds: string[]
): Promise<Map<string, string>> {
  if (dmsIds.length === 0) return new Map();

  const supabase = createServiceClient();
  const externalIds = dmsIds.map((id) => dmsId(provider, id));

  const { data } = await supabase
    .from("customers")
    .select("id, dms_external_id")
    .eq("dealership_id", dealershipId)
    .in("dms_external_id", externalIds);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.dms_external_id) {
      map.set(rawId(row.dms_external_id as string), row.id as string);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
