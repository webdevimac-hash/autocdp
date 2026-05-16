/**
 * POST /api/webhooks/elead?token=<webhook_token>
 *
 * Receives real-time push events from Elead CRM (CDK Global).
 * The `token` query param routes to the right connection; the
 * X-Elead-Signature header (sha256=<hex>) authenticates it.
 *
 * Elead event types handled:
 *   lead.created         → upsert customer (prospect)
 *   lead.updated         → update customer fields
 *   lead.status_changed  → update lifecycle_stage
 *   contact.dnc          → add tcpa_optout tag
 *
 * Registration path in Elead:
 *   Elead Admin Portal → Integrations → Webhooks → New Webhook
 *   Enter endpoint URL and signing secret; select Lead events
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/dms/webhook-verify";
import {
  webhookUpdateFromElead,
  lifecycleFromEleadStatus,
} from "@/lib/dms/field-mapping";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Elead webhook payload types
// ---------------------------------------------------------------------------

interface EleadLeadData {
  lead_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  dnc?: boolean;
}

interface EleadWebhookEvent {
  event_type: string;           // "lead.created" | "lead.updated" | etc.
  dealer_id?: string;
  occurred_at?: string;
  lead?: EleadLeadData & Record<string, unknown>;
}

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
    .eq("provider", "elead")
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

  const sig = req.headers.get("x-elead-signature") ?? "";
  if (secret && !verifyWebhookSignature(rawBody, secret, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: EleadWebhookEvent;
  try {
    event = JSON.parse(rawBody) as EleadWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleEleadEvent(conn.dealership_id, event, svc);
  } catch (err) {
    console.error("[webhook/elead] Handler error:", err);
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

  return NextResponse.json({ ok: true, eventType: event.event_type });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleEleadEvent(
  dealershipId: string,
  event: EleadWebhookEvent,
  svc: ReturnType<typeof createServiceClient>
) {
  const lead     = event.lead ?? {};
  const nativeId = lead.lead_id ?? null;

  // Handle DNC flag on any lead event
  if (lead.dnc && nativeId) {
    const { data: cust } = await svc
      .from("customers")
      .select("id, tags")
      .eq("dms_external_id", `elead:${nativeId}`)
      .eq("dealership_id", dealershipId)
      .maybeSingle();
    if (cust) {
      const existingTags = Array.isArray(cust.tags) ? cust.tags as string[] : [];
      const dncUpdate = webhookUpdateFromElead({ dnc: true }, existingTags);
      await svc.from("customers").update(dncUpdate).eq("id", cust.id);
    }
  }

  switch (event.event_type) {

    case "lead.created":
    case "lead.updated": {
      if (!nativeId) break;
      const update = webhookUpdateFromElead({
        firstName:  lead.first_name,
        lastName:   lead.last_name,
        email:      lead.email,
        phone:      lead.phone,
        leadStatus: lead.status,
      });
      if (Object.keys(update).length > 0) {
        await svc
          .from("customers")
          .update(update)
          .eq("dms_external_id", `elead:${nativeId}`)
          .eq("dealership_id", dealershipId);
      }
      await logWebhookEvent(svc, dealershipId, "elead", event.event_type, nativeId);
      break;
    }

    case "lead.status_changed": {
      if (!nativeId) break;
      const rawStatus = String(lead.status ?? "").toLowerCase();
      const lifecycle = lifecycleFromEleadStatus(rawStatus);
      await svc
        .from("customers")
        .update({ lifecycle_stage: lifecycle })
        .eq("dms_external_id", `elead:${nativeId}`)
        .eq("dealership_id", dealershipId);
      await logWebhookEvent(svc, dealershipId, "elead", event.event_type, nativeId, rawStatus);
      break;
    }

    case "contact.dnc": {
      // DNC already handled above the switch; just log
      await logWebhookEvent(svc, dealershipId, "elead", event.event_type, nativeId ?? "—", "DNC recorded");
      break;
    }

    default:
      await logWebhookEvent(svc, dealershipId, "elead", event.event_type, nativeId ?? "—");
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
