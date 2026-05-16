/**
 * POST /api/cron/gbp-sync
 *
 * Daily cron — syncs Google Business Profile data for ALL dealerships
 * with an active GBP connection:
 *   1. Pull reviews → upsert to gbp_reviews
 *   2. Pull Q&A     → upsert to gbp_qanda
 *   3. Auto-post AI replies to unanswered reviews ≤3 stars if auto_respond is enabled
 *      (dealership setting: settings.gbp_auto_respond = true)
 *
 * Secured by CRON_SECRET header.
 * Schedule: 0 8 * * *  (8 AM UTC — after overnight review activity)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptTokens } from "@/lib/dms/encrypt";
import {
  fetchGbpReviews,
  fetchGbpQAndA,
  postGbpReply,
  type GbpTokens,
} from "@/lib/reputation/gbp-client";
import { generateReviewReply, type ReputationContext } from "@/lib/reputation/reply-generator";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

interface SyncResult {
  dealershipId:  string;
  reviewsSynced: number;
  qaSynced:      number;
  repliesPosted: number;
  error?:        string;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const svc = createServiceClient();

  // Load all active GBP connections
  const { data: connections } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .select("dealership_id,encrypted_tokens,metadata" as never)
    .eq("provider" as never, "google_business_profile" as never)
    .eq("status" as never, "active" as never) as unknown as {
      data: Array<{
        dealership_id:    string;
        encrypted_tokens: string;
        metadata:         Record<string, unknown>;
      }> | null;
    };

  const results: SyncResult[] = [];

  for (const conn of connections ?? []) {
    const result: SyncResult = {
      dealershipId:  conn.dealership_id,
      reviewsSynced: 0,
      qaSynced:      0,
      repliesPosted: 0,
    };

    try {
      const tokens = await decryptTokens<GbpTokens>(conn.encrypted_tokens);

      // Load dealership info for AI context
      const { data: dealer } = await (svc as ReturnType<typeof createServiceClient>)
        .from("dealerships" as never)
        .select("name,address,settings" as never)
        .eq("id" as never, conn.dealership_id as never)
        .single() as unknown as {
          data: { name: string; address: { city?: string; state?: string } | null; settings: Record<string, unknown> | null } | null;
        };

      const ctx: ReputationContext = {
        dealershipName:  dealer?.name ?? "Our Dealership",
        dealershipCity:  dealer?.address?.city,
        dealershipState: dealer?.address?.state,
        gmName:          (dealer?.settings as Record<string, string> | null)?.gmName,
        makes:           (dealer?.settings as Record<string, string[]> | null)?.makes,
      };

      const autoRespond = (dealer?.settings as Record<string, boolean> | null)?.gbp_auto_respond === true;

      // ── 1. Sync reviews ────────────────────────────────────────────────────
      const reviews = await fetchGbpReviews(tokens);

      for (const r of reviews) {
        await (svc as ReturnType<typeof createServiceClient>)
          .from("gbp_reviews" as never)
          .upsert({
            dealership_id:      conn.dealership_id,
            gbp_review_id:      r.name,
            reviewer_name:      r.reviewer?.displayName ?? null,
            reviewer_photo_url: r.reviewer?.profilePhotoUrl ?? null,
            rating:             r.starRating,
            comment:            r.comment ?? null,
            create_time:        r.createTime,
            update_time:        r.updateTime,
            ...(r.reviewReply ? {
              reply_comment:     r.reviewReply.comment,
              reply_update_time: r.reviewReply.updateTime,
              reply_status:      "posted",
            } : {}),
            synced_at: new Date().toISOString(),
          } as never, { onConflict: "dealership_id,gbp_review_id" });

        result.reviewsSynced++;

        // Auto-respond: if enabled and review has no reply and has a text comment
        if (
          autoRespond &&
          !r.reviewReply &&
          r.comment &&
          r.comment.trim().length > 10
        ) {
          try {
            const replyText = await generateReviewReply(r, ctx);
            await postGbpReply(tokens, r.name, replyText);

            await (svc as ReturnType<typeof createServiceClient>)
              .from("gbp_reviews" as never)
              .update({
                reply_comment:     replyText,
                reply_update_time: new Date().toISOString(),
                reply_is_ai:       true,
                reply_status:      "posted",
              } as never)
              .eq("dealership_id" as never, conn.dealership_id as never)
              .eq("gbp_review_id" as never, r.name as never);

            result.repliesPosted++;
          } catch (replyErr) {
            console.warn(`[gbp-sync] auto-reply failed for ${r.name}:`, replyErr);
          }
        }
      }

      // ── 2. Sync Q&A ────────────────────────────────────────────────────────
      const questions = await fetchGbpQAndA(tokens);

      for (const q of questions) {
        const topAnswer = q.topAnswers?.[0];
        await (svc as ReturnType<typeof createServiceClient>)
          .from("gbp_qanda" as never)
          .upsert({
            dealership_id:   conn.dealership_id,
            gbp_question_id: q.name,
            question_text:   q.text,
            author_name:     q.author?.displayName ?? null,
            question_time:   q.createTime,
            upvote_count:    q.upvoteCount ?? 0,
            ...(topAnswer ? {
              answer_text:         topAnswer.text,
              answer_author:       topAnswer.author?.displayName ?? null,
              answer_time:         topAnswer.createTime,
              answer_upvote_count: topAnswer.upvoteCount ?? 0,
              answer_status:       "posted",
            } : {}),
            synced_at: new Date().toISOString(),
          } as never, { onConflict: "dealership_id,gbp_question_id" });

        result.qaSynced++;
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      console.error(`[gbp-sync] dealership ${conn.dealership_id}:`, err);
    }

    results.push(result);
  }

  return NextResponse.json({
    processed:     results.length,
    totalReviews:  results.reduce((s, r) => s + r.reviewsSynced, 0),
    totalQA:       results.reduce((s, r) => s + r.qaSynced, 0),
    totalReplies:  results.reduce((s, r) => s + r.repliesPosted, 0),
    errors:        results.filter((r) => r.error).length,
    results,
    durationMs:    Date.now() - started,
    runAt:         new Date().toISOString(),
  });
}
