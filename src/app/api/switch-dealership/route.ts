import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

/**
 * GET /api/switch-dealership?id=<dealership_id>
 *
 * Verifies the user belongs to the requested dealership, sets the
 * active_dealership_id cookie, and redirects to /dashboard.
 */
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get("id");
  const redirectTo = new URL("/dashboard", req.url);

  if (!dealershipId) return NextResponse.redirect(redirectTo);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  // Verify membership — never trust the URL parameter alone
  const { data: membership } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .eq("dealership_id", dealershipId)
    .maybeSingle() as { data: { dealership_id: string } | null };

  if (!membership) return NextResponse.redirect(redirectTo);

  const cookieStore = await cookies();
  cookieStore.set("active_dealership_id", dealershipId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return NextResponse.redirect(redirectTo);
}
