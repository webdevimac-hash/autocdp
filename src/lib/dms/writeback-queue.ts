/**
 * CRM write-back retry queue — Supabase persistence layer.
 *
 * All queue operations use the service client so they work from both
 * request handlers and cron workers without needing a user session.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { WritebackEvent } from "./crm-writeback";

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
