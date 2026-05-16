/**
 * POST /api/conquest/retargeting/event
 *
 * Public endpoint — no authentication required (pixel fires from dealer websites).
 * Validates and inserts a retargeting_event row.
 *
 * Rate-limiting: not applied here; rely on Vercel Edge rate-limit or upstream WAF.
 * Deduplication: not applied per-event; audience queries window by time.
 *
 * CORS: allow all origins (pixel fires cross-origin from dealer websites).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validatePixelEvent, extractIp, hashIp } from "@/lib/conquest/pixel";

export const dynamic    = "force-dynamic";
export const maxDuration = 10;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const validation = validatePixelEvent(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422, headers: CORS_HEADERS });
  }

  const evt = validation.event;
  const svc = createServiceClient();

  // Hash raw IP for storage (privacy — never store raw IP)
  const rawIp = extractIp(req.headers);
  const ipHash = rawIp ? hashIp(rawIp) : null;

  // Async: try to match session → existing CRM customer or conquest lead
  // (best-effort; don't block response on this)
  let customerId:       string | null = null;
  let conquestLeadId:   string | null = null;

  // Check if this session has been seen before and linked
  const { data: prevEvent } = await (svc as ReturnType<typeof createServiceClient>)
    .from("retargeting_events" as never)
    .select("customer_id,conquest_lead_id" as never)
    .eq("dealership_id" as never, evt.dealership_id as never)
    .eq("session_id" as never, evt.session_id as never)
    .not("customer_id" as never, "is" as never, null as never)
    .limit(1)
    .maybeSingle() as unknown as {
      data: { customer_id: string | null; conquest_lead_id: string | null } | null;
    };

  if (prevEvent?.customer_id)     customerId     = prevEvent.customer_id;
  if (prevEvent?.conquest_lead_id) conquestLeadId = prevEvent.conquest_lead_id;

  // Insert the event
  const { error } = await (svc as ReturnType<typeof createServiceClient>)
    .from("retargeting_events" as never)
    .insert({
      dealership_id:    evt.dealership_id,
      session_id:       evt.session_id,
      event_type:       evt.event_type,
      page_url:         evt.page_url  ?? null,
      referrer_url:     evt.referrer_url ?? null,
      user_agent:       evt.user_agent  ?? null,
      ip_hash:          ipHash,
      country_code:     evt.country_code ?? null,
      vin:              evt.vin           ?? null,
      vehicle_make:     evt.vehicle_make  ?? null,
      vehicle_model:    evt.vehicle_model ?? null,
      vehicle_year:     evt.vehicle_year  ?? null,
      vehicle_price:    evt.vehicle_price ?? null,
      customer_id:      customerId,
      conquest_lead_id: conquestLeadId,
    } as never);

  if (error) {
    console.error("[retargeting-event] insert error:", error);
    // Still return 200 to pixel — don't break dealer page on DB errors
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
}
