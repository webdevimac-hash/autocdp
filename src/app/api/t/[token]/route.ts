import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tokenToCommId } from "@/lib/tracking";
import { fireWriteback } from "@/lib/dms/crm-writeback";

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
      .select("clicked_at, dealership_id, customer_id, campaign_goal, content, offer, channel")
      .eq("id", commId)
      .single();

    if (comm && !comm.clicked_at) {
      await svc
        .from("communications")
        .update({ clicked_at: new Date().toISOString() })
        .eq("id", commId);

      // Plugin Mode write-back — fire-and-forget, never blocks the redirect
      if (comm.dealership_id && comm.customer_id) {
        fireWriteback({
          dealershipId:    comm.dealership_id as string,
          customerId:      comm.customer_id as string,
          eventType:       "qr_scanned",
          channel:         (comm.channel ?? "direct_mail") as "direct_mail" | "sms" | "email",
          campaignGoal:    (comm.campaign_goal ?? undefined) as string | undefined,
          copyExcerpt:     comm.content ? String(comm.content).slice(0, 300) : undefined,
          offer:           (comm.offer ?? null) as string | null,
          communicationId: commId,
        });
      }
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
