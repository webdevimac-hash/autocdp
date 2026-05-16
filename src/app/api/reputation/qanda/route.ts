/**
 * /api/reputation/qanda
 *
 * GET  — list Q&A from local DB cache
 * POST — sync from GBP OR post an AI-generated answer to a question
 *
 * POST body variants:
 *   { action: "sync" }                                  — pull Q&A from GBP
 *   { action: "answer"; questionId: string; text?: string; generate?: boolean } — answer a question
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { decryptTokens } from "@/lib/dms/encrypt";
import {
  fetchGbpQAndA,
  postGbpAnswer,
  type GbpTokens,
} from "@/lib/reputation/gbp-client";
import { generateQaAnswer, type ReputationContext } from "@/lib/reputation/reply-generator";

export const dynamic    = "force-dynamic";
export const maxDuration = 60;

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status"); // "unanswered" | "posted"
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "30"), 60);

    const svc = createServiceClient();

    let query = (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_qanda" as never)
      .select("*" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("question_time" as never, { ascending: false })
      .limit(limit);

    if (statusFilter) {
      query = query.eq("answer_status" as never, statusFilter as never);
    }

    const { data: questions } = await (query as unknown as Promise<{
      data: Array<Record<string, unknown>> | null;
    }>);

    return NextResponse.json({ questions: questions ?? [] });
  } catch (err) {
    console.error("[GET /api/reputation/qanda]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const svc = createServiceClient();

    const body = await req.json() as {
      action:      "sync" | "answer";
      questionId?: string;   // DB uuid
      text?:       string;
      generate?:   boolean;
    };

    // Load GBP connection (needed for both sync and answer)
    const { data: conn } = await (svc as ReturnType<typeof createServiceClient>)
      .from("dms_connections" as never)
      .select("encrypted_tokens" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("provider" as never, "google_business_profile" as never)
      .eq("status" as never, "active" as never)
      .single() as unknown as { data: { encrypted_tokens: string } | null };

    if (!conn) return NextResponse.json({ error: "GBP not connected" }, { status: 400 });

    const tokens = await decryptTokens<GbpTokens>(conn.encrypted_tokens);

    // ── SYNC ────────────────────────────────────────────────────────────────
    if (body.action === "sync") {
      const questions = await fetchGbpQAndA(tokens);

      for (const q of questions) {
        const topAnswer = q.topAnswers?.[0];
        await (svc as ReturnType<typeof createServiceClient>)
          .from("gbp_qanda" as never)
          .upsert({
            dealership_id:       dealershipId,
            gbp_question_id:     q.name,
            question_text:       q.text,
            author_name:         q.author?.displayName ?? null,
            question_time:       q.createTime,
            upvote_count:        q.upvoteCount ?? 0,
            // Only set answer fields if GBP returned one
            ...(topAnswer ? {
              answer_text:         topAnswer.text,
              answer_author:       topAnswer.author?.displayName ?? null,
              answer_time:         topAnswer.createTime,
              answer_upvote_count: topAnswer.upvoteCount ?? 0,
              answer_status:       "posted",
            } : {}),
            synced_at: new Date().toISOString(),
          } as never, { onConflict: "dealership_id,gbp_question_id" });
      }

      return NextResponse.json({ synced: questions.length });
    }

    // ── ANSWER ──────────────────────────────────────────────────────────────
    if (body.action === "answer") {
      if (!body.questionId) return NextResponse.json({ error: "questionId required" }, { status: 400 });

      // Load question from DB
      const { data: question } = await (svc as ReturnType<typeof createServiceClient>)
        .from("gbp_qanda" as never)
        .select("gbp_question_id,question_text" as never)
        .eq("id" as never, body.questionId as never)
        .eq("dealership_id" as never, dealershipId as never)
        .single() as unknown as { data: { gbp_question_id: string; question_text: string } | null };

      if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

      // Load dealership context
      const { data: dealer } = await (svc as ReturnType<typeof createServiceClient>)
        .from("dealerships" as never)
        .select("name,address,settings" as never)
        .eq("id" as never, dealershipId as never)
        .single() as unknown as {
          data: { name: string; address: { city?: string; state?: string } | null; settings: Record<string, unknown> | null } | null;
        };

      const ctx: ReputationContext = {
        dealershipName:  dealer?.name ?? "Our Dealership",
        dealershipCity:  dealer?.address?.city,
        dealershipState: dealer?.address?.state,
        makes:           (dealer?.settings as Record<string, string[]> | null)?.makes,
      };

      let answerText: string;
      let isAi = false;

      if (body.generate || !body.text) {
        answerText = await generateQaAnswer(
          question.question_text,
          ctx,
          (dealer?.settings as Record<string, string> | null)?.website ?? undefined
        );
        isAi = true;
      } else {
        answerText = body.text.trim();
      }

      if (!answerText) return NextResponse.json({ error: "Answer text is empty" }, { status: 400 });

      // Post to GBP
      await postGbpAnswer(tokens, question.gbp_question_id, answerText);

      // Update DB
      await (svc as ReturnType<typeof createServiceClient>)
        .from("gbp_qanda" as never)
        .update({
          answer_text:   answerText,
          answer_author: ctx.dealershipName,
          answer_time:   new Date().toISOString(),
          answer_is_ai:  isAi,
          answer_status: "posted",
        } as never)
        .eq("id" as never, body.questionId as never);

      return NextResponse.json({ answer: answerText, isAi, status: "posted" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/reputation/qanda]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
