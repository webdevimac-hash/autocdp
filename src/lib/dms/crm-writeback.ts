/**
 * CRM Write-Back Orchestrator
 *
 * After any AutoCDP campaign event (send, QR scan, email open, booking),
 * this module fires a native activity/note into the dealer's CRM so BDC
 * staff see the full history without leaving their CRM.
 *
 * Execution model: fire-and-forget (never blocks the caller).
 * On transient failure the write-back is queued and retried with exponential
 * back-off (up to 5 attempts, max 1-hour gap).  Permanent failures (4xx) are
 * dead-lettered immediately.
 *
 * Plugin Mode: per-provider opt-in stored in dms_connections.metadata.plugin_mode.
 * Only connections with plugin_mode = true receive write-back events.
 *
 * Supported providers:
 *   vinsolutions — createVinActivity
 *   dealertrack  — createDealertrackActivity (OAuth token auto-managed)
 *   elead        — createEleadActivity
 */

import { createServiceClient } from "@/lib/supabase/server";
import { decryptTokens } from "./encrypt";
import { createVinActivity } from "./vinsolutions";
import { getDealertrackToken, createDealertrackActivity } from "./dealertrack";
import { createEleadActivity } from "./elead";
import { WritebackError } from "./errors";
import {
  enqueueWriteback,
  markWritebackSucceeded,
  markWritebackFailed,
  type WritebackQueueRow,
  type QueuedWritebackPayload,
} from "./writeback-queue";

// ---------------------------------------------------------------------------
// Public payload type
// ---------------------------------------------------------------------------

export type WritebackEvent =
  | "campaign_sent"
  | "qr_scanned"
  | "email_opened"
  | "link_clicked"
  | "booking_made";

export interface WritebackPayload {
  dealershipId: string;
  customerId: string;         // AutoCDP customer UUID
  eventType: WritebackEvent;
  channel?: "direct_mail" | "sms" | "email";
  campaignGoal?: string;
  copyExcerpt?: string;       // First 300 chars of generated copy
  offer?: string | null;
  communicationId?: string;
  bookingUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Human-readable event labels
// ---------------------------------------------------------------------------

const EVENT_LABELS: Record<WritebackEvent, string> = {
  campaign_sent: "AutoCDP — Campaign Sent",
  qr_scanned:    "AutoCDP — QR Code Scanned",
  email_opened:  "AutoCDP — Email Opened",
  link_clicked:  "AutoCDP — Link Clicked",
  booking_made:  "AutoCDP — Appointment Booked",
};

const EVENT_TYPES: Record<WritebackEvent, string> = {
  campaign_sent: "AutoCDP Campaign",
  qr_scanned:    "AutoCDP Scan",
  email_opened:  "AutoCDP Email",
  link_clicked:  "AutoCDP Click",
  booking_made:  "AutoCDP Booking",
};

// ---------------------------------------------------------------------------
// Build the CRM note body
// ---------------------------------------------------------------------------

function buildNoteBody(payload: WritebackPayload): string {
  const lines: string[] = [];
  lines.push(`[AutoCDP Plugin] ${EVENT_LABELS[payload.eventType]}`);
  if (payload.channel)       lines.push(`Channel: ${payload.channel.replace("_", " ")}`);
  if (payload.campaignGoal)  lines.push(`Goal: ${payload.campaignGoal}`);
  if (payload.offer)         lines.push(`Offer: ${payload.offer}`);
  if (payload.copyExcerpt)   lines.push(`\nMessage excerpt:\n${payload.copyExcerpt}`);
  if (payload.bookingUrl)    lines.push(`\nBooking link: ${payload.bookingUrl}`);
  if (payload.communicationId) lines.push(`\nCommunication ID: ${payload.communicationId}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main entry point — fire-and-forget wrapper
// ---------------------------------------------------------------------------

/**
 * Call this anywhere a campaign event occurs. Non-blocking.
 * Pattern: `fireWriteback(payload)` — no await needed.
 */
export function fireWriteback(payload: WritebackPayload): void {
  void _fireWriteback(payload).catch((err) =>
    console.warn("[crm-writeback] Write-back error (non-fatal):", err)
  );
}

// ---------------------------------------------------------------------------
// Internal implementation — resolves CRM identity then dispatches
// ---------------------------------------------------------------------------

async function _fireWriteback(payload: WritebackPayload): Promise<void> {
  const supabase = createServiceClient();

  // 1. Get the customer's CRM origin from their dms_external_id
  const { data: customer } = await supabase
    .from("customers")
    .select("dms_external_id, first_name, last_name")
    .eq("id", payload.customerId)
    .eq("dealership_id", payload.dealershipId)
    .single();

  if (!customer?.dms_external_id) return; // Not a CRM-imported customer — skip

  const dmsExtId = customer.dms_external_id as string;
  const colonIdx = dmsExtId.indexOf(":");
  if (colonIdx === -1) return;

  const provider = dmsExtId.slice(0, colonIdx);
  const nativeId = dmsExtId.slice(colonIdx + 1);

  // Only handle the three plugin-capable CRM providers
  if (!["vinsolutions", "dealertrack", "elead"].includes(provider)) return;

  // 2. Check that this provider has Plugin Mode enabled for this dealership
  const { data: conn } = await supabase
    .from("dms_connections")
    .select("id, encrypted_tokens, metadata")
    .eq("dealership_id", payload.dealershipId)
    .eq("provider", provider)
    .eq("status", "active")
    .maybeSingle();

  if (!conn) return;
  const meta = conn.metadata as Record<string, unknown> | null;
  if (!meta?.plugin_mode) return; // Plugin Mode not enabled — skip silently

  // 3. Build the activity payload
  const now        = new Date().toISOString();
  const subject    = EVENT_LABELS[payload.eventType];
  const notes      = buildNoteBody(payload);
  const actType    = EVENT_TYPES[payload.eventType];
  const actPayload: QueuedWritebackPayload = {
    activityType:  actType,
    subject,
    notes,
    activityDate:  now,
    completedDate: now,
    channel:       payload.channel,
  };

  // 4. Decrypt credentials and dispatch — enqueue on failure
  let tokens: Record<string, string>;
  try {
    tokens = await decryptTokens<Record<string, string>>(
      conn.encrypted_tokens as string
    );
  } catch (err) {
    console.warn("[crm-writeback] Token decrypt failed — cannot dispatch or queue:", err);
    return;
  }

  try {
    await dispatchWriteback(provider, nativeId, tokens, actPayload);
  } catch (err) {
    const isRetryable = err instanceof WritebackError ? err.isRetryable : true;
    const errorMsg    = err instanceof Error ? err.message : String(err);

    if (isRetryable) {
      console.warn(`[crm-writeback] Transient error — queueing for retry: ${errorMsg}`);
      await enqueueWriteback({
        dealershipId: payload.dealershipId,
        customerId:   payload.customerId,
        provider,
        nativeId,
        eventType:    payload.eventType,
        payload:      actPayload,
      });
    } else {
      // Permanent 4xx — dead-letter immediately (no retries)
      console.warn(`[crm-writeback] Permanent error — dead-lettering: ${errorMsg}`);
      await enqueueWriteback({
        dealershipId: payload.dealershipId,
        customerId:   payload.customerId,
        provider,
        nativeId,
        eventType:    payload.eventType,
        payload:      actPayload,
      }).then(async () => {
        // Immediately exhaust attempts so it becomes dead
        const supabaseSvc = createServiceClient();
        await supabaseSvc
          .from("crm_writeback_queue")
          .update({
            status:    "dead",
            attempts:  5,
            last_error: errorMsg.slice(0, 1000),
          } as Record<string, unknown>)
          .eq("dealership_id", payload.dealershipId)
          .eq("customer_id", payload.customerId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1);
      });
    }

    // Log to sync_logs regardless
    await supabase
      .from("sync_logs")
      .insert({
        job_id:  `writeback-${payload.communicationId ?? payload.customerId}`,
        level:   "error",
        message: `Plugin write-back failed: ${provider} ← ${payload.eventType}`,
        data: {
          provider, nativeId,
          customerId: payload.customerId,
          eventType:  payload.eventType,
          error:      errorMsg.slice(0, 500),
          isRetryable,
        },
      })
      .catch(() => null);

    return;
  }

  // 5. Audit log — success
  await supabase
    .from("sync_logs")
    .insert({
      job_id:  `writeback-${payload.communicationId ?? payload.customerId}`,
      level:   "info",
      message: `Plugin write-back: ${provider} ← ${payload.eventType}`,
      data: {
        provider,
        nativeId,
        customerId: payload.customerId,
        eventType:  payload.eventType,
        channel:    payload.channel ?? null,
      },
    })
    .catch(() => null);
}

// ---------------------------------------------------------------------------
// dispatchWriteback — shared by the initial attempt and the retry cron worker
// ---------------------------------------------------------------------------

/**
 * Actually calls the CRM adapter.  Throws WritebackError on failure.
 * Exported so the retry cron worker can call it with resolved credentials.
 */
export async function dispatchWriteback(
  provider: string,
  nativeId: string,
  tokens: Record<string, string>,
  actPayload: QueuedWritebackPayload
): Promise<void> {
  if (provider === "vinsolutions") {
    await createVinActivity(tokens.apiKey, tokens.dealerId, {
      contactId:     nativeId,
      activityType:  actPayload.activityType,
      subject:       actPayload.subject,
      notes:         actPayload.notes,
      activityDate:  actPayload.activityDate,
      completedDate: actPayload.completedDate,
    });
  } else if (provider === "dealertrack") {
    const dtToken = await getDealertrackToken(tokens.clientId, tokens.clientSecret);
    await createDealertrackActivity(dtToken, nativeId, {
      activityType:  actPayload.activityType,
      subject:       actPayload.subject,
      notes:         actPayload.notes,
      activityDate:  actPayload.activityDate,
      completedDate: actPayload.completedDate,
    });
  } else if (provider === "elead") {
    await createEleadActivity(tokens.apiKey, tokens.dealerId, nativeId, {
      activityType:  actPayload.activityType,
      subject:       actPayload.subject,
      notes:         actPayload.notes,
      activityDate:  actPayload.activityDate,
      completedDate: actPayload.completedDate,
    });
  } else {
    throw new WritebackError(`Unknown CRM provider: ${provider}`, 0);
  }
}

// ---------------------------------------------------------------------------
// processQueueRow — used by the cron worker for a single queue row
// ---------------------------------------------------------------------------

/**
 * Retry a single queued write-back row.
 * Resolves credentials fresh, calls dispatchWriteback, marks success or failure.
 */
export async function processQueueRow(row: WritebackQueueRow): Promise<void> {
  const svc = createServiceClient();

  // Fetch credentials from the live dms_connections record
  const { data: conn } = await svc
    .from("dms_connections")
    .select("encrypted_tokens")
    .eq("dealership_id", row.dealership_id)
    .eq("provider", row.provider)
    .eq("status", "active")
    .maybeSingle();

  if (!conn?.encrypted_tokens) {
    await markWritebackFailed(row, "No active connection found — credentials unavailable");
    return;
  }

  let tokens: Record<string, string>;
  try {
    tokens = await decryptTokens<Record<string, string>>(
      conn.encrypted_tokens as string
    );
  } catch (err) {
    await markWritebackFailed(row, `Token decrypt failed: ${String(err)}`);
    return;
  }

  try {
    await dispatchWriteback(row.provider, row.native_id, tokens, row.activity_payload);
    await markWritebackSucceeded(row.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markWritebackFailed(row, msg);
  }
}
