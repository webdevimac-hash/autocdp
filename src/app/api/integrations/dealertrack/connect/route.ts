/**
 * POST /api/integrations/dealertrack/connect
 *
 * Body: { clientId: string; clientSecret: string }
 *
 * On first connect: validates OAuth credentials, generates webhook token + secret,
 * saves connection with merged metadata.
 * On reconnect: preserves existing plugin_mode, webhook credentials, and event stats.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encryptTokens } from "@/lib/dms/encrypt";
import { runSync } from "@/lib/dms/sync-engine";
import { getDealertrackToken, fetchDealertrackLeads } from "@/lib/dms/dealertrack";
import { generateWebhookToken, generateWebhookSecret } from "@/lib/dms/webhook-verify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { clientId?: string; clientSecret?: string };
  const clientId     = body.clientId?.trim();
  const clientSecret = body.clientSecret?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "clientId and clientSecret are required" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  if (!ud?.dealership_id) {
    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
  }

  // Validate credentials
  try {
    const token = await getDealertrackToken(clientId, clientSecret);
    await fetchDealertrackLeads(token, undefined, undefined);
  } catch {
    return NextResponse.json(
      { error: "Invalid Dealertrack credentials — OAuth token or API request failed" },
      { status: 400 }
    );
  }

  // Fetch existing metadata to preserve plugin_mode + webhook settings
  const { data: existing } = await svc
    .from("dms_connections")
    .select("metadata")
    .eq("dealership_id", ud.dealership_id)
    .eq("provider", "dealertrack")
    .maybeSingle() as { data: { metadata: Record<string, unknown> } | null };

  const existingMeta = (existing?.metadata ?? {}) as Record<string, unknown>;

  const metadata: Record<string, unknown> = {
    ...existingMeta,
    webhook_token:       (existingMeta.webhook_token  as string) || generateWebhookToken(),
    webhook_secret:      (existingMeta.webhook_secret as string) || generateWebhookSecret(),
    webhook_event_count: (existingMeta.webhook_event_count as number) ?? 0,
  };

  const encrypted = await encryptTokens({ clientId, clientSecret });

  const { data: conn, error: upsertErr } = await svc
    .from("dms_connections")
    .upsert(
      {
        dealership_id:    ud.dealership_id,
        provider:         "dealertrack",
        status:           "active",
        encrypted_tokens: encrypted,
        metadata,
      },
      { onConflict: "dealership_id,provider" }
    )
    .select("id")
    .single() as unknown as { data: { id: string } | null; error: { message: string } | null };

  if (upsertErr || !conn) {
    return NextResponse.json({ error: "Failed to save connection" }, { status: 500 });
  }

  void runSync({
    dealershipId: ud.dealership_id,
    connectionId: conn.id,
    provider:     "dealertrack",
    jobType:      "full",
  }).catch((e) => console.error("[dealertrack/connect] Initial sync failed:", e));

  return NextResponse.json({
    ok:           true,
    connectionId: conn.id,
    webhookToken: metadata.webhook_token,
  });
}
