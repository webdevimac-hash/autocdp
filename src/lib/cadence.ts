/**
 * Contact cadence system.
 *
 * Enforces a 60-day quiet period after any communication is sent to a customer.
 * Customers not contacted in the window are "eligible"; those contacted recently
 * are "suppressed". The orchestrator respects this before running the agent swarm.
 */

import { createServiceClient } from "@/lib/supabase/server";

export const CADENCE_DAYS = 60;

export interface CadenceRecord {
  customerId: string;
  lastContactedAt: string | null;
  daysSinceContact: number | null;
  eligible: boolean;
  daysUntilEligible: number | null;
}

export interface CadenceSummary {
  totalCustomers: number;
  eligible: number;
  suppressed: number;
  neverContacted: number;
  upcomingBatches: Array<{ date: string; count: number }>;
}

// ---------------------------------------------------------------------------
// Per-customer cadence lookup
// ---------------------------------------------------------------------------

export async function getCadenceStatus(
  dealershipId: string,
  customerIds: string[]
): Promise<Map<string, CadenceRecord>> {
  if (customerIds.length === 0) return new Map();
  const svc = createServiceClient();

  // Latest sent_at per customer within the dealership
  const { data: rows } = await svc
    .from("communications")
    .select("customer_id, sent_at")
    .eq("dealership_id", dealershipId)
    .in("customer_id", customerIds)
    .in("status", ["sent", "delivered", "opened", "clicked", "converted"])
    .order("sent_at", { ascending: false });

  // Keep only the most recent per customer
  const latestByCustomer = new Map<string, string>();
  for (const row of rows ?? []) {
    if (row.customer_id && row.sent_at && !latestByCustomer.has(row.customer_id)) {
      latestByCustomer.set(row.customer_id, row.sent_at);
    }
  }

  const now = Date.now();
  const map = new Map<string, CadenceRecord>();

  for (const id of customerIds) {
    const lastContactedAt = latestByCustomer.get(id) ?? null;
    if (!lastContactedAt) {
      map.set(id, { customerId: id, lastContactedAt: null, daysSinceContact: null, eligible: true, daysUntilEligible: null });
      continue;
    }
    const daysSince = Math.floor((now - new Date(lastContactedAt).getTime()) / 86_400_000);
    const eligible = daysSince >= CADENCE_DAYS;
    map.set(id, {
      customerId: id,
      lastContactedAt,
      daysSinceContact: daysSince,
      eligible,
      daysUntilEligible: eligible ? null : CADENCE_DAYS - daysSince,
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// Dealership-wide cadence summary
// ---------------------------------------------------------------------------

export async function getCadenceSummary(dealershipId: string): Promise<CadenceSummary> {
  const svc = createServiceClient();

  const [{ count: totalCustomers }, { data: sentRows }] = await Promise.all([
    svc
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealershipId) as unknown as Promise<{ count: number | null }>,
    svc
      .from("communications")
      .select("customer_id, sent_at")
      .eq("dealership_id", dealershipId)
      .in("status", ["sent", "delivered", "opened", "clicked", "converted"])
      .order("sent_at", { ascending: false }),
  ]);

  const total = totalCustomers ?? 0;

  // Most recent contact per customer
  const latestByCustomer = new Map<string, string>();
  for (const row of sentRows ?? []) {
    if (row.customer_id && row.sent_at && !latestByCustomer.has(row.customer_id)) {
      latestByCustomer.set(row.customer_id, row.sent_at);
    }
  }

  const now = Date.now();
  let suppressed = 0;
  const suppressedUntilMs: number[] = [];

  for (const [, lastSent] of latestByCustomer) {
    const daysSince = Math.floor((now - new Date(lastSent).getTime()) / 86_400_000);
    if (daysSince < CADENCE_DAYS) {
      suppressed++;
      suppressedUntilMs.push(new Date(lastSent).getTime() + CADENCE_DAYS * 86_400_000);
    }
  }

  const neverContacted = Math.max(0, total - latestByCustomer.size);
  const eligible = Math.max(0, total - suppressed);

  // Group suppressedUntil dates into weekly buckets for the "upcoming waves" view
  const buckets = new Map<string, number>();
  for (const ms of suppressedUntilMs) {
    // Round up to nearest Sunday so nearby dates cluster together
    const d = new Date(ms);
    d.setDate(d.getDate() + (7 - d.getDay()) % 7);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const upcomingBatches = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 6)
    .map(([date, count]) => ({ date, count }));

  return { totalCustomers: total, eligible, suppressed, neverContacted, upcomingBatches };
}

// ---------------------------------------------------------------------------
// Filter helper used by orchestrators
// ---------------------------------------------------------------------------

export function applyCadenceFilter(
  customers: Array<{ id: string }>,
  cadenceMap: Map<string, CadenceRecord>
): { customers: typeof customers; suppressed: number } {
  const passing = customers.filter((c) => cadenceMap.get(c.id)?.eligible !== false);
  return { customers: passing, suppressed: customers.length - passing.length };
}
