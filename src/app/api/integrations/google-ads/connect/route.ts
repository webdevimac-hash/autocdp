/**
 * POST /api/integrations/google-ads/connect
 *
 * Manual token entry (for MCC or service accounts that already have tokens).
 *
 * Body: {
 *   refreshToken: string;
 *   customerId:   string;   // 10-digit, no dashes
 *   loginCustomerId?: string;
 * }
 *
 * DELETE /api/integrations/google-ads/connect — Disconnect.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encryptTokens } from "@/lib/dms/encrypt";
import { fetchGoogleAdsCampaignPerformance, GoogleAdsTokens } from "@/lib/ads/google-ads";
import { syncGoogleAds } from "@/lib/ads/ads-sync";

export const dynamic = "force-dynamic";

async function resolveUser(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  return ud?.dealership_id ? { user, dealershipId: ud.dealership_id, svc } : null;
}

export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    refreshToken?: string;
    customerId?: string;
    loginCustomerId?: string;
  };

  const refreshToken     = body.refreshToken?.trim();
  const customerId       = body.customerId?.replace(/-/g, "").trim();
  const loginCustomerId  = body.loginCustomerId?.replace(/-/g, "").trim();

  if (!refreshToken || !customerId) {
    return NextResponse.json(
      { error: "refreshToken and customerId are required" },
      { status: 400 }
    );
  }

  // Validate by doing a short performance pull
  const tokens: GoogleAdsTokens = { refreshToken, customerId, loginCustomerId };
  const testSince = new Date();
  testSince.setDate(testSince.getDate() - 3);
  const since = testSince.toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);

  try {
    await fetchGoogleAdsCampaignPerformance(tokens, since, until);
  } catch (err) {
    return NextResponse.json(
      { error: `Google Ads validation failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 400 }
    );
  }

  const encrypted = await encryptTokens(tokens as unknown as Record<string, unknown>);
  const { svc, dealershipId } = auth;

  const { data: conn, error: upsertErr } = await svc
    .from("dms_connections" as never)
    .upsert(
      {
        dealership_id:    dealershipId,
        provider:         "google_ads",
        status:           "active",
        encrypted_tokens: encrypted,
        metadata: {
          customer_id:      customerId,
          login_customer_id: loginCustomerId ?? null,
        },
      } as never,
      { onConflict: "dealership_id,provider" }
    )
    .select("id" as never)
    .single() as unknown as { data: { id: string } | null; error: { message: string } | null };

  if (upsertErr || !conn) {
    return NextResponse.json({ error: "Failed to save connection" }, { status: 500 });
  }

  // Kick off initial sync (non-blocking)
  void syncGoogleAds(dealershipId, conn.id).catch((e) =>
    console.error("[google-ads/connect] Initial sync failed:", e)
  );

  return NextResponse.json({ ok: true, connectionId: conn.id });
}

export async function DELETE(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await auth.svc
    .from("dms_connections" as never)
    .delete()
    .eq("dealership_id" as never, auth.dealershipId as never)
    .eq("provider" as never, "google_ads" as never);

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
