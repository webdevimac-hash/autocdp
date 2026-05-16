/**
 * POST /api/integrations/google-ads/push
 *
 * Called by the swarm to push an AI-generated Responsive Search Ad.
 *
 * Body: {
 *   campaignId:   string;
 *   adGroupId:    string;
 *   finalUrl:     string;
 *   headlines:    Array<{ text: string; pinnedField?: string }>;    // 3–15, ≤30 chars each
 *   descriptions: Array<{ text: string; pinnedField?: string }>;   // 2–4,  ≤90 chars each
 *   path1?:       string;   // ≤15 chars
 *   path2?:       string;
 *   pushType?:    "creative" | "headline_test";  // default "creative"
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptTokens } from "@/lib/dms/encrypt";
import { pushGoogleAdsRsa, GoogleAdsTokens, PushRsaPayload } from "@/lib/ads/google-ads";
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

  const body = await req.json() as Partial<PushRsaPayload> & { pushType?: string };

  if (!body.adGroupId || !body.finalUrl || !body.headlines?.length || !body.descriptions?.length) {
    return NextResponse.json(
      { error: "adGroupId, finalUrl, headlines, and descriptions are required" },
      { status: 400 }
    );
  }

  // Load connection
  const { data: conn } = await svc
    .from("dms_connections" as never)
    .select("id, encrypted_tokens" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "google_ads" as never)
    .eq("status" as never, "active" as never)
    .maybeSingle() as unknown as {
      data: { id: string; encrypted_tokens: string } | null;
    };

  if (!conn) {
    return NextResponse.json({ error: "Google Ads not connected" }, { status: 400 });
  }

  const tokens = await decryptTokens<GoogleAdsTokens>(conn.encrypted_tokens);

  const payload: PushRsaPayload = {
    campaignId:   body.campaignId ?? "",
    adGroupId:    body.adGroupId,
    finalUrl:     body.finalUrl,
    headlines:    body.headlines,
    descriptions: body.descriptions,
    path1:        body.path1,
    path2:        body.path2,
  };

  const pushType = (body.pushType === "headline_test" ? "headline_test" : "creative") as
    "creative" | "headline_test";

  // Log as pending first
  const logId = await logAdsPush({
    dealershipId,
    platform:  "google_ads",
    pushType,
    status:    "pending",
    payload:   payload as unknown as Record<string, unknown>,
  });

  try {
    const result = await pushGoogleAdsRsa(tokens, payload);

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
