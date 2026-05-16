/**
 * /api/reputation/reviews
 *
 * GET  — list reviews from local DB cache (fast)
 * POST — trigger sync from GBP API (pulls latest reviews, upserts to DB)
 *
 * Query params (GET):
 *   ?rating=1|2|3|4|5  — filter by star rating
 *   ?status=none|posted — filter by reply_status
 *   ?limit=50           — max rows (default 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { decryptTokens } from "@/lib/dms/encrypt";
import { fetchGbpReviews, type GbpTokens } from "@/lib/reputation/gbp-client";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const ratingFilter = searchParams.get("rating");   // "1"–"5"
    const statusFilter = searchParams.get("status");   // "none" | "posted"
    const limit        = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

    const svc = createServiceClient();

    let query = (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_reviews" as never)
      .select("*" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("create_time" as never, { ascending: false })
      .limit(limit);

    if (ratingFilter) {
      const ratingNames: Record<string, string> = {
        "1": "ONE", "2": "TWO", "3": "THREE", "4": "FOUR", "5": "FIVE",
      };
      const ratingName = ratingNames[ratingFilter];
      if (ratingName) query = query.eq("rating" as never, ratingName as never);
    }

    if (statusFilter) {
      query = query.eq("reply_status" as never, statusFilter as never);
    }

    const { data: reviews, error } = await (query as unknown as Promise<{
      data: Array<Record<string, unknown>> | null;
      error: { message: string } | null;
    }>);

    if (error) throw new Error(error.message);

    return NextResponse.json({ reviews: reviews ?? [], count: (reviews ?? []).length });
  } catch (err) {
    console.error("[GET /api/reputation/reviews]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ── POST — trigger sync from GBP ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const body = await req.json().catch(() => ({})) as { action?: string };
    if (body.action !== "sync") {
      return NextResponse.json({ error: "action must be 'sync'" }, { status: 400 });
    }

    const svc = createServiceClient();

    // Load GBP connection
    const { data: conn } = await (svc as ReturnType<typeof createServiceClient>)
      .from("dms_connections" as never)
      .select("encrypted_tokens" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("provider" as never, "google_business_profile" as never)
      .eq("status" as never, "active" as never)
      .single() as unknown as { data: { encrypted_tokens: string } | null };

    if (!conn) return NextResponse.json({ error: "GBP not connected" }, { status: 400 });

    const tokens  = await decryptTokens<GbpTokens>(conn.encrypted_tokens);
    const reviews = await fetchGbpReviews(tokens);

    // Upsert each review
    let synced = 0;
    for (const r of reviews) {
      await (svc as ReturnType<typeof createServiceClient>)
        .from("gbp_reviews" as never)
        .upsert({
          dealership_id:      dealershipId,
          gbp_review_id:      r.name,
          reviewer_name:      r.reviewer?.displayName ?? null,
          reviewer_photo_url: r.reviewer?.profilePhotoUrl ?? null,
          rating:             r.starRating,
          comment:            r.comment ?? null,
          create_time:        r.createTime,
          update_time:        r.updateTime,
          // Preserve existing reply status — only update if GBP says there's a reply
          ...(r.reviewReply ? {
            reply_comment:      r.reviewReply.comment,
            reply_update_time:  r.reviewReply.updateTime,
            reply_status:       "posted",
          } : {}),
          synced_at: new Date().toISOString(),
        } as never, { onConflict: "dealership_id,gbp_review_id" });
      synced++;
    }

    return NextResponse.json({ synced, total: reviews.length });
  } catch (err) {
    console.error("[POST /api/reputation/reviews sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
