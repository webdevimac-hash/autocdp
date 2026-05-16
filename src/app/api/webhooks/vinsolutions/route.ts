/**
 * POST /api/webhooks/vinsolutions?token=<webhook_token>
 *
 * Receives real-time push events from VinSolutions.
 * The `token` query param routes the request to the right dealership
 * connection; the X-VinSolutions-Signature header authenticates it.
 *
 * VinSolutions event types handled:
 *   contact.created      → upsert customer
 *   contact.updated      → update customer fields
 *   contact.opted_out    → add tcpa_optout tag
 *   lead.created         → upsert customer (prospect)
 *   lead.updated         → update customer fields
 *   lead.status_changed  → update lifecycle_stage
 *   activity.completed   → log to sync_logs (rep follow-up visibility)
 *
 * Registration path in VinSolutions:
 *   Admin Panel → API Settings → Webhooks → Add Endpoint
 *   Select events: Contacts, Leads, Activities
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/dms/webhook-verify";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// VinSolutions webhook payload types
// ---------------------------------------------------------------------------

interface VinContact {
  contactId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  optedOut?: boolean;
}

interface VinLead {
  leadId?: string;
  contactId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  leadStatus?: string;
}

interface VinActivity {
  activityId?: string;
  contactId?: string;
  activityType?: string;
  subject?: string;
  completedDate?: string;
}

interface VinWebhookEvent {
  eventType: string;
  dealerId?: string;
  timestamp?: string;
  data?: VinContact & VinLead & VinActivity & Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Lifecycle stage mapping from VinSolutions lead status
// ---------------------------------------------------------------------------

const VIN_STATUS_TO_LIFECYCLE: Record<string, string> = {
  new:       "prospect",
  open:      "prospect",
  working:   "prospect",
  active:    "active",
  sold:      "sold",
  closed:    "sold",
  lost:      "inactive",
  dead:      "inactive",
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

  // Look up connection by webhook_token stored in metadata
  const { data: conn } = await svc
    .from("dms_connections")
    .select("id, dealership_id, metadata")
    .eq("provider", "vinsolutions")
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

  // Verify signature
  const sig = req.headers.get("x-vinsolutions-signature") ?? "";
  if (secret && !verifyWebhookSignature(rawBody, secret, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse payload
  let event: VinWebhookEvent;
  try {
    event = JSON.parse(rawBody) as VinWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { eventType, data } = event;

  // Dispatch
  try {
    await handleVinEvent(conn.dealership_id, eventType, data ?? {}, svc);
  } catch (err) {
    console.error("[webhook/vinsolutions] Handler error:", err);
    // Still return 200 so VinSolutions doesn't retry indefinitely
  }

  // Update webhook stats in metadata
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

  return NextResponse.json({ ok: true, eventType });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleVinEvent(
  dealershipId: string,
  eventType: string,
  data: VinContact & VinLead & VinActivity & Record<string, unknown>,
  svc: ReturnType<typeof createServiceClient>
) {
  const nativeId = data.contactId ?? data.leadId ?? null;

  switch (eventType) {

    case "contact.created":
    case "contact.updated":
    case "lead.created":
    case "lead.updated": {
      if (!nativeId) break;
      const dmsExtId = `vinsolutions:${nativeId}`;
      const update: Record<string, unknown> = {};
      if (data.firstName) update.first_name = data.firstName;
      if (data.lastName)  update.last_name  = data.lastName;
      if (data.email)     update.email      = data.email;
      if (data.phone)     update.phone      = data.phone;
      if (Object.keys(update).length > 0) {
        await svc
          .from("customers")
          .update(update)
          .eq("dms_external_id", dmsExtId)
          .eq("dealership_id", dealershipId);
      }
      await logWebhookEvent(svc, dealershipId, "vinsolutions", eventType, nativeId);
      break;
    }

    case "contact.opted_out": {
      if (!nativeId) break;
      const dmsExtId = `vinsolutions:${nativeId}`;
      // Fetch existing tags and append tcpa_optout if missing
      const { data: cust } = await svc
        .from("customers")
        .select("id, tags")
        .eq("dms_external_id", dmsExtId)
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
      await logWebhookEvent(svc, dealershipId, "vinsolutions", eventType, nativeId, "opt-out recorded");
      break;
    }

    case "lead.status_changed": {
      if (!nativeId) break;
      const rawStatus  = String(data.leadStatus ?? data.status ?? "").toLowerCase();
      const lifecycle  = VIN_STATUS_TO_LIFECYCLE[rawStatus] ?? null;
      if (lifecycle) {
        await svc
          .from("customers")
          .update({ lifecycle_stage: lifecycle })
          .eq("dms_external_id", `vinsolutions:${nativeId}`)
          .eq("dealership_id", dealershipId);
      }
      await logWebhookEvent(svc, dealershipId, "vinsolutions", eventType, nativeId, rawStatus);
      break;
    }

    case "activity.completed": {
      // Log rep activities so the team can see CRM follow-ups in sync_logs
      await logWebhookEvent(
        svc, dealershipId, "vinsolutions", eventType,
        data.activityId ?? nativeId ?? "unknown",
        data.subject ?? data.activityType ?? "Activity completed"
      );
      break;
    }

    default:
      // Unknown event — log and move on
      await logWebhookEvent(svc, dealershipId, "vinsolutions", eventType, "—");
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
