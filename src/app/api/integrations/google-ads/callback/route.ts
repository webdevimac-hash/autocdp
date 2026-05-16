/**
 * GET /api/integrations/google-ads/callback
 *
 * Handles the OAuth redirect from Google:
 *  1. Validates state cookie (CSRF)
 *  2. Exchanges auth code → refresh token
 *  3. Fetches accessible customer list for account picker
 *  4. Saves connection to dms_connections (status=pending until customerId chosen)
 *  5. Redirects to /dashboard/integrations?success=google-ads-authed
 *     (or ?success=google-ads-connected if only one account)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { encryptTokens } from "@/lib/dms/encrypt";
import {
  exchangeGoogleAdsCode,
  fetchGoogleAdsAccessibleCustomers,
} from "@/lib/ads/google-ads";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  const { searchParams } = new URL(req.url);
  const code     = searchParams.get("code");
  const state    = searchParams.get("state");
  const errParam = searchParams.get("error");

  if (errParam) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?error=google-ads-denied`
    );
  }

  // CSRF check
  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_ads_oauth_state")?.value;
  cookieStore.delete("google_ads_oauth_state");

  if (!state || state !== savedState) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?error=google-ads-state-mismatch`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?error=google-ads-no-code`
    );
  }

  try {
    const { refreshToken } = await exchangeGoogleAdsCode(code);

    // Fetch accessible customers to pick the right one
    const customerIds = await fetchGoogleAdsAccessibleCustomers(refreshToken);
    const primaryCustomerId = customerIds[0] ?? "";

    const svc = createServiceClient();
    const { data: ud } = await svc
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.redirect(
        `${APP_URL}/dashboard/integrations?error=google-ads-no-dealership`
      );
    }

    const tokens = {
      refreshToken,
      customerId:   primaryCustomerId,
    };
    const encrypted = await encryptTokens(tokens);

    await svc
      .from("dms_connections" as never)
      .upsert(
        {
          dealership_id:    ud.dealership_id,
          provider:         "google_ads",
          status:           primaryCustomerId ? "active" : "pending",
          encrypted_tokens: encrypted,
          metadata: {
            accessible_customers: customerIds,
            customer_id:          primaryCustomerId,
          },
        } as never,
        { onConflict: "dealership_id,provider" }
      );

    const successKey = primaryCustomerId ? "google-ads-connected" : "google-ads-authed";
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?success=${successKey}`
    );
  } catch (err) {
    console.error("[google-ads/callback]", err);
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?error=google-ads-exchange-failed`
    );
  }
}
