/**
 * POST   /api/integrations/tiktok-ads/sync  — Pull TikTok performance.
 * DELETE /api/integrations/tiktok-ads/sync  — Disconnect TikTok Ads.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptTokens } from "@/lib/dms/encrypt";
import { fetchTikTokAdPerformance, TikTokAdsTokens } from "@/lib/ads/tiktok-ads";

export const dynamic = "force-dynamic";

async function resolveAuth(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 as const };

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  if (!ud?.dealership_id) return { error: "Dealership not found" as const, status: 404 as const };
  return { dealershipId: ud.dealership_id as string, svc };
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { dealershipId, svc } = auth;
  const { searchParams } = new URL(req.url);

  const { data: conn } = await svc
    .from("dms_connections" as never)
    .select("id, encrypted_tokens" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "tiktok_ads" as never)
    .eq("status" as never, "active" as never)
    .maybeSingle() as unknown as { data: { id: string; encrypted_tokens: string } | null };

  if (!conn) return NextResponse.json({ error: "TikTok Ads not connected" }, { status: 400 });

  const tokens = await decryptTokens<TikTokAdsTokens>(conn.encrypted_tokens);

  const today = new Date().toISOString().slice(0, 10);
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const since = searchParams.get("since") ?? since30;
  const until = searchParams.get("until") ?? today;
  const t0 = Date.now();

  try {
    const rows = await fetchTikTokAdPerformance(tokens, since, until);

    // Upsert into ads_performance (reuse same table — tiktok_ads platform)
    if (rows.length > 0) {
      const records = rows.map((r) => ({
        dealership_id: dealershipId,
        platform:      "tiktok_ads",
        account_id:    tokens.advertiserId,
        campaign_id:   r.campaignId,
        campaign_name: r.campaignName,
        ad_group_id:   r.adGroupId,
        ad_group_name: r.adGroupName,
        ad_id:         r.adId,
        date_start:    r.dateStart,
        date_end:      r.dateEnd,
        impressions:   r.impressions,
        clicks:        r.clicks,
        conversions:   r.conversions,
        spend_usd:     +r.spend.toFixed(4),
        roas:          r.spend > 0 ? null : null,  // TikTok doesn't return revenue directly
        metadata:      { reach: r.reach, videoViews: r.videoViews, videoViewRate: r.videoViewRate, cpm: r.cpm },
        synced_at:     new Date().toISOString(),
      }));

      await svc
        .from("ads_performance" as never)
        .upsert(records as never, {
          onConflict: "dealership_id,platform,campaign_id,ad_id,date_start",
          ignoreDuplicates: false,
        });
    }

    await svc
      .from("dms_connections" as never)
      .update({ last_sync_at: new Date().toISOString(), status: "active" } as never)
      .eq("id" as never, conn.id as never);

    return NextResponse.json({
      ok: true,
      platform: "tiktok_ads",
      rowsUpserted: rows.length,
      since,
      until,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await resolveAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { dealershipId, svc } = auth;
  const { error } = await svc
    .from("dms_connections" as never)
    .delete()
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "tiktok_ads" as never);

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
