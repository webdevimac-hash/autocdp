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
  customerId: string;       // AutoCDP customer UUID
  eventType: WritebackEvent;
  channel?: "direct_mail" | "sms" | "email";
  campaignGoal?: string;
  campaignName?: string;    // optional human-readable campaign name
  copyExcerpt?: string;     // first ~300 chars of generated copy
  offer?: string | null;
  communicationId?: string;
  bookingUrl?: string | null;
  qrScanUrl?: string | null; // landing URL the QR pointed to
}

// ---------------------------------------------------------------------------
// Channel labels — convert internal keys to human-readable strings
// ---------------------------------------------------------------------------

const CHANNEL_LABELS: Record<string, string> = {
  direct_mail: "Direct Mail",
  sms:         "SMS Text Message",
  email:       "Email Campaign",
};

function channelLabel(channel?: string): string {
  return channel ? (CHANNEL_LABELS[channel] ?? channel) : "Campaign";
}

// ---------------------------------------------------------------------------
// Activity types — use CRM-native-sounding labels (free-form in all 3 CRMs)
// ---------------------------------------------------------------------------

const ACTIVITY_TYPES: Record<WritebackEvent, string> = {
  campaign_sent: "Marketing Outreach",
  qr_scanned:    "Customer Response",
  email_opened:  "Email Engagement",
  link_clicked:  "Digital Engagement",
  booking_made:  "Appointment Request",
};

// ---------------------------------------------------------------------------
// Subject lines — specific one-liners that look great in a CRM timeline
// ---------------------------------------------------------------------------

function buildSubject(
  eventType: WritebackEvent,
  payload: WritebackPayload,
  firstName: string
): string {
  const ch  = channelLabel(payload.channel);
  const goal = payload.campaignGoal ? ` — ${payload.campaignGoal}` : "";
  const offer = payload.offer ? ` — ${payload.offer}` : "";

  switch (eventType) {
    case "campaign_sent":
      return payload.offer
        ? `${ch} Delivered to ${firstName}${offer}`
        : `${ch} Delivered to ${firstName}${goal}`;

    case "qr_scanned":
      return payload.offer
        ? `QR Scanned — ${firstName} Interested in ${payload.offer}`
        : `QR Scanned — ${firstName} Responded to ${ch}`;

    case "email_opened":
      return payload.offer
        ? `Email Opened — ${firstName} Viewed ${payload.offer}`
        : `Email Opened — ${firstName} Engaged with ${ch}`;

    case "link_clicked":
      return payload.offer
        ? `Link Clicked — ${firstName} Interested in ${payload.offer}`
        : `Link Clicked — ${firstName} Clicked Through ${ch}`;

    case "booking_made":
      return payload.campaignGoal
        ? `Appointment Booked — ${firstName} · ${payload.campaignGoal}`
        : `Appointment Booked — ${firstName} via AutoCDP Campaign`;
  }
}

// ---------------------------------------------------------------------------
// Rich note body — event-specific branded templates
// ---------------------------------------------------------------------------

const DIVIDER  = "─".repeat(47);
const HDIVIDER = "═".repeat(47);

function fmt(date: string): string {
  try {
    return new Date(date).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
  } catch { return date; }
}

function fmtDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return date; }
}

function campaignBlock(payload: WritebackPayload): string {
  const lines: string[] = ["📋 CAMPAIGN DETAILS"];
  if (payload.channel)      lines.push(`   Channel:  ${channelLabel(payload.channel)}`);
  if (payload.campaignGoal) lines.push(`   Goal:     ${payload.campaignGoal}`);
  if (payload.offer)        lines.push(`   Offer:    ${payload.offer}`);
  if (payload.campaignName) lines.push(`   Campaign: ${payload.campaignName}`);
  return lines.join("\n");
}

function buildRichNote(
  eventType: WritebackEvent,
  payload: WritebackPayload,
  customerName: string,
  firstName: string,
  now: string
): string {
  const refLine = payload.communicationId
    ? `Ref: ${payload.communicationId} · `
    : "";

  const footer = [
    DIVIDER,
    `${refLine}Sent via AutoCDP · autocdp.com`,
  ].join("\n");

  switch (eventType) {

    // ── CAMPAIGN SENT ────────────────────────────────────────────────────────
    case "campaign_sent": {
      const parts: string[] = [
        HDIVIDER,
        `  📬 ${channelLabel(payload.channel).toUpperCase()} DELIVERED`,
        HDIVIDER,
        `Customer: ${customerName}`,
        `Sent:     ${fmt(now)}`,
        "",
        campaignBlock(payload),
      ];

      if (payload.copyExcerpt) {
        parts.push(
          "",
          "✉ MESSAGE EXCERPT",
          `   "${payload.copyExcerpt.trim().slice(0, 280)}${payload.copyExcerpt.length > 280 ? "…" : ""}"`,
        );
      }

      parts.push(
        "",
        "💡 NEXT STEP",
        `   If ${firstName} contacts the dealership, reference this campaign.`,
        "   Log any inbound calls or replies as a follow-up activity.",
        "",
        footer,
      );
      return parts.join("\n");
    }

    // ── QR SCANNED ──────────────────────────────────────────────────────────
    case "qr_scanned": {
      const parts: string[] = [
        HDIVIDER,
        "  📲 QR CODE SCANNED — CUSTOMER ENGAGED",
        HDIVIDER,
        `Customer: ${customerName}`,
        `Scanned:  ${fmt(now)}`,
        "",
        "⚡ FOLLOW UP WITHIN 24 HOURS",
        `   ${firstName} just scanned the QR code from your campaign.`,
        "   They are actively considering — strike while interest is hot.",
        "",
        campaignBlock(payload),
      ];

      if (payload.qrScanUrl) {
        parts.push("", `🔗 QR DESTINATION`, `   ${payload.qrScanUrl}`);
      }

      parts.push(
        "",
        "💬 SUGGESTED OPENER",
        `   "Hi ${firstName}, I'm following up on the ${channelLabel(payload.channel).toLowerCase()}`,
        `   we sent about ${payload.offer ?? payload.campaignGoal ?? "our latest offer"}.`,
        `   Did you get a chance to look it over?"`,
        "",
        footer,
      );
      return parts.join("\n");
    }

    // ── EMAIL OPENED ────────────────────────────────────────────────────────
    case "email_opened": {
      const parts: string[] = [
        HDIVIDER,
        "  📧 EMAIL OPENED — CUSTOMER SAW YOUR MESSAGE",
        HDIVIDER,
        `Customer: ${customerName}`,
        `Opened:   ${fmt(now)}`,
        "",
        campaignBlock(payload),
        "",
        "💡 NEXT STEP",
        `   ${firstName} opened this email but has not yet responded.`,
        "   Consider a follow-up call or text if no action within 48 hours.",
        "",
        footer,
      ];
      return parts.join("\n");
    }

    // ── LINK CLICKED ────────────────────────────────────────────────────────
    case "link_clicked": {
      const parts: string[] = [
        HDIVIDER,
        "  🖱 LINK CLICKED — STRONG BUYING SIGNAL",
        HDIVIDER,
        `Customer: ${customerName}`,
        `Clicked:  ${fmt(now)}`,
        "",
        `⚡ ${firstName} clicked through your campaign — they are interested.`,
        "   Reach out soon to convert this engagement into an appointment.",
        "",
        campaignBlock(payload),
        "",
        "💬 SUGGESTED OPENER",
        `   "Hi ${firstName}, I noticed you checked out our`,
        `   ${payload.offer ?? payload.campaignGoal ?? "offer"} — any questions I can answer?"`,
        "",
        footer,
      ];
      return parts.join("\n");
    }

    // ── BOOKING MADE ────────────────────────────────────────────────────────
    case "booking_made": {
      const parts: string[] = [
        HDIVIDER,
        "  ✅ APPOINTMENT BOOKED — ACTION REQUIRED",
        HDIVIDER,
        `Customer: ${customerName}`,
        `Booked:   ${fmt(now)}`,
        "",
        `🎯 ${firstName} converted from your AutoCDP campaign!`,
        "   Confirm this appointment in your scheduling system.",
        "",
        campaignBlock(payload),
      ];

      if (payload.bookingUrl) {
        parts.push(
          "",
          "🔗 BOOKING LINK",
          `   ${payload.bookingUrl}`,
        );
      }

      parts.push(
        "",
        "📌 ACTION CHECKLIST",
        `   □ Confirm ${firstName}'s appointment in scheduler`,
        "   □ Send confirmation text or email to customer",
        "   □ Assign to service advisor / sales associate",
        "   □ Prepare any relevant vehicle history notes",
        "",
        footer,
      );
      return parts.join("\n");
    }
  }
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

  // 3. Build the rich activity payload
  const firstName    = (customer.first_name as string | null) ?? "Customer";
  const lastName     = (customer.last_name  as string | null) ?? "";
  const customerName = [firstName, lastName].filter(Boolean).join(" ");
  const now          = new Date().toISOString();

  const subject  = buildSubject(payload.eventType, payload, firstName);
  const notes    = buildRichNote(payload.eventType, payload, customerName, firstName, now);
  const actType  = ACTIVITY_TYPES[payload.eventType];

  const actPayload: QueuedWritebackPayload = {
    activityType:  actType,
    subject,
    notes,
    activityDate:  now,
    completedDate: now,
    channel:       payload.channel,
    customerName,
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
        const supabaseSvc = createServiceClient();
        await supabaseSvc
          .from("crm_writeback_queue")
          .update({
            status:     "dead",
            attempts:   5,
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
      message: `Plugin write-back: ${provider} ← ${payload.eventType} · ${subject}`,
      data: {
        provider,
        nativeId,
        customerId:   payload.customerId,
        customerName,
        eventType:    payload.eventType,
        activityType: actType,
        subject,
        channel:      payload.channel ?? null,
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
