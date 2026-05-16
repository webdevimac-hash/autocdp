/**
 * POST /api/webhooks/dealertrack?token=<webhook_token>
 *
 * Receives real-time push events from Dealertrack (Cox Automotive DT Connect).
 * The `token` query param routes to the right connection; the X-DT-Signature
 * header (bare hex HMAC-SHA256) authenticates it.
 *
 * Dealertrack event types handled:
 *   lead.created         → upsert customer (prospect)
 *   lead.updated         → update customer fields
 *   lead.status_changed  → update lifecycle_stage
 *   contact.optout       → add tcpa_optout tag
 *
 * Registration path in Dealertrack:
 *   DT Connect Portal → Partner Settings → Event Subscriptions → Register Endpoint
 *   Enter endpoint URL and signing secret; select Lead and Contact events
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/dms/webhook-verify";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Dealertrack webhook payload types
// ---------------------------------------------------------------------------

interface DtLeadPayload {
  leadId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: string;
  optOut?: boolean;
}

interface DtWebhookEvent {
  event: string;               // "lead.created" | "lead.updated" | etc.
  dealerCode?: string;
  timestamp?: string;
  payload?: DtLeadPayload & Record<string, unknown>;
}

const DT_STATUS_TO_LIFECYCLE: Record<string, string> = {
  new:       "prospect",
  open:      "prospect",
  active:    "active",
  working:   "prospect",
  sold:      "sold",
  closed:    "sold",
  lost:      "inactive",
  inactive:  "inactive",
  service:   "service_customer",
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const token   = req.nextUrl.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const svc = createServiceClient();

  const { data: conn } = await svc
    .from("dms_connections")
    .select("id, dealership_id, metadata")
    .eq("provider", "dealertrack")
    .eq("status", "active")
    .contains("metadata", { webhook_token: token })
    .maybeSingle() as unknown as {
      data: { id: string; dealership_id: string; metadata: Record<string, unknown> } | null;
    };

  if (!conn) {
    return NextResponse.json({ error: "Unknown token" }, { status: 404 });
  }

  const meta   = conn.metadata;
  const secret = meta.webhook_secret as string | undefined;

  // DT sends bare hex (no "sha256=" prefix) — verifyWebhookSignature handles both
  const sig = req.headers.get("x-dt-signature") ?? "";
  if (secret && !verifyWebhookSignature(rawBody, secret, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: DtWebhookEvent;
  try {
    event = JSON.parse(rawBody) as DtWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleDtEvent(conn.dealership_id, event, svc);
  } catch (err) {
    console.error("[webhook/dealertrack] Handler error:", err);
  }

  await svc
    .from("dms_connections")
    .update({
      metadata: {
        ...meta,
        last_webhook_at:     new Date().toISOString(),
        webhook_event_count: ((meta.webhook_event_count as number) ?? 0) + 1,
      },
    } as Record<string, unknown>)
    .eq("id", conn.id);

  return NextResponse.json({ ok: true, event: event.event });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleDtEvent(
  dealershipId: string,
  event: DtWebhookEvent,
  svc: ReturnType<typeof createServiceClient>
) {
  const data     = event.payload ?? {};
  const nativeId = data.leadId ?? null;

  switch (event.event) {

    case "lead.created":
    case "lead.updated": {
      if (!nativeId) break;
      const update: Record<string, unknown> = {};
      if (data.firstName) update.first_name = data.firstName;
      if (data.lastName)  update.last_name  = data.lastName;
      if (data.email)     update.email      = data.email;
      if (data.phone)     update.phone      = data.phone;
      if (Object.keys(update).length > 0) {
        await svc
          .from("customers")
          .update(update)
          .eq("dms_external_id", `dealertrack:${nativeId}`)
          .eq("dealership_id", dealershipId);
      }
      await logWebhookEvent(svc, dealershipId, "dealertrack", event.event, nativeId);
      break;
    }

    case "lead.status_changed": {
      if (!nativeId) break;
      const rawStatus = String(data.status ?? "").toLowerCase();
      const lifecycle = DT_STATUS_TO_LIFECYCLE[rawStatus] ?? null;
      if (lifecycle) {
        await svc
          .from("customers")
          .update({ lifecycle_stage: lifecycle })
          .eq("dms_external_id", `dealertrack:${nativeId}`)
          .eq("dealership_id", dealershipId);
      }
      await logWebhookEvent(svc, dealershipId, "dealertrack", event.event, nativeId, rawStatus);
      break;
    }

    case "contact.optout": {
      if (!nativeId) break;
      const { data: cust } = await svc
        .from("customers")
        .select("id, tags")
        .eq("dms_external_id", `dealertrack:${nativeId}`)
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      if (cust) {
        const tags = Array.isArray(cust.tags) ? cust.tags as string[] : [];
        if (!tags.includes("tcpa_optout")) {
          await svc
            .from("customers")
            .update({ tags: [...tags, "tcpa_optout"] })
            .eq("id", cust.id);
        }
      }
      await logWebhookEvent(svc, dealershipId, "dealertrack", event.event, nativeId, "opt-out recorded");
      break;
    }

    default:
      await logWebhookEvent(svc, dealershipId, "dealertrack", event.event, nativeId ?? "—");
  }
}

async function logWebhookEvent(
  svc: ReturnType<typeof createServiceClient>,
  dealershipId: string,
  provider: string,
  eventType: string,
  nativeId: string | null,
  detail?: string
) {
  await svc
    .from("sync_logs")
    .insert({
      job_id:  `webhook-${provider}-${Date.now()}`,
      level:   "info",
      message: `Webhook received: ${provider} → ${eventType}${detail ? ` (${detail})` : ""}`,
      data:    { provider, eventType, nativeId, dealershipId },
    })
    .catch(() => null);
}
