/**
 * CRM write-back retry queue — Supabase persistence layer.
 *
 * All queue operations use the service client so they work from both
 * request handlers and cron workers without needing a user session.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { WritebackEvent } from "./field-mapping";

// ---------------------------------------------------------------------------
// JSONB payload stored in activity_payload column
// ---------------------------------------------------------------------------

export interface QueuedWritebackPayload {
  activityType: string;
  subject: string;
  notes: string;
  activityDate: string;
  completedDate: string;
  /** Human-readable channel label — stored for retry worker context */
  channel?: string;
  /** Customer display name — stored so retry notes remain personalised */
  customerName?: string;
}

// ---------------------------------------------------------------------------
// Row shape returned from Supabase
// ---------------------------------------------------------------------------

export interface WritebackQueueRow {
  id: string;
  dealership_id: string;
  customer_id: string;
  provider: string;
  native_id: string;
  event_type: WritebackEvent;
  activity_payload: QueuedWritebackPayload;
  status: "pending" | "processing" | "succeeded" | "dead";
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  last_attempted_at: string | null;
  next_retry_at: string;
  succeeded_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Queue stats (for integrations UI)
// ---------------------------------------------------------------------------

export interface QueueStats {
  pending: number;
  dead: number;
  oldestDeadAt: string | null;
}

// ---------------------------------------------------------------------------
// Exponential back-off: 30 s → 1 min → 2 min → 4 min → ... cap 1 hour
// ---------------------------------------------------------------------------

function nextRetrySeconds(attempts: number): number {
  return Math.min(3600, 30 * Math.pow(2, attempts));
}

// ---------------------------------------------------------------------------
// Enqueue a failed write-back for later retry
// ---------------------------------------------------------------------------

export async function enqueueWriteback(args: {
  dealershipId: string;
  customerId: string;
  provider: string;
  nativeId: string;
  eventType: WritebackEvent;
  payload: QueuedWritebackPayload;
}): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from("crm_writeback_queue")
    .insert({
      dealership_id:    args.dealershipId,
      customer_id:      args.customerId,
      provider:         args.provider,
      native_id:        args.nativeId,
      event_type:       args.eventType,
      activity_payload: args.payload,
      status:           "pending",
      attempts:         0,
      next_retry_at:    new Date(Date.now() + nextRetrySeconds(0) * 1000).toISOString(),
    } as Record<string, unknown>)
    .then(() => null)
    .catch((e: Error) => console.warn("[writeback-queue] enqueue failed:", e.message));
}

// ---------------------------------------------------------------------------
// Claim up to `limit` pending rows (sets status=processing atomically)
// ---------------------------------------------------------------------------

export async function claimPendingWritebacks(
  limit = 20
): Promise<WritebackQueueRow[]> {
  const svc = createServiceClient();

  // Fetch due rows
  const { data } = await svc
    .from("crm_writeback_queue")
    .select("*")
    .eq("status", "pending")
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit) as unknown as { data: WritebackQueueRow[] | null };

  if (!data || data.length === 0) return [];

  const ids = data.map((r) => r.id);

  // Mark as processing
  await svc
    .from("crm_writeback_queue")
    .update({ status: "processing", last_attempted_at: new Date().toISOString() } as Record<string, unknown>)
    .in("id", ids);

  return data;
}

// ---------------------------------------------------------------------------
// Mark a row succeeded
// ---------------------------------------------------------------------------

export async function markWritebackSucceeded(id: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from("crm_writeback_queue")
    .update({ status: "succeeded", succeeded_at: new Date().toISOString() } as Record<string, unknown>)
    .eq("id", id);
}

// ---------------------------------------------------------------------------
// Mark a row failed — reschedule or dead-letter if exhausted
// ---------------------------------------------------------------------------

export async function markWritebackFailed(
  row: WritebackQueueRow,
  errorMessage: string
): Promise<void> {
  const svc = createServiceClient();
  const newAttempts = row.attempts + 1;
  const isDead = newAttempts >= row.max_attempts;

  await svc
    .from("crm_writeback_queue")
    .update({
      status:           isDead ? "dead" : "pending",
      attempts:         newAttempts,
      last_error:       errorMessage.slice(0, 1000),
      last_attempted_at: new Date().toISOString(),
      next_retry_at:    isDead
        ? new Date().toISOString()
        : new Date(Date.now() + nextRetrySeconds(newAttempts) * 1000).toISOString(),
    } as Record<string, unknown>)
    .eq("id", row.id);
}

// ---------------------------------------------------------------------------
// Queue stats for a dealership (used by integrations page)
// ---------------------------------------------------------------------------

export async function getQueueStats(dealershipId: string): Promise<QueueStats> {
  const svc = createServiceClient();

  const [pendingRes, deadRes] = await Promise.all([
    svc
      .from("crm_writeback_queue")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealershipId)
      .in("status", ["pending", "processing"]) as unknown as Promise<{ count: number | null }>,

    svc
      .from("crm_writeback_queue")
      .select("created_at")
      .eq("dealership_id", dealershipId)
      .eq("status", "dead")
      .order("created_at", { ascending: true })
      .limit(1) as unknown as Promise<{ data: { created_at: string }[] | null }>,
  ]);

  const deadCountRes = await svc
    .from("crm_writeback_queue")
    .select("id", { count: "exact", head: true })
    .eq("dealership_id", dealershipId)
    .eq("status", "dead") as unknown as { count: number | null };

  return {
    pending:      pendingRes.count ?? 0,
    dead:         deadCountRes.count ?? 0,
    oldestDeadAt: deadRes.data?.[0]?.created_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Fetch dead rows for audit log display
// ---------------------------------------------------------------------------

export async function getDeadWritebacks(
  dealershipId: string,
  limit = 50
): Promise<WritebackQueueRow[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("crm_writeback_queue")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("status", "dead")
    .order("created_at", { ascending: false })
    .limit(limit) as unknown as { data: WritebackQueueRow[] | null };
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Fetch recent succeeded rows for audit log display
// ---------------------------------------------------------------------------

export async function getRecentSucceededWritebacks(
  dealershipId: string,
  limit = 50
): Promise<WritebackQueueRow[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("crm_writeback_queue")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("status", "succeeded")
    .order("succeeded_at", { ascending: false })
    .limit(limit) as unknown as { data: WritebackQueueRow[] | null };
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Write-back activity summary — today / yesterday / 7-day / total per provider
// ---------------------------------------------------------------------------

export interface ProviderWritebackSummary {
  provider: string;
  /** Count of succeeded pushes in the calendar day (UTC) */
  today: number;
  yesterday: number;
  week: number;
  total: number;
  /** event_type → count for today */
  todayByEvent: Record<string, number>;
  lastSucceededAt: string | null;
}

export async function getWritebackSummary(
  dealershipId: string
): Promise<ProviderWritebackSummary[]> {
  const svc = createServiceClient();

  // Fetch last 30 days of succeeded rows (light: only the columns we need)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await svc
    .from("crm_writeback_queue")
    .select("provider, event_type, succeeded_at")
    .eq("dealership_id", dealershipId)
    .eq("status", "succeeded")
    .gte("succeeded_at", thirtyDaysAgo)
    .order("succeeded_at", { ascending: false })
    .limit(5000) as unknown as {
      data: { provider: string; event_type: string; succeeded_at: string | null }[] | null;
    };

  // Also get all-time total per provider (separate lightweight query)
  const { data: totalData } = await svc
    .from("crm_writeback_queue")
    .select("provider")
    .eq("dealership_id", dealershipId)
    .eq("status", "succeeded")
    .limit(50000) as unknown as { data: { provider: string }[] | null };

  const rows = data ?? [];

  // Calendar boundaries in UTC
  const now   = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart      = todayStart - 6 * 86_400_000;

  // Aggregate per provider
  const byProvider = new Map<string, ProviderWritebackSummary>();

  for (const row of rows) {
    const ts = row.succeeded_at ? new Date(row.succeeded_at).getTime() : 0;
    if (!byProvider.has(row.provider)) {
      byProvider.set(row.provider, {
        provider:        row.provider,
        today:           0,
        yesterday:       0,
        week:            0,
        total:           0,
        todayByEvent:    {},
        lastSucceededAt: row.succeeded_at ?? null, // first seen = most recent (sorted desc)
      });
    }
    const s = byProvider.get(row.provider)!;
    if (ts >= todayStart)     { s.today++; s.todayByEvent[row.event_type] = (s.todayByEvent[row.event_type] ?? 0) + 1; }
    if (ts >= yesterdayStart && ts < todayStart) s.yesterday++;
    if (ts >= weekStart)      s.week++;
  }

  // All-time totals from the broader query
  for (const row of totalData ?? []) {
    if (!byProvider.has(row.provider)) {
      byProvider.set(row.provider, {
        provider: row.provider, today: 0, yesterday: 0, week: 0, total: 0,
        todayByEvent: {}, lastSucceededAt: null,
      });
    }
    byProvider.get(row.provider)!.total++;
  }

  return [...byProvider.values()].sort((a, b) => b.total - a.total);
}
