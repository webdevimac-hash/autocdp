/**
 * /api/ads/ab-tests/[testId]
 *
 * GET   — full test details with variant KPIs + evaluation
 * PATCH — update test (pause, set winner manually, update settings)
 * DELETE — soft-delete (sets status=completed)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { evaluateTest } from "@/lib/ads/ab-test-engine";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const svc = createServiceClient();

    // Verify ownership
    const { data: test } = await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_tests" as never)
      .select("*" as never)
      .eq("id" as never, testId as never)
      .eq("dealership_id" as never, dealershipId as never)
      .single() as unknown as { data: Record<string, unknown> | null };

    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    const { data: variants } = await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_variants" as never)
      .select("*" as never)
      .eq("test_id" as never, testId as never)
      .order("is_control" as never, { ascending: false }) as unknown as {
        data: Array<Record<string, unknown>> | null;
      };

    const { data: optLog } = await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_optimization_log" as never)
      .select("action,variant_id,details,created_at" as never)
      .eq("test_id" as never, testId as never)
      .order("created_at" as never, { ascending: false })
      .limit(20) as unknown as { data: Array<Record<string, unknown>> | null };

    // Run live evaluation for active tests
    let evaluation = null;
    if (test.status === "active") {
      try {
        evaluation = await evaluateTest(testId);
      } catch {
        // Non-fatal — just skip evaluation
      }
    }

    return NextResponse.json({
      test,
      variants:     variants ?? [],
      optimizationLog: optLog ?? [],
      evaluation,
    });
  } catch (err) {
    console.error("[GET /api/ads/ab-tests/[testId]]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const svc = createServiceClient();

    // Verify ownership
    const { data: test } = await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_tests" as never)
      .select("id,dealership_id" as never)
      .eq("id" as never, testId as never)
      .eq("dealership_id" as never, dealershipId as never)
      .single() as unknown as { data: { id: string; dealership_id: string } | null };

    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    const body = await req.json() as {
      status?:            string;
      winnerVariantId?:   string;
      autoOptimize?:      boolean;
      confidenceThreshold?: number;
      minImpressions?:    number;
      // Link a variant to a platform ad after manual push
      variantId?:         string;
      platformAdId?:      string;
      platformAdGroupId?: string;
      platformCampaignId?: string;
    };

    // Update test record
    const testUpdate: Record<string, unknown> = {};
    if (body.status !== undefined) {
      const validStatuses = ["draft","active","paused","winner_declared","completed","failed"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      testUpdate.status = body.status;
      if (body.status === "completed" || body.status === "winner_declared") {
        testUpdate.ended_at = new Date().toISOString();
      }
    }
    if (body.winnerVariantId !== undefined) testUpdate.winner_variant_id = body.winnerVariantId;
    if (body.autoOptimize    !== undefined) testUpdate.auto_optimize      = body.autoOptimize;
    if (body.confidenceThreshold !== undefined) testUpdate.confidence_threshold = body.confidenceThreshold;
    if (body.minImpressions  !== undefined) testUpdate.min_impressions    = body.minImpressions;

    if (Object.keys(testUpdate).length > 0) {
      await (svc as ReturnType<typeof createServiceClient>)
        .from("paid_ab_tests" as never)
        .update(testUpdate as never)
        .eq("id" as never, testId as never);
    }

    // Link platform ad IDs to a variant (after manual push)
    if (body.variantId && body.platformAdId) {
      await (svc as ReturnType<typeof createServiceClient>)
        .from("paid_ab_variants" as never)
        .update({
          platform_ad_id:       body.platformAdId,
          platform_ad_group_id: body.platformAdGroupId ?? null,
          platform_campaign_id: body.platformCampaignId ?? null,
          status:               "active",
        } as never)
        .eq("id" as never, body.variantId as never)
        .eq("test_id" as never, testId as never);
    }

    return NextResponse.json({ success: true, testId });
  } catch (err) {
    console.error("[PATCH /api/ads/ab-tests/[testId]]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ── DELETE (soft) ─────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const svc = createServiceClient();
    await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_tests" as never)
      .update({ status: "completed", ended_at: new Date().toISOString() } as never)
      .eq("id" as never, testId as never)
      .eq("dealership_id" as never, dealershipId as never);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/ads/ab-tests/[testId]]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
