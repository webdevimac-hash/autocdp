/**
 * GET /api/integrations/meta-ads/auth
 *
 * Redirects the user to Facebook's OAuth consent screen.
 * Stores a CSRF state token in a cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildMetaAuthUrl } from "@/lib/ads/meta-ads";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("meta_ads_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    maxAge:   600,
    path:     "/",
  });

  const authUrl = buildMetaAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
