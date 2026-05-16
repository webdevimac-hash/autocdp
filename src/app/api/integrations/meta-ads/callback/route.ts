/**
 * GET /api/integrations/meta-ads/callback
 *
 * Handles OAuth redirect from Facebook:
 *  1. Validates state cookie (CSRF)
 *  2. Exchanges code → short-lived token, then extends to 60-day token
 *  3. Saves connection (status=pending until adAccountId is provided)
 *  4. Redirects to /dashboard/integrations?success=meta-ads-authed
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { encryptTokens } from "@/lib/dms/encrypt";
import { exchangeMetaCode, extendMetaToken } from "@/lib/ads/meta-ads";

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
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=meta-ads-denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("meta_ads_oauth_state")?.value;
  cookieStore.delete("meta_ads_oauth_state");

  if (!state || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=meta-ads-state-mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=meta-ads-no-code`);
  }

  try {
    const { accessToken: shortToken } = await exchangeMetaCode(code);
    const accessToken = await extendMetaToken(shortToken);

    const svc = createServiceClient();
    const { data: ud } = await svc
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=meta-ads-no-dealership`);
    }

    // adAccountId is not known yet — dealer needs to enter it in the UI
    const encrypted = await encryptTokens({ accessToken, adAccountId: "" });

    await svc
      .from("dms_connections" as never)
      .upsert(
        {
          dealership_id:    ud.dealership_id,
          provider:         "meta_ads",
          status:           "pending", // pending until adAccountId supplied
          encrypted_tokens: encrypted,
          metadata: { token_type: "long_lived" },
        } as never,
        { onConflict: "dealership_id,provider" }
      );

    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?success=meta-ads-authed`);
  } catch (err) {
    console.error("[meta-ads/callback]", err);
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=meta-ads-exchange-failed`);
  }
}
