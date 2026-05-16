/**
 * POST /api/integrations/meta-ads/push
 *
 * Called by the swarm to push a single-image Meta Ad.
 *
 * Body: {
 *   adSetId:      string;
 *   pageId:       string;
 *   headline:     string;      // ≤40 chars
 *   primaryText:  string;      // ≤125 chars
 *   description?: string;      // ≤30 chars
 *   callToAction: "LEARN_MORE" | "SHOP_NOW" | "CONTACT_US" | "GET_QUOTE" | "BOOK_TRAVEL";
 *   imageUrl:     string;
 *   finalUrl:     string;
 *   pushType?:    "creative" | "headline_test";   // default "creative"
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptTokens } from "@/lib/dms/encrypt";
import { MetaAdsTokens, PushMetaAdPayload, pushMetaAd } from "@/lib/ads/meta-ads";
import { logAdsPush, updateAdsPushLog } from "@/lib/ads/ads-sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  if (!ud?.dealership_id) {
    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
  }

  const dealershipId = ud.dealership_id;

  const body = await req.json() as Partial<PushMetaAdPayload> & { pushType?: string };

  if (!body.adSetId || !body.pageId || !body.headline || !body.primaryText || !body.imageUrl || !body.finalUrl) {
    return NextResponse.json(
      { error: "adSetId, pageId, headline, primaryText, imageUrl, and finalUrl are required" },
      { status: 400 }
    );
  }

  const { data: conn } = await svc
    .from("dms_connections" as never)
    .select("id, encrypted_tokens" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "meta_ads" as never)
    .eq("status" as never, "active" as never)
    .maybeSingle() as unknown as {
      data: { id: string; encrypted_tokens: string } | null;
    };

  if (!conn) {
    return NextResponse.json({ error: "Meta Ads not connected" }, { status: 400 });
  }

  const tokens = await decryptTokens<MetaAdsTokens>(conn.encrypted_tokens);

  const payload: PushMetaAdPayload = {
    adSetId:      body.adSetId,
    pageId:       body.pageId,
    headline:     body.headline.slice(0, 40),
    primaryText:  body.primaryText.slice(0, 125),
    description:  body.description?.slice(0, 30),
    callToAction: body.callToAction ?? "LEARN_MORE",
    imageUrl:     body.imageUrl,
    finalUrl:     body.finalUrl,
  };

  const pushType = (body.pushType === "headline_test" ? "headline_test" : "creative") as
    "creative" | "headline_test";

  const logId = await logAdsPush({
    dealershipId,
    platform:  "meta_ads",
    pushType,
    status:    "pending",
    payload:   payload as unknown as Record<string, unknown>,
  });

  try {
    const result = await pushMetaAd(tokens, payload);

    if (logId) {
      await updateAdsPushLog(logId, "succeeded", result.adId, result as unknown as Record<string, unknown>);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Push failed";
    if (logId) await updateAdsPushLog(logId, "failed", undefined, undefined, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
