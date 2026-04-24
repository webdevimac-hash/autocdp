/**
 * POST /api/leads/opt-out
 *
 * TCPA opt-out webhook for DealerFunnel and Twilio SMS replies ("STOP").
 *
 * Two callers:
 *   1. DealerFunnel — POSTs opt-out events when a lead responds with STOP/UNSUBSCRIBE
 *   2. Twilio MessagingService — posts inbound "STOP" messages (configure in Twilio console)
 *
 * On opt-out:
 *   - Finds customer by phone or email in the dealership's customers table
 *   - Adds "tcpa_optout" to tags (idempotent)
 *   - Sets metadata.tcpa_optout = true
 *   - Updates conquest_lead status = "disqualified" if present
 *
 * Auth: same per-dealership secret as /api/leads/inbound.
 * Twilio webhooks are additionally verified via x-twilio-signature (if TWILIO_AUTH_TOKEN is set).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyExternalOptOut } from "@/lib/compliance/disclaimers";
import crypto from "crypto";

const GLOBAL_SECRET = process.env.INBOUND_LEAD_SECRET ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";

function verifyTwilioSignature(req: NextRequest, body: string): boolean {
  if (!TWILIO_AUTH_TOKEN) return true; // not configured — skip
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;
  const url = req.url;
  // Twilio signature: HMAC-SHA1 of (url + sorted POST params)
  const params = new URLSearchParams(body);
  const sorted = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const str = url + sorted.map(([k, v]) => k + v).join("");
  const expected = crypto.createHmac("sha1", TWILIO_AUTH_TOKEN).update(str).digest("base64");
  return expected === signature;
}

async function applyOptOut(
  svc: ReturnType<typeof createServiceClient>,
  dealershipId: string,
  identifiers: { phone?: string | null; email?: string | null }
) {
  const { phone, email } = identifiers;

  type CustomerRow = { id: string; tags: string[]; metadata: Record<string, unknown> } | null;

  let customer: CustomerRow = null;

  if (phone) {
    const { data } = await svc
      .from("customers")
      .select("id, tags, metadata")
      .eq("dealership_id", dealershipId)
      .eq("phone", phone)
      .maybeSingle() as unknown as { data: CustomerRow };
    customer = data;
  }

  if (!customer && email) {
    const { data } = await svc
      .from("customers")
      .select("id, tags, metadata")
      .eq("dealership_id", dealershipId)
      .eq("email", email)
      .maybeSingle() as unknown as { data: CustomerRow };
    customer = data;
  }

  if (!customer) return { updated: false, customer_id: null };

  const tags = Array.from(new Set([...(customer.tags ?? []), "tcpa_optout"]));
  await svc.from("customers").update({
    tags,
    metadata: { ...(customer.metadata ?? {}), tcpa_optout: true, tcpa_optout_at: new Date().toISOString() },
  } as never).eq("id", customer.id);

  // Also disqualify the matching conquest_lead
  if (phone) {
    await svc.from("conquest_leads")
      .update({ status: "disqualified" } as never)
      .eq("dealership_id", dealershipId)
      .eq("phone", phone);
  } else if (email) {
    await svc.from("conquest_leads")
      .update({ status: "disqualified" } as never)
      .eq("dealership_id", dealershipId)
      .eq("email", email);
  }

  return { updated: true, customer_id: customer.id, customer };
}

// ── DealerFunnel opt-out POST ─────────────────────────────────

export async function POST(req: NextRequest) {
  const dealershipSlug = req.nextUrl.searchParams.get("dealership");
  const contentType = req.headers.get("content-type") ?? "";
  const isTwilio = req.headers.has("x-twilio-signature");

  const rawBody = await req.text();

  // Twilio path: form-encoded STOP message
  if (isTwilio) {
    if (!verifyTwilioSignature(req, rawBody)) {
      return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 401 });
    }
    const params = new URLSearchParams(rawBody);
    const body = params.get("Body")?.trim().toUpperCase() ?? "";
    const from = params.get("From") ?? "";
    const toNumber = params.get("To") ?? "";

    // Only act on opt-out keywords
    if (!["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(body)) {
      return new NextResponse("<?xml version='1.0'?><Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    // Find dealership by Twilio number in settings
    const svc = createServiceClient();
    type DRow = { id: string } | null;
    const { data: dealerships } = await svc
      .from("dealerships")
      .select("id, settings") as unknown as { data: Array<{ id: string; settings: Record<string, unknown> }> | null };

    for (const d of dealerships ?? []) {
      if (d.settings?.twilio_number === toNumber) {
        await applyOptOut(svc, d.id, { phone: from });
        break;
      }
    }

    return new NextResponse("<?xml version='1.0'?><Response/>", { headers: { "Content-Type": "text/xml" } });
  }

  // DealerFunnel path: JSON opt-out event
  if (!dealershipSlug) {
    return NextResponse.json({ error: "Missing ?dealership= query param" }, { status: 400 });
  }

  const svc = createServiceClient();

  type DealershipRow = { id: string; settings: Record<string, unknown> } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("id, settings")
    .eq("slug", dealershipSlug)
    .single() as unknown as { data: DealershipRow };

  if (!dealership) {
    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
  }

  // Auth
  const dealerSecret = dealership.settings?.inbound_lead_secret as string | undefined;
  const expectedSecret = dealerSecret || GLOBAL_SECRET;
  if (expectedSecret) {
    const provided =
      req.headers.get("x-lead-secret") ??
      req.headers.get("authorization")?.replace("Bearer ", "") ??
      req.nextUrl.searchParams.get("secret") ?? "";
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let data: Record<string, unknown> = {};
  try {
    data = contentType.includes("json") ? JSON.parse(rawBody) : Object.fromEntries(new URLSearchParams(rawBody));
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const phone = (data.phone ?? data.mobile ?? data.cell ?? null) as string | null;
  const email = (data.email ?? null) as string | null;

  if (!phone && !email) {
    return NextResponse.json({ error: "phone or email is required" }, { status: 400 });
  }

  const result = await applyOptOut(svc, dealership.id, { phone, email });

  // Bidirectional sync: notify DealerFunnel if they have an opt-out webhook configured
  const dfOptOutWebhook = dealership.settings?.dealerfunnel_optout_webhook as string | undefined;
  const dfSecret = dealership.settings?.inbound_lead_secret as string | undefined;
  if (dfOptOutWebhook && result.updated) {
    void notifyExternalOptOut(dfOptOutWebhook, { phone, email }, dfSecret);
  }

  return NextResponse.json({ success: true, updated: result.updated, customer_id: result.customer_id });
}
