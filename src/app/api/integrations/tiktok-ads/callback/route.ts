/**
 * GET /api/integrations/tiktok-ads/callback
 * Handles TikTok OAuth redirect → saves connection (pending until advertiserId set).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { encryptTokens } from "@/lib/dms/encrypt";
import { exchangeTikTokCode, fetchTikTokAdvertisers } from "@/lib/ads/tiktok-ads";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  const { searchParams } = new URL(req.url);
  const code     = searchParams.get("code");
  const state    = searchParams.get("state");
  const errParam = searchParams.get("error");

  if (errParam) {
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=tiktok-ads-denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("tiktok_ads_oauth_state")?.value;
  cookieStore.delete("tiktok_ads_oauth_state");

  if (!state || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=tiktok-ads-state-mismatch`);
  }
  if (!code) {
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=tiktok-ads-no-code`);
  }

  try {
    const tokens = await exchangeTikTokCode(code);

    // Try to get advertiser list
    const advertisers = await fetchTikTokAdvertisers(tokens.accessToken);
    const primaryId   = advertisers[0]?.id ?? "";

    const svc = createServiceClient();
    const { data: ud } = await svc
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=tiktok-ads-no-dealership`);
    }

    const encrypted = await encryptTokens({
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken ?? "",
      advertiserId: primaryId,
    } as unknown as Record<string, unknown>);

    await svc
      .from("dms_connections" as never)
      .upsert(
        {
          dealership_id:    ud.dealership_id,
          provider:         "tiktok_ads",
          status:           primaryId ? "active" : "pending",
          encrypted_tokens: encrypted,
          metadata: {
            advertisers,
            advertiser_id: primaryId,
          },
        } as never,
        { onConflict: "dealership_id,provider" }
      );

    const successKey = primaryId ? "tiktok-ads-connected" : "tiktok-ads-authed";
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?success=${successKey}`);
  } catch (err) {
    console.error("[tiktok-ads/callback]", err);
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=tiktok-ads-exchange-failed`);
  }
}
