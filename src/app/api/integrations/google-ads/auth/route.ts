/**
 * GET /api/integrations/google-ads/auth
 *
 * Redirects the user to Google's OAuth consent screen.
 * Generates a random `state` param stored in a cookie for CSRF protection.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleAdsAuthUrl } from "@/lib/ads/google-ads";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("google_ads_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    maxAge:   600, // 10 minutes
    path:     "/",
  });

  const authUrl = buildGoogleAdsAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
