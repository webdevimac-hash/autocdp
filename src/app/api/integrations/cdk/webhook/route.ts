/**
 * POST /api/integrations/cdk/webhook
 *
 * Receives CDK Fortellis change-notification webhooks.
 * CDK sends a signed payload when records change; we trigger a delta sync.
 *
 * Signature: X-Fortellis-Signature header (SHA-256 HMAC of raw body)
 * Secret: CDK_FORTELLIS_WEBHOOK_SECRET env var
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runSync } from "@/lib/dms/sync-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify signature if secret is configured
  const secret = process.env.CDK_FORTELLIS_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get("x-fortellis-signature");
    if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 401 });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Buffer.from(sig, "hex");
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(rawBody));
    if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    subscriptionId?: string;
    entityType?: string;
    changeType?: string;
  };

  if (!event.subscriptionId) {
    return NextResponse.json({ ok: true, note: "No subscriptionId" });
  }

  const supabase = createServiceClient();

  // Find connection by subscriptionId stored in metadata
  const { data: conn } = await supabase
    .from("dms_connections")
    .select("id, dealership_id, last_sync_at")
    .eq("provider", "cdk_fortellis")
    .eq("status", "active")
    .filter("metadata->subscription_id", "eq", `"${event.subscriptionId}"`)
    .maybeSingle();

  if (!conn) return NextResponse.json({ ok: true, note: "Connection not found" });

  // Fire delta sync in background
  void runSync({
    dealershipId: conn.dealership_id as string,
    connectionId: conn.id as string,
    provider: "cdk_fortellis",
    jobType: "delta",
    since: (conn.last_sync_at as string | null) ?? undefined,
  }).catch((e) => console.error("[cdk/webhook] Delta sync failed:", e));

  return NextResponse.json({ ok: true, syncing: true });
}
