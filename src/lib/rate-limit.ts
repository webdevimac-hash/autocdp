/**
 * Per-dealership daily rate limiting.
 *
 * Uses the existing billing_events table — limits reset at UTC midnight.
 * Per-dealership overrides are stored in the dealership_limits table.
 * Null overrides fall through to the global DAILY_LIMITS below.
 *
 * Usage:
 *   const check = await checkRateLimit(dealershipId, "mail_piece_sent", requestedQty);
 *   if (!check.allowed) return NextResponse.json({ error: "DAILY_LIMIT" }, { status: 429 });
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { BillingEventType } from "@/types";

// Global fallback limits — overridden per-dealership via dealership_limits table
export const DAILY_LIMITS: Partial<Record<BillingEventType, number>> = {
  mail_piece_sent: 500,
  agent_run:       200,
  sms_sent:        1_000,
  email_sent:      5_000,
};

// Unit cost estimates (cents) — used for spend tracking and UI display
export const COST_PER_EVENT: Partial<Record<BillingEventType, number>> = {
  mail_piece_sent: 120,  // ~$1.20
  agent_run:         5,  // ~$0.05
  sms_sent:          2,  // ~$0.02
  email_sent:        0,  // included in plan
};

// Emit a warning banner when this fraction of the limit is consumed
export const WARN_FRACTION = 0.8;

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  nearLimit: boolean; // true when > WARN_FRACTION of limit used
}

export interface DealershipLimitRow {
  mail_piece_sent: number | null;
  agent_run:       number | null;
  sms_sent:        number | null;
  email_sent:      number | null;
  daily_cost_limit_cents: number;
}

function startOfDayUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Fetch per-dealership limit overrides (falls back to DAILY_LIMITS when null).
 * Cached per-request — call once and reuse the result.
 */
export async function getDealershipLimits(
  dealershipId: string
): Promise<{ limits: Partial<Record<BillingEventType, number>>; dailyCostLimitCents: number }> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("dealership_limits")
    .select("mail_piece_sent, agent_run, sms_sent, email_sent, daily_cost_limit_cents")
    .eq("dealership_id", dealershipId)
    .single() as { data: DealershipLimitRow | null };

  const limits: Partial<Record<BillingEventType, number>> = {
    mail_piece_sent: data?.mail_piece_sent ?? DAILY_LIMITS.mail_piece_sent,
    agent_run:       data?.agent_run       ?? DAILY_LIMITS.agent_run,
    sms_sent:        data?.sms_sent        ?? DAILY_LIMITS.sms_sent,
    email_sent:      data?.email_sent      ?? DAILY_LIMITS.email_sent,
  };

  return {
    limits,
    dailyCostLimitCents: data?.daily_cost_limit_cents ?? 0,
  };
}

/** Check whether a dealership can perform `quantity` more of `eventType` today. */
export async function checkRateLimit(
  dealershipId: string,
  eventType: BillingEventType,
  quantity = 1
): Promise<RateLimitResult> {
  const { limits } = await getDealershipLimits(dealershipId);
  const limit = limits[eventType];

  if (!limit) {
    return { allowed: true, count: 0, limit: Infinity, remaining: Infinity, nearLimit: false };
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("billing_events")
    .select("quantity")
    .eq("dealership_id", dealershipId)
    .eq("event_type", eventType)
    .gte("created_at", startOfDayUtc()) as {
      data: { quantity: number }[] | null;
    };

  const count = (data ?? []).reduce((s, e) => s + (e.quantity ?? 1), 0);
  const remaining = Math.max(0, limit - count);
  const allowed = count + quantity <= limit;
  const nearLimit = count >= limit * WARN_FRACTION;

  return { allowed, count, limit, remaining, nearLimit };
}

export interface DailyUsageSummary {
  mail_piece_sent:       number;
  agent_run:             number;
  sms_sent:              number;
  email_sent:            number;
  totalCostCents:        number;
  estimatedCostCents:    number; // cost based on COST_PER_EVENT unit prices
  dailyCostLimitCents:   number; // 0 = no cap
  limits:                Partial<Record<BillingEventType, number>>;
  hasWarning:            boolean; // any event type is near its limit
  costWarning:           boolean; // cost is near the daily spend limit
}

/** Fetch today's usage across all metered event types (for banners / billing page). */
export async function getDailyUsage(dealershipId: string): Promise<DailyUsageSummary> {
  const supabase = createServiceClient();
  const [{ data }, { limits, dailyCostLimitCents }] = await Promise.all([
    supabase
      .from("billing_events")
      .select("event_type, quantity, unit_cost_cents")
      .eq("dealership_id", dealershipId)
      .gte("created_at", startOfDayUtc()) as Promise<{
        data: { event_type: string; quantity: number; unit_cost_cents: number }[] | null;
      }>,
    getDealershipLimits(dealershipId),
  ]);

  const counts: Record<string, number> = {
    mail_piece_sent: 0,
    agent_run:       0,
    sms_sent:        0,
    email_sent:      0,
  };
  let totalCostCents = 0;

  for (const e of data ?? []) {
    counts[e.event_type] = (counts[e.event_type] ?? 0) + (e.quantity ?? 1);
    totalCostCents += (e.unit_cost_cents ?? 0) * (e.quantity ?? 1);
  }

  // Estimated cost from unit prices (fallback when billing_events.unit_cost_cents is 0)
  const estimatedCostCents =
    (counts.mail_piece_sent * (COST_PER_EVENT.mail_piece_sent ?? 0)) +
    (counts.agent_run       * (COST_PER_EVENT.agent_run       ?? 0)) +
    (counts.sms_sent        * (COST_PER_EVENT.sms_sent        ?? 0)) +
    (counts.email_sent      * (COST_PER_EVENT.email_sent      ?? 0));

  const effectiveCost = totalCostCents > 0 ? totalCostCents : estimatedCostCents;

  const hasWarning = (Object.entries(limits) as [string, number][]).some(
    ([type, limit]) => limit > 0 && (counts[type] ?? 0) >= limit * WARN_FRACTION
  );

  const costWarning =
    dailyCostLimitCents > 0 && effectiveCost >= dailyCostLimitCents * WARN_FRACTION;

  return {
    mail_piece_sent:     counts.mail_piece_sent,
    agent_run:           counts.agent_run,
    sms_sent:            counts.sms_sent,
    email_sent:          counts.email_sent,
    totalCostCents,
    estimatedCostCents,
    dailyCostLimitCents,
    limits,
    hasWarning: hasWarning || costWarning,
    costWarning,
  };
}
