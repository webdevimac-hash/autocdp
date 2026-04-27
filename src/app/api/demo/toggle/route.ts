import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { logAudit } from "@/lib/audit";
import { getActiveDealershipId } from "@/lib/dealership";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const store = await cookies();
  const current = store.get("demo_mode")?.value === "1";
  const next = !current;

  store.set("demo_mode", next ? "1" : "0", {
    path: "/",
    httpOnly: false, // readable by client for banner
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day
  });

  // Audit the toggle (best-effort)
  const dealershipId = await getActiveDealershipId(user.id).catch(() => null);
  if (dealershipId) {
    await logAudit({
      dealershipId,
      userId: user.id,
      action: next ? "demo_mode.enabled" : "demo_mode.disabled",
      metadata: {},
    });
  }

  const referer = req.headers.get("referer") ?? "/dashboard";
  return NextResponse.redirect(new URL(referer, req.url));
}
