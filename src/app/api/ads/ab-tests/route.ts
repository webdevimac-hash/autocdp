/**
 * /api/ads/ab-tests
 *
 * GET  — list all A/B tests for the current dealership
 * POST — create a new A/B test and push variants to the platform
 *
 * POST body:
 *   name:               string
 *   platform:           "google_ads" | "meta_ads"
 *   hypothesis:         string
 *   primaryMetric:      "ctr" | "cvr" | "cpa" | "roas" | "clicks"
 *   minImpressions:     number   (default 1000)
 *   confidenceThreshold: number  (default 0.95)
 *   budgetScalePct:     number   (default 20)
 *   autoOptimize:       boolean  (default true)
 *   platformCampaignId?: string
 *   platformAdGroupId?:  string
 *
 *   // Creative spec — one of:
 *   generatedCreatives?: GenerateGoogleCreativesOutput | GenerateMetaCreativesOutput
 *   // or provide raw variants to push:
 *   variants?: Array<{
 *     name:       string
 *     isControl:  boolean
 *     creative:   Record<string, unknown>
 *   }>
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const svc = createServiceClient();

    // Load tests + their variants in parallel
    const { data: tests } = await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_tests" as never)
      .select("id,name,platform,status,primary_metric,hypothesis,min_impressions,confidence_threshold,auto_optimize,budget_scale_pct,winner_variant_id,started_at,ended_at,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("created_at" as never, { ascending: false })
      .limit(50) as unknown as {
        data: Array<Record<string, unknown>> | null;
      };

    const testIds = (tests ?? []).map((t) => (t as { id: string }).id);

    const { data: variants } = testIds.length
      ? await (svc as ReturnType<typeof createServiceClient>)
          .from("paid_ab_variants" as never)
          .select("id,test_id,name,is_control,platform_ad_id,impressions,clicks,conversions,spend_usd,ctr,cvr,cpa,roas,win_probability,status,last_kpi_sync_at" as never)
          .in("test_id" as never, testIds as never) as unknown as { data: Array<Record<string, unknown>> | null }
      : { data: [] };

    // Group variants by test
    const variantsByTest = new Map<string, Array<Record<string, unknown>>>();
    for (const v of variants ?? []) {
      const tid = (v as { test_id: string }).test_id;
      if (!variantsByTest.has(tid)) variantsByTest.set(tid, []);
      variantsByTest.get(tid)!.push(v);
    }

    const result = (tests ?? []).map((t) => ({
      ...t,
      variants: variantsByTest.get((t as { id: string }).id) ?? [],
    }));

    return NextResponse.json({ tests: result });
  } catch (err) {
    console.error("[GET /api/ads/ab-tests]", err);
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

    const body = await req.json() as {
      name:                string;
      platform:            string;
      hypothesis?:         string;
      primaryMetric?:      string;
      minImpressions?:     number;
      confidenceThreshold?: number;
      budgetScalePct?:     number;
      autoOptimize?:       boolean;
      platformCampaignId?: string;
      platformAdGroupId?:  string;
      variants?: Array<{
        name:      string;
        isControl: boolean;
        creative:  Record<string, unknown>;
      }>;
    };

    if (!body.name || !body.platform) {
      return NextResponse.json({ error: "name and platform are required" }, { status: 400 });
    }

    if (!["google_ads", "meta_ads", "tiktok_ads"].includes(body.platform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    const svc = createServiceClient();

    // 1. Create the test record
    const { data: newTest, error: testErr } = await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_tests" as never)
      .insert({
        dealership_id:        dealershipId,
        name:                 body.name,
        platform:             body.platform,
        hypothesis:           body.hypothesis ?? null,
        primary_metric:       body.primaryMetric ?? "ctr",
        min_impressions:      body.minImpressions ?? 1000,
        confidence_threshold: body.confidenceThreshold ?? 0.95,
        budget_scale_pct:     body.budgetScalePct ?? 20,
        auto_optimize:        body.autoOptimize ?? true,
        platform_campaign_id: body.platformCampaignId ?? null,
        platform_ad_group_id: body.platformAdGroupId ?? null,
        status:               "active",
      } as never)
      .select("id" as never)
      .single() as unknown as { data: { id: string } | null; error: { message: string } | null };

    if (testErr || !newTest) {
      return NextResponse.json({ error: testErr?.message ?? "Failed to create test" }, { status: 500 });
    }

    const testId = newTest.id;

    // 2. Create variant records
    const variantsToInsert = (body.variants ?? []).map((v) => ({
      test_id:      testId,
      dealership_id: dealershipId,
      name:         v.name,
      is_control:   v.isControl,
      creative:     v.creative,
      status:       "draft",  // 'active' once platform ad is pushed
    }));

    if (variantsToInsert.length > 0) {
      await (svc as ReturnType<typeof createServiceClient>)
        .from("paid_ab_variants" as never)
        .insert(variantsToInsert as never);
    }

    const { data: createdVariants } = await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_variants" as never)
      .select("id,name,is_control,status" as never)
      .eq("test_id" as never, testId as never) as unknown as {
        data: Array<Record<string, unknown>> | null;
      };

    return NextResponse.json({
      testId,
      name:     body.name,
      platform: body.platform,
      status:   "active",
      variants: createdVariants ?? [],
      message:  `A/B test created with ${(createdVariants ?? []).length} variants. Push ads to each variant to start collecting data.`,
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ads/ab-tests]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
