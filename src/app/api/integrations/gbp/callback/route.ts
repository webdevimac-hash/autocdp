/**
 * GET /api/integrations/gbp/callback
 *
 * Handles the Google OAuth redirect for Google Business Profile:
 *  1. Validates state cookie (CSRF)
 *  2. Exchanges auth code → refresh + access tokens
 *  3. Fetches accounts and locations for the picker
 *  4. If single location: saves connection immediately (status=active)
 *     If multiple locations: saves with status=pending, user picks later
 *  5. Redirects to /dashboard/reputation?success=gbp-connected
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { encryptTokens } from "@/lib/dms/encrypt";
import {
  exchangeGbpCode,
  fetchGbpAccounts,
  fetchGbpLocations,
} from "@/lib/reputation/gbp-client";

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
    return NextResponse.redirect(`${APP_URL}/dashboard/reputation?error=gbp-denied`);
  }

  // CSRF check
  const cookieStore = await cookies();
  const savedState = cookieStore.get("gbp_oauth_state")?.value;
  cookieStore.delete("gbp_oauth_state");

  if (!state || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/dashboard/reputation?error=gbp-state-mismatch`);
  }
  if (!code) {
    return NextResponse.redirect(`${APP_URL}/dashboard/reputation?error=gbp-no-code`);
  }

  try {
    const { refreshToken, accessToken } = await exchangeGbpCode(code);

    // Discover accounts + locations
    const accounts  = await fetchGbpAccounts(accessToken);
    const primaryAccount = accounts[0];
    if (!primaryAccount) {
      return NextResponse.redirect(`${APP_URL}/dashboard/reputation?error=gbp-no-account`);
    }

    const locations = await fetchGbpLocations(accessToken, primaryAccount.name);
    const primaryLocation = locations[0];

    const svc = createServiceClient();
    const { data: ud } = await svc
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.redirect(`${APP_URL}/dashboard/reputation?error=gbp-no-dealership`);
    }

    const tokens = {
      refreshToken,
      accountId:    primaryAccount.name,
      locationId:   primaryLocation?.name ?? "",
      locationName: primaryLocation?.locationName ?? primaryAccount.accountName,
    };
    const encrypted = await encryptTokens(tokens);

    await (svc as ReturnType<typeof createServiceClient>)
      .from("dms_connections" as never)
      .upsert(
        {
          dealership_id:    ud.dealership_id,
          provider:         "google_business_profile",
          status:           primaryLocation ? "active" : "pending",
          encrypted_tokens: encrypted,
          metadata: {
            account_name:   primaryAccount.accountName,
            account_id:     primaryAccount.name,
            location_id:    primaryLocation?.name ?? null,
            location_name:  primaryLocation?.locationName ?? null,
            all_locations:  locations.map((l) => ({ id: l.name, name: l.locationName })),
          },
        } as never,
        { onConflict: "dealership_id,provider" }
      );

    const key = primaryLocation ? "gbp-connected" : "gbp-pick-location";
    return NextResponse.redirect(`${APP_URL}/dashboard/reputation?success=${key}`);
  } catch (err) {
    console.error("[gbp/callback]", err);
    return NextResponse.redirect(`${APP_URL}/dashboard/reputation?error=gbp-exchange-failed`);
  }
}
