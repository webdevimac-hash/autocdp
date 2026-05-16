/**
 * /api/reputation/reviews/[reviewId]/reply
 *
 * POST — AI-generate a reply (or accept provided text) and post it to GBP.
 *        Body: { generate?: true } | { text: string }
 *
 * DELETE — Remove the reply from GBP and mark it deleted in DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { decryptTokens } from "@/lib/dms/encrypt";
import { postGbpReply, deleteGbpReply, type GbpTokens } from "@/lib/reputation/gbp-client";
import { generateReviewReply, type ReputationContext } from "@/lib/reputation/reply-generator";

export const dynamic    = "force-dynamic";
export const maxDuration = 60;

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const svc = createServiceClient();

    // Load the review
    const { data: review } = await (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_reviews" as never)
      .select("*" as never)
      .eq("id" as never, reviewId as never)
      .eq("dealership_id" as never, dealershipId as never)
      .single() as unknown as {
        data: {
          id: string;
          gbp_review_id: string;
          reviewer_name: string | null;
          rating: string;
          comment: string | null;
        } | null;
      };

    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

    // Load GBP connection
    const { data: conn } = await (svc as ReturnType<typeof createServiceClient>)
      .from("dms_connections" as never)
      .select("encrypted_tokens,metadata" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("provider" as never, "google_business_profile" as never)
      .eq("status" as never, "active" as never)
      .single() as unknown as {
        data: { encrypted_tokens: string; metadata: Record<string, unknown> } | null;
      };

    if (!conn) return NextResponse.json({ error: "GBP not connected" }, { status: 400 });

    // Load dealership for context
    const { data: dealer } = await (svc as ReturnType<typeof createServiceClient>)
      .from("dealerships" as never)
      .select("name,address,settings" as never)
      .eq("id" as never, dealershipId as never)
      .single() as unknown as {
        data: { name: string; address: { city?: string; state?: string } | null; settings: Record<string, unknown> | null } | null;
      };

    const body = await req.json() as { generate?: boolean; text?: string; draftOnly?: boolean };
    const tokens = await decryptTokens<GbpTokens>(conn.encrypted_tokens);

    // Build context
    const ctx: ReputationContext = {
      dealershipName:  dealer?.name ?? "Our Dealership",
      dealershipCity:  dealer?.address?.city,
      dealershipState: dealer?.address?.state,
      gmName:          (dealer?.settings as Record<string, string> | null)?.gmName,
      makes:           (dealer?.settings as Record<string, string[]> | null)?.makes,
    };

    // Determine reply text
    let replyText: string;
    let isAi = false;

    if (body.generate || (!body.text)) {
      // AI-generate the reply
      replyText = await generateReviewReply(
        {
          reviewId:    review.gbp_review_id,
          name:        review.gbp_review_id,
          reviewer:    { displayName: review.reviewer_name ?? "Anonymous" },
          starRating:  review.rating as "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE",
          comment:     review.comment ?? undefined,
          createTime:  new Date().toISOString(),
          updateTime:  new Date().toISOString(),
        },
        ctx
      );
      isAi = true;
    } else {
      replyText = body.text.trim();
    }

    if (!replyText) return NextResponse.json({ error: "Reply text is empty" }, { status: 400 });

    // If draft-only: save to DB but don't post to GBP yet
    if (body.draftOnly) {
      await (svc as ReturnType<typeof createServiceClient>)
        .from("gbp_reviews" as never)
        .update({
          reply_comment: replyText,
          reply_is_ai:   isAi,
          reply_status:  "draft",
        } as never)
        .eq("id" as never, reviewId as never);

      return NextResponse.json({ reply: replyText, status: "draft", isAi });
    }

    // Post to GBP
    await postGbpReply(tokens, review.gbp_review_id, replyText);

    // Update DB
    await (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_reviews" as never)
      .update({
        reply_comment:      replyText,
        reply_update_time:  new Date().toISOString(),
        reply_is_ai:        isAi,
        reply_status:       "posted",
      } as never)
      .eq("id" as never, reviewId as never);

    return NextResponse.json({ reply: replyText, status: "posted", isAi });
  } catch (err) {
    console.error("[POST /api/reputation/reviews/[reviewId]/reply]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const svc = createServiceClient();

    const { data: review } = await (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_reviews" as never)
      .select("gbp_review_id" as never)
      .eq("id" as never, reviewId as never)
      .eq("dealership_id" as never, dealershipId as never)
      .single() as unknown as { data: { gbp_review_id: string } | null };

    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

    const { data: conn } = await (svc as ReturnType<typeof createServiceClient>)
      .from("dms_connections" as never)
      .select("encrypted_tokens" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("provider" as never, "google_business_profile" as never)
      .eq("status" as never, "active" as never)
      .single() as unknown as { data: { encrypted_tokens: string } | null };

    if (conn) {
      const tokens = await decryptTokens<GbpTokens>(conn.encrypted_tokens);
      await deleteGbpReply(tokens, review.gbp_review_id);
    }

    await (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_reviews" as never)
      .update({
        reply_comment: null,
        reply_status:  "deleted",
      } as never)
      .eq("id" as never, reviewId as never);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/reputation/reviews/[reviewId]/reply]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
