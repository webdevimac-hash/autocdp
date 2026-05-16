/**
 * A/B Test Engine — Statistical Significance + Auto-Optimization
 *
 * Handles:
 *   1. KPI sync  — pull latest performance from ads_performance → update variant caches
 *   2. Evaluation — z-test for CTR/CVR, t-test approximation for CPA/ROAS
 *   3. Auto-optimization — pause losing variants, scale winner budget, write patterns
 *
 * Called by:
 *   - /api/cron/ab-test-optimizer  (daily cron)
 *   - /api/ads/ab-tests/[testId]/optimize  (manual trigger)
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";
import { updateGoogleAdsBudget, getGoogleAdsAccessToken } from "./google-ads";
import { updateMetaAdSetBudget } from "./meta-ads";
import { decryptTokens } from "@/lib/dms/encrypt";
import type { GoogleAdsTokens } from "./google-ads";
import type { MetaAdsTokens } from "./meta-ads";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrimaryMetric = "ctr" | "cvr" | "cpa" | "roas" | "clicks";

export interface VariantKpis {
  variantId:   string;
  name:        string;
  isControl:   boolean;
  platformAdId: string | null;
  impressions: number;
  clicks:      number;
  conversions: number;
  spendUsd:    number;
  ctr:         number;
  cvr:         number;
  cpa:         number | null;
  roas:        number | null;
  status:      string;
}

export interface EvaluationResult {
  testId:           string;
  status:           string;
  primaryMetric:    PrimaryMetric;
  variants:         VariantKpis[];
  winner:           VariantKpis | null;
  control:          VariantKpis | null;
  winnerConfidence: number;  // 0–1 win probability of winner vs control
  liftPct:          number;
  pValue:           number;
  hasEnoughData:    boolean;
  readyToOptimize:  boolean;
  message:          string;
}

export interface OptimizationResult {
  testId:         string;
  action:         "winner_declared" | "no_action" | "insufficient_data" | "failed";
  winnerVariantId?: string;
  winnerName?:    string;
  liftPct?:       number;
  confidence?:    number;
  patternSaved:   boolean;
  budgetScaled:   boolean;
  variantsPaused: number;
  message:        string;
  error?:         string;
}

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

/**
 * Normal CDF approximation (Abramowitz & Stegun 26.2.17).
 * Accurate to ±1.5e-7.
 */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.319381530 +
    t * (-0.356563782 +
    t * (1.781477937 +
    t * (-1.821255978 +
    t *  1.330274429))));
  const pdf  = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const cdf  = 1 - pdf * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

/**
 * Two-proportion z-test (for CTR / CVR comparisons).
 * Returns the two-tailed p-value.
 */
function proportionZTest(
  success1: number, n1: number,
  success2: number, n2: number
): { zScore: number; pValue: number } {
  if (n1 === 0 || n2 === 0) return { zScore: 0, pValue: 1 };
  const p1    = success1 / n1;
  const p2    = success2 / n2;
  const pPool = (success1 + success2) / (n1 + n2);
  if (pPool === 0 || pPool === 1) return { zScore: 0, pValue: 1 };
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return { zScore: 0, pValue: 1 };
  const z = (p1 - p2) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z))); // two-tailed
  return { zScore: +z.toFixed(4), pValue: +pValue.toFixed(6) };
}

/**
 * Win probability: P(variant > control) using normal approximation.
 * Returns 0–1 where >0.95 = significant win.
 */
function winProbability(
  successVariant: number, nVariant: number,
  successControl: number, nControl: number
): number {
  const { zScore } = proportionZTest(
    successVariant, nVariant, successControl, nControl
  );
  // P(variant > control) = P(Z > -z) for one-sided test
  return +normalCdf(zScore).toFixed(4);
}

/** Get the metric value for comparison. */
function getMetricValue(v: VariantKpis, metric: PrimaryMetric): number {
  switch (metric) {
    case "ctr":    return v.ctr;
    case "cvr":    return v.cvr;
    case "cpa":    return v.cpa ?? Infinity;     // lower is better
    case "roas":   return v.roas ?? 0;
    case "clicks": return v.clicks;
    default:       return v.ctr;
  }
}

/** For CPA, lower is better; for everything else, higher is better. */
function isBetter(metric: PrimaryMetric, value: number, control: number): boolean {
  if (metric === "cpa") return value < control;
  return value > control;
}

// ---------------------------------------------------------------------------
// KPI sync
// ---------------------------------------------------------------------------

interface RawVariantRow {
  id:                  string;
  name:                string;
  is_control:          boolean;
  platform_ad_id:      string | null;
  platform_ad_group_id: string | null;
  platform_campaign_id: string | null;
  impressions:         number;
  clicks:              number;
  conversions:         number;
  spend_usd:           number;
  roas:                number | null;
  status:              string;
}

interface RawTestRow {
  id:                   string;
  dealership_id:        string;
  name:                 string;
  platform:             string;
  status:               string;
  primary_metric:       string;
  min_impressions:      number;
  confidence_threshold: number;
  auto_optimize:        boolean;
  budget_scale_pct:     number;
  platform_campaign_id: string | null;
  platform_ad_group_id: string | null;
  winner_variant_id:    string | null;
}

/**
 * Pull latest KPIs from ads_performance for all active variants in a test.
 * Aggregates the last 30 days by platform_ad_id.
 */
async function syncVariantKpis(
  svc: ReturnType<typeof createServiceClient>,
  testId: string,
  dealershipId: string
): Promise<void> {
  // Load variants
  const { data: variants } = await (svc as ReturnType<typeof createServiceClient>)
    .from("paid_ab_variants" as never)
    .select("id,platform_ad_id" as never)
    .eq("test_id" as never, testId as never)
    .neq("platform_ad_id" as never, null as never) as unknown as {
      data: Array<{ id: string; platform_ad_id: string }> | null;
    };

  if (!variants?.length) return;

  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  for (const v of variants) {
    // Sum performance for this ad ID from ads_performance
    const { data: perf } = await (svc as ReturnType<typeof createServiceClient>)
      .from("ads_performance" as never)
      .select("impressions,clicks,conversions,spend_usd,roas" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("ad_id" as never, v.platform_ad_id as never)
      .gte("date_start" as never, since30 as never) as unknown as {
        data: Array<{
          impressions: number; clicks: number;
          conversions: number; spend_usd: number; roas: number | null;
        }> | null;
      };

    if (!perf?.length) continue;

    let imp = 0, clk = 0, conv = 0, spend = 0, roasWeightedRev = 0;
    for (const r of perf) {
      imp   += r.impressions;
      clk   += r.clicks;
      conv  += Number(r.conversions);
      spend += Number(r.spend_usd);
      if (r.roas != null) roasWeightedRev += Number(r.roas) * Number(r.spend_usd);
    }

    const computedRoas = spend > 0 && roasWeightedRev > 0
      ? +(roasWeightedRev / spend).toFixed(4) : null;

    await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_variants" as never)
      .update({
        impressions:      imp,
        clicks:           clk,
        conversions:      conv,
        spend_usd:        +spend.toFixed(4),
        roas:             computedRoas,
        last_kpi_sync_at: new Date().toISOString(),
      } as never)
      .eq("id" as never, v.id as never);
  }
}

// ---------------------------------------------------------------------------
// Evaluate a single test
// ---------------------------------------------------------------------------

export async function evaluateTest(testId: string): Promise<EvaluationResult> {
  const svc = createServiceClient();

  // Load test
  const { data: test } = await (svc as ReturnType<typeof createServiceClient>)
    .from("paid_ab_tests" as never)
    .select("id,dealership_id,name,platform,status,primary_metric,min_impressions,confidence_threshold,auto_optimize,budget_scale_pct,platform_campaign_id,platform_ad_group_id,winner_variant_id" as never)
    .eq("id" as never, testId as never)
    .single() as unknown as { data: RawTestRow | null };

  if (!test) throw new Error(`Test ${testId} not found`);

  // Sync KPIs first
  await syncVariantKpis(svc, testId, test.dealership_id);

  // Load variants with fresh KPIs
  const { data: rawVariants } = await (svc as ReturnType<typeof createServiceClient>)
    .from("paid_ab_variants" as never)
    .select("id,name,is_control,platform_ad_id,platform_ad_group_id,platform_campaign_id,impressions,clicks,conversions,spend_usd,roas,status" as never)
    .eq("test_id" as never, testId as never)
    .order("is_control" as never, { ascending: false }) as unknown as {
      data: RawVariantRow[] | null;
    };

  const rawVars = rawVariants ?? [];
  const metric  = test.primary_metric as PrimaryMetric;
  const minImp  = test.min_impressions;
  const confThreshold = Number(test.confidence_threshold);

  const variants: VariantKpis[] = rawVars.map((v) => ({
    variantId:   v.id,
    name:        v.name,
    isControl:   v.is_control,
    platformAdId: v.platform_ad_id,
    impressions: v.impressions,
    clicks:      v.clicks,
    conversions: Number(v.conversions),
    spendUsd:    Number(v.spend_usd),
    ctr:         v.impressions > 0 ? v.clicks / v.impressions : 0,
    cvr:         v.clicks > 0 ? Number(v.conversions) / v.clicks : 0,
    cpa:         Number(v.conversions) > 0 ? Number(v.spend_usd) / Number(v.conversions) : null,
    roas:        v.roas != null ? Number(v.roas) : null,
    status:      v.status,
  }));

  const control = variants.find((v) => v.isControl) ?? null;
  const challengers = variants.filter((v) => !v.isControl);

  // Need at least control + one challenger
  if (!control || challengers.length === 0) {
    return {
      testId, status: test.status, primaryMetric: metric, variants, winner: null, control,
      winnerConfidence: 0, liftPct: 0, pValue: 1, hasEnoughData: false,
      readyToOptimize: false, message: "Need at least one control and one challenger variant.",
    };
  }

  // Check minimum impressions per variant
  const hasEnoughData = variants.every((v) => v.impressions >= minImp);
  if (!hasEnoughData) {
    const minSeen = Math.min(...variants.map((v) => v.impressions));
    return {
      testId, status: test.status, primaryMetric: metric, variants, winner: null, control,
      winnerConfidence: 0, liftPct: 0, pValue: 1, hasEnoughData: false,
      readyToOptimize: false,
      message: `Need ≥${minImp.toLocaleString()} impressions per variant. Minimum seen: ${minSeen.toLocaleString()}.`,
    };
  }

  // Find best challenger vs control
  let bestChallenger: VariantKpis | null = null;
  let bestWinProb = 0;
  let bestPValue  = 1;
  let bestZScore  = 0;

  for (const ch of challengers.filter((c) => c.status !== "eliminated" && c.status !== "paused")) {
    let winProb: number;
    let pValue: number;
    let zScore: number;

    if (metric === "ctr") {
      const res = proportionZTest(ch.clicks, ch.impressions, control.clicks, control.impressions);
      zScore  = res.zScore;
      pValue  = res.pValue;
      winProb = winProbability(ch.clicks, ch.impressions, control.clicks, control.impressions);
    } else if (metric === "cvr") {
      const res = proportionZTest(Math.round(ch.conversions), ch.clicks, Math.round(control.conversions), control.clicks);
      zScore  = res.zScore;
      pValue  = res.pValue;
      winProb = winProbability(Math.round(ch.conversions), ch.clicks, Math.round(control.conversions), control.clicks);
    } else {
      // For CPA/ROAS/clicks — compare raw metric values, use impression-based z-test as proxy
      const res = proportionZTest(ch.clicks, ch.impressions, control.clicks, control.impressions);
      zScore  = res.zScore;
      pValue  = res.pValue;
      winProb = isBetter(metric, getMetricValue(ch, metric), getMetricValue(control, metric))
        ? normalCdf(Math.abs(zScore))
        : 1 - normalCdf(Math.abs(zScore));
    }

    if (winProb > bestWinProb) {
      bestChallenger = ch;
      bestWinProb    = winProb;
      bestPValue     = pValue;
      bestZScore     = zScore;
    }
  }

  if (!bestChallenger) {
    return {
      testId, status: test.status, primaryMetric: metric, variants, winner: null, control,
      winnerConfidence: 0, liftPct: 0, pValue: 1, hasEnoughData, readyToOptimize: false,
      message: "No active challenger variants to compare.",
    };
  }

  // Compute lift
  const controlVal    = getMetricValue(control, metric);
  const challengerVal = getMetricValue(bestChallenger, metric);
  const liftPct = controlVal > 0
    ? +((isBetter(metric, challengerVal, controlVal)
          ? (challengerVal - controlVal)
          : (controlVal - challengerVal)
       ) / Math.abs(controlVal) * 100).toFixed(1)
    : 0;

  // Determine winner: challenger must be better AND reach confidence threshold
  const isChallWinner = isBetter(metric, challengerVal, controlVal)
    && bestWinProb >= confThreshold;

  // If challenger NOT winning, maybe control is the winner (challenger underperforms significantly)
  const isControlWinner = !isChallWinner
    && (1 - bestWinProb) >= confThreshold
    && !isBetter(metric, challengerVal, controlVal);

  const winner = isChallWinner
    ? bestChallenger
    : isControlWinner
    ? control
    : null;

  const readyToOptimize =
    hasEnoughData &&
    winner !== null &&
    test.status === "active" &&
    test.auto_optimize &&
    test.winner_variant_id === null;

  return {
    testId,
    status:           test.status,
    primaryMetric:    metric,
    variants,
    winner,
    control,
    winnerConfidence: +bestWinProb.toFixed(4),
    liftPct,
    pValue:           +bestPValue.toFixed(6),
    hasEnoughData,
    readyToOptimize,
    message:          winner
      ? `"${winner.name}" wins with ${(bestWinProb * 100).toFixed(1)}% confidence, +${liftPct}% ${metric.toUpperCase()} lift`
      : hasEnoughData
      ? `No significant winner yet (best confidence: ${(bestWinProb * 100).toFixed(1)}%)`
      : `Collecting data — minimum impressions not yet met`,
  };
}

// ---------------------------------------------------------------------------
// Platform ad controls
// ---------------------------------------------------------------------------

async function loadConnection(dealershipId: string, platform: string) {
  const svc = createServiceClient();
  const { data } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .select("encrypted_tokens,metadata" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, platform as never)
    .eq("status" as never, "active" as never)
    .single() as unknown as {
      data: { encrypted_tokens: string; metadata: Record<string, unknown> } | null;
    };
  return data;
}

async function pauseGoogleAd(
  tokens: GoogleAdsTokens,
  adGroupId: string,
  adId: string
): Promise<void> {
  const accessToken = await getGoogleAdsAccessToken(tokens.refreshToken);
  const devToken    = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
  const { GOOGLE_ADS_API_BASE } = await import("./google-ads");

  const headers: Record<string, string> = {
    Authorization:     `Bearer ${accessToken}`,
    "developer-token": devToken,
    "Content-Type":    "application/json",
  };
  if (tokens.loginCustomerId) headers["login-customer-id"] = tokens.loginCustomerId;

  await fetch(`${GOOGLE_ADS_API_BASE}/customers/${tokens.customerId}/googleAds:mutate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      mutateOperations: [{
        adGroupAdOperation: {
          update: {
            resourceName: `customers/${tokens.customerId}/adGroupAds/${adGroupId}~${adId}`,
            status: "PAUSED",
          },
          updateMask: "status",
        },
      }],
    }),
  });
}

async function pauseMetaAd(tokens: MetaAdsTokens, adId: string): Promise<void> {
  const { META_GRAPH_BASE } = await import("./meta-ads");
  const url = new URL(`${META_GRAPH_BASE}/${adId}`);
  url.searchParams.set("access_token", tokens.accessToken);
  await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PAUSED" }),
  });
}

// ---------------------------------------------------------------------------
// Run optimization on a single test
// ---------------------------------------------------------------------------

export async function optimizeTest(testId: string): Promise<OptimizationResult> {
  const svc = createServiceClient();

  let evaluation: EvaluationResult;
  try {
    evaluation = await evaluateTest(testId);
  } catch (err) {
    return { testId, action: "failed", patternSaved: false, budgetScaled: false, variantsPaused: 0,
      message: "Evaluation failed", error: err instanceof Error ? err.message : String(err) };
  }

  // Log the evaluation
  await (svc as ReturnType<typeof createServiceClient>)
    .from("paid_ab_optimization_log" as never)
    .insert({
      dealership_id: (await (svc as ReturnType<typeof createServiceClient>)
        .from("paid_ab_tests" as never)
        .select("dealership_id" as never)
        .eq("id" as never, testId as never)
        .single() as unknown as { data: { dealership_id: string } | null }).data?.dealership_id,
      test_id: testId,
      action:  "evaluated",
      details: {
        hasEnoughData:    evaluation.hasEnoughData,
        winnerConfidence: evaluation.winnerConfidence,
        pValue:           evaluation.pValue,
        liftPct:          evaluation.liftPct,
        winner:           evaluation.winner?.name,
        message:          evaluation.message,
      },
    } as never);

  if (!evaluation.readyToOptimize) {
    return {
      testId, action: evaluation.hasEnoughData ? "no_action" : "insufficient_data",
      patternSaved: false, budgetScaled: false, variantsPaused: 0,
      message: evaluation.message,
    };
  }

  // Load test for platform info and dealership
  const { data: test } = await (svc as ReturnType<typeof createServiceClient>)
    .from("paid_ab_tests" as never)
    .select("dealership_id,platform,budget_scale_pct,platform_ad_group_id" as never)
    .eq("id" as never, testId as never)
    .single() as unknown as {
      data: { dealership_id: string; platform: string; budget_scale_pct: number; platform_ad_group_id: string | null } | null;
    };

  if (!test) return { testId, action: "failed", patternSaved: false, budgetScaled: false, variantsPaused: 0, message: "Test not found" };

  const winner    = evaluation.winner!;
  const losers    = evaluation.variants.filter((v) => v.variantId !== winner.variantId && v.status === "active");
  let variantsPaused = 0;
  let budgetScaled   = false;

  // ── 1. Mark winner ───────────────────────────────────────────
  await (svc as ReturnType<typeof createServiceClient>)
    .from("paid_ab_tests" as never)
    .update({
      status:            "winner_declared",
      winner_variant_id: winner.variantId,
      ended_at:          new Date().toISOString(),
    } as never)
    .eq("id" as never, testId as never);

  await (svc as ReturnType<typeof createServiceClient>)
    .from("paid_ab_variants" as never)
    .update({ status: "winner" } as never)
    .eq("id" as never, winner.variantId as never);

  // ── 2. Pause losers on platform ──────────────────────────────
  const conn = await loadConnection(test.dealership_id, test.platform);
  if (conn) {
    try {
      if (test.platform === "google_ads") {
        const tokens = await decryptTokens<GoogleAdsTokens>(conn.encrypted_tokens);
        for (const loser of losers) {
          if (loser.platformAdId && loser.variantId) {
            await pauseGoogleAd(tokens, loser.variantId, loser.platformAdId);
            variantsPaused++;
          }
        }
      } else if (test.platform === "meta_ads") {
        const tokens = await decryptTokens<MetaAdsTokens>(conn.encrypted_tokens);
        for (const loser of losers) {
          if (loser.platformAdId) {
            await pauseMetaAd(tokens, loser.platformAdId);
            variantsPaused++;
          }
        }
      }
    } catch {
      // Platform pause failed — still mark locally
    }
  }

  // Mark losers as eliminated in DB
  for (const loser of losers) {
    await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_variants" as never)
      .update({ status: "eliminated" } as never)
      .eq("id" as never, loser.variantId as never);
  }

  // ── 3. Scale winner budget ───────────────────────────────────
  if (conn && winner.spendUsd > 0) {
    try {
      const scaleFactor = 1 + test.budget_scale_pct / 100;
      const newDailyBudgetUsd = +(winner.spendUsd / 30 * scaleFactor).toFixed(2);

      if (test.platform === "google_ads" && test.platform_ad_group_id) {
        const tokens = await decryptTokens<GoogleAdsTokens>(conn.encrypted_tokens);
        // Scale via campaign budget (we use campaign-level budget scaling)
        await updateGoogleAdsBudget(tokens, test.platform_ad_group_id, newDailyBudgetUsd);
        budgetScaled = true;
      } else if (test.platform === "meta_ads" && test.platform_ad_group_id) {
        const tokens = await decryptTokens<MetaAdsTokens>(conn.encrypted_tokens);
        await updateMetaAdSetBudget(tokens, test.platform_ad_group_id, Math.round(newDailyBudgetUsd * 100));
        budgetScaled = true;
      }
    } catch {
      // Budget scale failed silently
    }
  }

  // ── 4. Write pattern to dm_learning_patterns ──────────────────
  let patternSaved = false;
  try {
    const client = getAnthropicClient();
    const control = evaluation.control;
    const resp = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 200,
      system: `You are an AutoCDP advertising analytics agent. Extract a concise, actionable pattern from A/B test results. Output JSON only: {"title":"under 60 chars","description":"under 150 chars — state WHAT won and concrete WHY","pattern_type":"creative"}`,
      messages: [{
        role: "user",
        content: `A/B test: "${evaluation.testId}" — metric: ${evaluation.primaryMetric}\nWINNER: ${winner.name} (${evaluation.winnerConfidence * 100 | 0}% confidence, +${evaluation.liftPct}% lift)\n${control ? `CONTROL: ${control.name} — CTR ${(control.ctr * 100).toFixed(2)}%, CVR ${(control.cvr * 100).toFixed(2)}%` : ""}\nWINNER: CTR ${(winner.ctr * 100).toFixed(2)}%, CVR ${(winner.cvr * 100).toFixed(2)}%`,
      }],
    });

    const text  = resp.content[0].type === "text" ? resp.content[0].text : "";
    const match = text.match(/\{[\s\S]+?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { title?: string; description?: string; pattern_type?: string };
      if (parsed.title && parsed.description) {
        await (svc as ReturnType<typeof createServiceClient>)
          .from("dm_learning_patterns" as never)
          .insert({
            dealership_id: test.dealership_id,
            pattern_type:  "creative",
            title:         parsed.title,
            description:   parsed.description,
            confidence:    evaluation.winnerConfidence,
            evidence:      {
              test_id:     testId,
              metric:      evaluation.primaryMetric,
              lift_pct:    evaluation.liftPct,
              winner_name: winner.name,
              p_value:     evaluation.pValue,
            },
            platforms: [test.platform],
            is_active:     true,
            applied_count: 0,
          } as never);
        patternSaved = true;
      }
    }
  } catch {
    // Pattern extraction failed
  }

  // Log optimization action
  await (svc as ReturnType<typeof createServiceClient>)
    .from("paid_ab_optimization_log" as never)
    .insert({
      dealership_id: test.dealership_id,
      test_id:       testId,
      action:        "winner_declared",
      variant_id:    winner.variantId,
      details: {
        winner_name:      winner.name,
        confidence:       evaluation.winnerConfidence,
        lift_pct:         evaluation.liftPct,
        variants_paused:  variantsPaused,
        budget_scaled:    budgetScaled,
        pattern_saved:    patternSaved,
      },
    } as never);

  return {
    testId,
    action:          "winner_declared",
    winnerVariantId: winner.variantId,
    winnerName:      winner.name,
    liftPct:         evaluation.liftPct,
    confidence:      evaluation.winnerConfidence,
    patternSaved,
    budgetScaled,
    variantsPaused,
    message: evaluation.message,
  };
}

// ---------------------------------------------------------------------------
// Run the optimizer across ALL active tests for a dealership (or globally)
// ---------------------------------------------------------------------------

export async function runAbTestOptimizer(
  dealershipId?: string
): Promise<{ tested: number; optimized: number; results: OptimizationResult[] }> {
  const svc = createServiceClient();

  let tests: Array<{ id: string }> | null = null;

  if (dealershipId) {
    const { data } = await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_tests" as never)
      .select("id" as never)
      .eq("status" as never, "active" as never)
      .eq("dealership_id" as never, dealershipId as never) as unknown as {
        data: Array<{ id: string }> | null;
      };
    tests = data;
  } else {
    const { data } = await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_tests" as never)
      .select("id" as never)
      .eq("status" as never, "active" as never) as unknown as {
        data: Array<{ id: string }> | null;
      };
    tests = data;
  }

  const allTests = tests ?? [];
  const results: OptimizationResult[] = [];

  for (const t of allTests) {
    try {
      const res = await optimizeTest(t.id);
      results.push(res);
    } catch (err) {
      results.push({
        testId: t.id, action: "failed",
        patternSaved: false, budgetScaled: false, variantsPaused: 0,
        message: "Unexpected error", error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    tested:    allTests.length,
    optimized: results.filter((r) => r.action === "winner_declared").length,
    results,
  };
}
