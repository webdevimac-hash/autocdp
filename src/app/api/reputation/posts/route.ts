/**
 * /api/reputation/posts
 *
 * GET  — list GBP posts from local DB cache
 * POST — AI-generate a post and push it to GBP (or save as draft)
 *
 * POST body:
 *   { prompt: string; finalUrl?: string; draftOnly?: boolean }
 *   or
 *   { manual: true; summary: string; topicType?: string; callToActionType?: string; callToActionUrl?: string; draftOnly?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { decryptTokens } from "@/lib/dms/encrypt";
import { createGbpPost, type GbpTokens, type GbpPost } from "@/lib/reputation/gbp-client";
import { generateGbpPost, type ReputationContext } from "@/lib/reputation/reply-generator";

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
    const stateFilter = searchParams.get("state");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "25"), 50);

    const svc = createServiceClient();

    let query = (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_posts" as never)
      .select("*" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("created_at" as never, { ascending: false })
      .limit(limit);

    if (stateFilter) {
      query = query.eq("state" as never, stateFilter as never);
    }

    const { data: posts } = await (query as unknown as Promise<{
      data: Array<Record<string, unknown>> | null;
    }>);

    return NextResponse.json({ posts: posts ?? [] });
  } catch (err) {
    console.error("[GET /api/reputation/posts]", err);
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

    // Load dealership context
    const { data: dealer } = await (svc as ReturnType<typeof createServiceClient>)
      .from("dealerships" as never)
      .select("name,address,settings" as never)
      .eq("id" as never, dealershipId as never)
      .single() as unknown as {
        data: { name: string; address: { city?: string; state?: string } | null; settings: Record<string, unknown> | null } | null;
      };

    const body = await req.json() as {
      prompt?:           string;
      finalUrl?:         string;
      draftOnly?:        boolean;
      // manual override
      manual?:           boolean;
      summary?:          string;
      topicType?:        string;
      callToActionType?: string;
      callToActionUrl?:  string;
    };

    const ctx: ReputationContext = {
      dealershipName:  dealer?.name ?? "Our Dealership",
      dealershipCity:  dealer?.address?.city,
      dealershipState: dealer?.address?.state,
      makes:           (dealer?.settings as Record<string, string[]> | null)?.makes,
    };

    const finalUrl = body.finalUrl ?? `https://${(dealer?.name ?? "").toLowerCase().replace(/\s/g, "")}.com`;

    let postData: {
      topicType:         string;
      summary:           string;
      callToActionType?: string;
      callToActionUrl?:  string;
      isAi:              boolean;
    };

    if (body.manual) {
      if (!body.summary) return NextResponse.json({ error: "summary is required" }, { status: 400 });
      postData = {
        topicType:        body.topicType ?? "STANDARD",
        summary:          body.summary,
        callToActionType: body.callToActionType,
        callToActionUrl:  body.callToActionUrl,
        isAi:             false,
      };
    } else {
      if (!body.prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });
      const generated = await generateGbpPost(body.prompt, ctx, finalUrl);
      postData = {
        topicType:        generated.topicType,
        summary:          generated.summary,
        callToActionType: generated.callToActionType,
        callToActionUrl:  generated.callToActionUrl ?? finalUrl,
        isAi:             true,
      };
    }

    // If draft-only: save to DB, skip GBP API
    if (body.draftOnly) {
      const { data: saved } = await (svc as ReturnType<typeof createServiceClient>)
        .from("gbp_posts" as never)
        .insert({
          dealership_id:       dealershipId,
          topic_type:          postData.topicType,
          summary:             postData.summary,
          call_to_action_type: postData.callToActionType ?? null,
          call_to_action_url:  postData.callToActionUrl  ?? null,
          state:               "draft",
          is_ai_generated:     postData.isAi,
        } as never)
        .select("*" as never)
        .single() as unknown as { data: Record<string, unknown> | null };

      return NextResponse.json({ post: saved, status: "draft" }, { status: 201 });
    }

    // Load GBP connection
    const { data: conn } = await (svc as ReturnType<typeof createServiceClient>)
      .from("dms_connections" as never)
      .select("encrypted_tokens" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("provider" as never, "google_business_profile" as never)
      .eq("status" as never, "active" as never)
      .single() as unknown as { data: { encrypted_tokens: string } | null };

    if (!conn) return NextResponse.json({ error: "GBP not connected" }, { status: 400 });

    const tokens = await decryptTokens<GbpTokens>(conn.encrypted_tokens);

    // Build GBP post payload
    const gbpPayload: GbpPost = {
      languageCode: "en-US",
      summary:      postData.summary,
      topicType:    postData.topicType,
      ...(postData.callToActionType && postData.callToActionUrl ? {
        callToAction: {
          actionType: postData.callToActionType,
          url:        postData.callToActionUrl,
        },
      } : {}),
    };

    const created = await createGbpPost(tokens, gbpPayload);

    // Save to DB
    const { data: saved } = await (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_posts" as never)
      .insert({
        dealership_id:       dealershipId,
        gbp_post_id:         created.name ?? null,
        topic_type:          postData.topicType,
        summary:             postData.summary,
        call_to_action_type: postData.callToActionType ?? null,
        call_to_action_url:  postData.callToActionUrl  ?? null,
        state:               "live",
        is_ai_generated:     postData.isAi,
        create_time:         created.createTime ?? new Date().toISOString(),
      } as never)
      .select("*" as never)
      .single() as unknown as { data: Record<string, unknown> | null };

    return NextResponse.json({ post: saved, status: "live" }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/reputation/posts]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
