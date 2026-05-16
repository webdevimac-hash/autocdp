/**
 * GET /api/integrations/gbp/auth
 *
 * Redirects the user to Google's OAuth consent screen for
 * the Google Business Profile (business.manage) scope.
 * Generates a random `state` param stored in a cookie for CSRF protection.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGbpAuthUrl } from "@/lib/reputation/gbp-client";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("gbp_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    maxAge:   600,
    path:     "/",
  });

  return NextResponse.redirect(buildGbpAuthUrl(state));
}
