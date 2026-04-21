/**
 * Per-dealership daily rate limiting.
 *
 * Uses the existing billing_events table — no migrations needed.
 * Limits reset at UTC midnight.
 *
 * Usage:
 *   const check = await checkRateLimit(dealershipId, "mail_piece_sent", requestedQty);
 *   if (!check.allowed) return NextResponse.json({ error: "DAILY_LIMIT" }, { status: 429 });
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { BillingEventType } from "@/types";

// Hard limits per event type per day
export const DAILY_LIMITS: Partial<Record<BillingEventType, number>> = {
  mail_piece_sent: 500,
  agent_run:       200,
  sms_sent:        1_000,
  email_sent:      5_000,
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

function startOfDayUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Check whether a dealership can perform `quantity` more of `eventType` today. */
export async function checkRateLimit(
  dealershipId: string,
  eventType: BillingEventType,
  quantity = 1
): Promise<RateLimitResult> {
  const limit = DAILY_LIMITS[eventType];
  if (!limit) {
    // No limit defined for this event type
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
  mail_piece_sent: number;
  agent_run:       number;
  sms_sent:        number;
  email_sent:      number;
  totalCostCents:  number;
  hasWarning:      boolean; // any event type is near its limit
}

/** Fetch today's usage across all metered event types (for banners / billing page). */
export async function getDailyUsage(dealershipId: string): Promise<DailyUsageSummary> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("billing_events")
    .select("event_type, quantity, unit_cost_cents")
    .eq("dealership_id", dealershipId)
    .gte("created_at", startOfDayUtc()) as {
      data: { event_type: string; quantity: number; unit_cost_cents: number }[] | null;
    };

  const counts: Record<string, number> = {
    mail_piece_sent: 0,
    agent_run:       0,
    sms_sent:        0,
    email_sent:      0,
  };
  let totalCostCents = 0;

  for (const e of data ?? []) {
    counts[e.event_type] = (counts[e.event_type] ?? 0) + (e.quantity ?? 1);
    totalCostCents += e.unit_cost_cents ?? 0;
  }

  const hasWarning = (Object.entries(DAILY_LIMITS) as [string, number][]).some(
    ([type, limit]) => (counts[type] ?? 0) >= limit * WARN_FRACTION
  );

  return {
    mail_piece_sent: counts.mail_piece_sent,
    agent_run:       counts.agent_run,
    sms_sent:        counts.sms_sent,
    email_sent:      counts.email_sent,
    totalCostCents,
    hasWarning,
  };
}
