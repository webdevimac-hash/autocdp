import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tokenToCommId } from "@/lib/tracking";

const FALLBACK_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://autocdp.com";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const dest = req.nextUrl.searchParams.get("u");

  const commId = tokenToCommId(token);
  if (!commId) return NextResponse.redirect(dest ?? FALLBACK_URL);

  try {
    const svc = createServiceClient();

    // Only set clicked_at on the first click
    const { data: comm } = await svc
      .from("communications")
      .select("clicked_at, dealership_id")
      .eq("id", commId)
      .single();

    if (comm && !comm.clicked_at) {
      await svc
        .from("communications")
        .update({ clicked_at: new Date().toISOString() })
        .eq("id", commId);
    }

    // Resolve redirect target: explicit ?u= param, else dealership website
    let redirectTo = dest;
    if (!redirectTo && comm?.dealership_id) {
      const { data: dealer } = await svc
        .from("dealerships")
        .select("website_url")
        .eq("id", comm.dealership_id)
        .single();
      redirectTo = (dealer as { website_url?: string | null } | null)?.website_url ?? FALLBACK_URL;
    }

    return NextResponse.redirect(redirectTo ?? FALLBACK_URL, { status: 302 });
  } catch {
    return NextResponse.redirect(dest ?? FALLBACK_URL, { status: 302 });
  }
}
