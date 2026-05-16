/**
 * AI Budget Allocator & Bid Optimizer — 3-Agent Swarm
 *
 * Architecture:
 *   Phase 1 — Data Agent (Haiku):
 *     Ingests 14-30d of raw ads_performance rows, computes per-channel
 *     ROAS / CPA / CTR trends, confidence intervals, and momentum scores.
 *     Returns a compact, token-efficient performance summary.
 *
 *   Phase 2 — Allocation Agent (Sonnet):
 *     Given the performance summary + budget_rules constraints, decides
 *     the optimal daily budget split across channels AND per-campaign
 *     within each channel. Outputs structured JSON recommendations.
 *
 *   Phase 3 — Orchestrator (Opus):
 *     Reviews the full allocation for risk, business logic, and edge
 *     cases. Applies guardrails (blackout windows, min/max caps). Writes
 *     the final approved allocation to budget_allocations. Pushes live
 *     budget updates to Google/Meta/TikTok APIs if auto_push is enabled.
 *
 * Push behavior:
 *   - Google Ads: updateGoogleAdsBudget() — campaign budget resource
 *   - Meta Ads: updateMetaAdSetBudget() — ad-set level daily budget
 *   - TikTok Ads: updateTikTokAdGroupBudget() — ad-group daily budget
 *
 * Guardrails:
 *   - Never exceeds monthly_cap_usd
 *   - Never sets any channel below channel_limits[ch].min
 *   - Never changes a budget by < min_change_pct (avoids API noise)
 *   - Does not push during blackout_windows
 *   - If a channel has < min_impressions_threshold, skips that channel
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";
import { decryptTokens } from "@/lib/dms/encrypt";
import {
  updateGoogleAdsBudget,
  getGoogleAdsAccessToken,
  type GoogleAdsTokens,
} from "./google-ads";
import {
  updateMetaAdSetBudget,
  type MetaAdsTokens,
} from "./meta-ads";
import {
  updateTikTokAdGroupBudget,
  type TikTokAdsTokens,
} from "./tiktok-ads";
import type { AdsPlatform } from "./ads-sync";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AllocationChannel = "google_ads" | "meta_ads" | "tiktok_ads";
export type OptimizationObjective = "roas" | "cpa" | "ctr" | "impressions" | "clicks";

export interface ChannelLimit {
  min: number;  // USD/day
  max: number;  // USD/day
}

export interface BudgetRules {
  monthly_cap_usd:          number | null;
  channel_limits:           Record<AllocationChannel, ChannelLimit>;
  min_change_pct:           number;   // 10.0 = 10%
  auto_push:                boolean;
  managed_channels:         AllocationChannel[];
  blackout_windows:         Array<{ start: string; end: string; tz: string }>;
  channel_objectives:       Record<AllocationChannel, OptimizationObjective>;
  min_impressions_threshold: number;
  lookback_days:            number;
}

export interface ChannelPerformance {
  channel:      AllocationChannel;
  impressions:  number;
  clicks:       number;
  conversions:  number;
  spendUsd:     number;
  roas:         number | null;
  cpa:          number | null;
  ctr:          number;
  trend7d:      number | null;   // % change vs prior 7d
  confidence:   number;          // 0–1: data sufficiency
  campaigns: Array<{
    campaignId:   string;
    campaignName: string;
    adGroupId:    string;
    spendUsd:     number;
    roas:         number | null;
    cpa:          number | null;
    impressions:  number;
    clicks:       number;
    conversions:  number;
    // budget resource ID needed to actually push the update
    budgetResourceId?: string;
  }>;
}

export interface CampaignAllocation {
  channel:          AllocationChannel;
  campaignId:       string;
  campaignName:     string;
  adGroupId:        string;
  currentUsd:       number;
  recommendedUsd:   number;
  predictedRoas:    number | null;
  confidence:       number;
  changeReason:     string;
  pushed:           boolean;
  pushError:        string | null;
}

export interface BudgetAllocationResult {
  allocationId:     string;
  allocationDate:   string;
  totalBudgetUsd:   number;
  allocations:      CampaignAllocation[];
  summary:          string;
  status:           string;
  pushed:           number;
  skipped:          number;
  errors:           number;
  swarmReasoning: {
    dataAgentSummary:  string;
    channelDecisions:  string;
    orchestratorNotes: string;
    riskFlags:         string[];
  };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Check if current UTC time is within any blackout window */
function isBlackout(windows: BudgetRules["blackout_windows"]): boolean {
  if (!windows.length) return false;
  const now = new Date();
  const nowHHMM = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  return windows.some((w) => nowHHMM >= w.start && nowHHMM <= w.end);
}

// ---------------------------------------------------------------------------
// Phase 1 — Load & analyze performance data
// ---------------------------------------------------------------------------

async function loadChannelPerformance(
  dealershipId: string,
  rules: BudgetRules
): Promise<ChannelPerformance[]> {
  const svc = createServiceClient();
  const since = daysAgoIso(rules.lookback_days);
  const since7 = daysAgoIso(7);
  const today  = todayIso();

  const { data: rows } = await (svc as ReturnType<typeof createServiceClient>)
    .from("ads_performance" as never)
    .select("platform,campaign_id,campaign_name,ad_group_id,date_start,impressions,clicks,conversions,spend_usd,roas" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .gte("date_start" as never, since as never)
    .lte("date_start" as never, today as never)
    .in("platform" as never, rules.managed_channels as never) as unknown as {
      data: Array<{
        platform:      AllocationChannel;
        campaign_id:   string;
        campaign_name: string;
        ad_group_id:   string;
        date_start:    string;
        impressions:   number;
        clicks:        number;
        conversions:   number;
        spend_usd:     number;
        roas:          number | null;
      }> | null;
    };

  if (!rows || rows.length === 0) return [];

  // Group by channel
  const channelMap = new Map<AllocationChannel, typeof rows>();
  for (const r of rows) {
    if (!channelMap.has(r.platform)) channelMap.set(r.platform, []);
    channelMap.get(r.platform)!.push(r);
  }

  const result: ChannelPerformance[] = [];

  for (const [channel, channelRows] of channelMap) {
    const all  = channelRows;
    const last7 = channelRows.filter((r) => r.date_start >= since7);
    const prior = channelRows.filter((r) => r.date_start < since7);

    const agg = (subset: typeof rows) => {
      let imp = 0, clk = 0, conv = 0, spend = 0, roasNum = 0, roasDen = 0;
      for (const r of subset) {
        imp   += Number(r.impressions);
        clk   += Number(r.clicks);
        conv  += Number(r.conversions);
        spend += Number(r.spend_usd);
        if (r.roas != null && Number(r.spend_usd) > 0) {
          roasNum += Number(r.roas) * Number(r.spend_usd);
          roasDen += Number(r.spend_usd);
        }
      }
      const roas = roasDen > 0 ? +(roasNum / roasDen).toFixed(4) : null;
      const cpa  = conv > 0 && spend > 0 ? +(spend / conv).toFixed(2) : null;
      return { imp, clk, conv, spend, roas, cpa };
    };

    const full   = agg(all);
    const recent = agg(last7);
    const older  = agg(prior);

    // 7d trend: % change in ROAS (or spend if no ROAS)
    const trend7d =
      older.roas && recent.roas
        ? +((recent.roas - older.roas) / older.roas * 100).toFixed(1)
        : older.spend > 0 && recent.spend > 0
        ? +((recent.spend - older.spend) / older.spend * 100).toFixed(1)
        : null;

    // Confidence: based on impression volume vs threshold
    const confidence = Math.min(1, full.imp / (rules.min_impressions_threshold * 3));

    // Per-campaign aggregation
    const campaignMap = new Map<string, {
      campaignId: string; campaignName: string; adGroupId: string;
      spend: number; imp: number; clk: number; conv: number;
      roasNum: number; roasDen: number;
    }>();

    for (const r of all) {
      const key = `${r.campaign_id}::${r.ad_group_id}`;
      if (!campaignMap.has(key)) {
        campaignMap.set(key, {
          campaignId: r.campaign_id, campaignName: r.campaign_name,
          adGroupId: r.ad_group_id,
          spend: 0, imp: 0, clk: 0, conv: 0, roasNum: 0, roasDen: 0,
        });
      }
      const c = campaignMap.get(key)!;
      c.spend   += Number(r.spend_usd);
      c.imp     += Number(r.impressions);
      c.clk     += Number(r.clicks);
      c.conv    += Number(r.conversions);
      if (r.roas != null && Number(r.spend_usd) > 0) {
        c.roasNum += Number(r.roas) * Number(r.spend_usd);
        c.roasDen += Number(r.spend_usd);
      }
    }

    result.push({
      channel,
      impressions: full.imp,
      clicks:      full.clk,
      conversions: full.conv,
      spendUsd:    +full.spend.toFixed(2),
      roas:        full.roas,
      cpa:         full.cpa,
      ctr:         full.imp > 0 ? +(full.clk / full.imp * 100).toFixed(3) : 0,
      trend7d,
      confidence,
      campaigns: [...campaignMap.values()].map((c) => ({
        campaignId:   c.campaignId,
        campaignName: c.campaignName,
        adGroupId:    c.adGroupId,
        spendUsd:     +c.spend.toFixed(2),
        roas:         c.roasDen > 0 ? +(c.roasNum / c.roasDen).toFixed(4) : null,
        cpa:          c.conv > 0 && c.spend > 0 ? +(c.spend / c.conv).toFixed(2) : null,
        impressions:  c.imp,
        clicks:       c.clk,
        conversions:  c.conv,
      })),
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Phase 1b — Data Agent (Haiku): compact performance narrative
// ---------------------------------------------------------------------------

async function runDataAgent(
  channelPerf: ChannelPerformance[],
  rules: BudgetRules,
  dealershipName: string
): Promise<string> {
  const client = getAnthropicClient();

  const perfTable = channelPerf.map((ch) => ({
    channel:      ch.channel,
    spend:        `$${ch.spendUsd}`,
    impressions:  ch.impressions.toLocaleString(),
    clicks:       ch.clicks.toLocaleString(),
    conversions:  ch.conversions,
    roas:         ch.roas ?? "n/a",
    cpa:          ch.cpa ? `$${ch.cpa}` : "n/a",
    ctr:          `${ch.ctr}%`,
    trend7d:      ch.trend7d != null ? `${ch.trend7d > 0 ? "+" : ""}${ch.trend7d}%` : "n/a",
    confidence:   `${(ch.confidence * 100).toFixed(0)}%`,
    topCampaigns: ch.campaigns
      .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))
      .slice(0, 3)
      .map((c) => `${c.campaignName} (ROAS: ${c.roas ?? "n/a"}, spend: $${c.spendUsd.toFixed(0)})`),
  }));

  const msg = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 800,
    system: `You are the Data Agent in an AI budget allocation swarm for ${dealershipName}.
Analyze the ad performance data and produce a concise summary (≤400 words) covering:
1. Which channel is performing best by the dealership's primary objective
2. ROAS/CPA momentum — which channels are improving vs declining
3. Which campaigns within each channel are pulling their weight
4. Data confidence issues (low impressions, missing conversions)
5. Key risk signal — any channel burning spend without ROI
Be direct and numeric. No fluff.`,
    messages: [{
      role: "user",
      content: `Performance data (${rules.lookback_days}-day window):\n${JSON.stringify(perfTable, null, 2)}\n\nChannel objectives: ${JSON.stringify(rules.channel_objectives)}`,
    }],
  });

  return msg.content[0].type === "text" ? msg.content[0].text : "Data analysis unavailable.";
}

// ---------------------------------------------------------------------------
// Phase 2 — Allocation Agent (Sonnet): compute recommended budgets
// ---------------------------------------------------------------------------

interface AllocationAgentOutput {
  totalBudgetUsd: number;
  channelSplit: Array<{
    channel:       AllocationChannel;
    dailyBudgetUsd: number;
    rationale:     string;
    campaigns: Array<{
      campaignId:     string;
      adGroupId:      string;
      dailyBudgetUsd: number;
      predictedRoas:  number | null;
      confidence:     number;
      changeReason:   string;
    }>;
  }>;
  orchestratorNotes: string;
  riskFlags: string[];
}

async function runAllocationAgent(
  channelPerf: ChannelPerformance[],
  dataAgentSummary: string,
  rules: BudgetRules,
  totalBudgetUsd: number,
  dealershipName: string
): Promise<AllocationAgentOutput> {
  const client = getAnthropicClient();

  // Compute current daily spend per channel (30d avg)
  const currentSpend: Record<string, number> = {};
  for (const ch of channelPerf) {
    currentSpend[ch.channel] = +(ch.spendUsd / rules.lookback_days).toFixed(2);
  }

  const systemPrompt = `You are the Allocation Agent in an AI budget optimization swarm for ${dealershipName}.

Your job: given performance data and hard constraints, decide the optimal daily budget split.

HARD CONSTRAINTS — you MUST respect these:
${Object.entries(rules.channel_limits).map(([ch, lim]) =>
  `  ${ch}: min $${lim.min}/day, max $${lim.max}/day`
).join("\n")}
Total daily budget: $${totalBudgetUsd} (do NOT exceed)
${rules.monthly_cap_usd ? `Monthly cap: $${rules.monthly_cap_usd}` : ""}
Minimum change to trigger a push: ${rules.min_change_pct}% (below this, keep current budget)
Managed channels: ${rules.managed_channels.join(", ")}

OPTIMIZATION OBJECTIVES:
${Object.entries(rules.channel_objectives).map(([ch, obj]) => `  ${ch}: optimize for ${obj}`).join("\n")}

ALLOCATION PRINCIPLES:
1. Channels with ROAS ≥ 3× and positive trend get budget increases
2. Channels with ROAS < 1.5× or negative 7d trend get budget decreases
3. If confidence < 40%, hold current budget (insufficient data to act)
4. Never starve a channel to $0 if it's in managed_channels — respect the min constraint
5. Within a channel, shift budget toward top-performing campaigns
6. If a campaign has 0 conversions and < 0.1% CTR after ${rules.min_impressions_threshold}+ impressions, recommend pausing (set dailyBudgetUsd = 0)

Return ONLY valid JSON — no markdown, no prose before or after:
{
  "totalBudgetUsd": <number>,
  "channelSplit": [
    {
      "channel": "google_ads",
      "dailyBudgetUsd": <number>,
      "rationale": "<1 sentence why>",
      "campaigns": [
        {
          "campaignId": "<id>",
          "adGroupId": "<id>",
          "dailyBudgetUsd": <number>,
          "predictedRoas": <number | null>,
          "confidence": <0-1>,
          "changeReason": "<1 sentence>"
        }
      ]
    }
  ],
  "orchestratorNotes": "<key concerns for Opus to review>",
  "riskFlags": ["<flag1>", "<flag2>"]
}`;

  const userContent = `DATA AGENT SUMMARY:\n${dataAgentSummary}\n\n` +
    `CURRENT DAILY SPEND BY CHANNEL:\n${JSON.stringify(currentSpend, null, 2)}\n\n` +
    `CHANNEL PERFORMANCE DETAIL:\n${JSON.stringify(
      channelPerf.map((ch) => ({
        channel: ch.channel,
        roas: ch.roas,
        cpa: ch.cpa,
        ctr: ch.ctr,
        trend7d: ch.trend7d,
        confidence: ch.confidence,
        campaigns: ch.campaigns.map((c) => ({
          campaignId: c.campaignId,
          campaignName: c.campaignName,
          adGroupId: c.adGroupId,
          currentDailySpend: +(c.spendUsd / rules.lookback_days).toFixed(2),
          roas: c.roas,
          cpa: c.cpa,
          impressions: c.impressions,
          clicks: c.clicks,
          conversions: c.conversions,
        })),
      })),
      null, 2
    )}`;

  const msg = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Allocation Agent did not return valid JSON");

  return JSON.parse(jsonMatch[0]) as AllocationAgentOutput;
}

// ---------------------------------------------------------------------------
// Phase 3 — Orchestrator (Opus): review, guardrails, final approval
// ---------------------------------------------------------------------------

async function runOrchestratorReview(
  allocationDraft: AllocationAgentOutput,
  channelPerf: ChannelPerformance[],
  rules: BudgetRules,
  dataAgentSummary: string,
  dealershipName: string
): Promise<{ approved: AllocationAgentOutput; narrative: string; riskFlags: string[] }> {
  const client = getAnthropicClient();

  const msg = await client.messages.create({
    model: MODELS.powerful,
    max_tokens: 1500,
    system: `You are the Orchestrator — the final reviewer in the AI Budget Allocation swarm for ${dealershipName}.

The Allocation Agent has produced a draft budget plan. Your job:
1. Verify all hard constraints are met (mins, maxes, total cap)
2. Identify any logical inconsistencies (e.g. increasing budget on a declining ROAS channel)
3. Check for risk concentration (e.g. >80% of budget on one channel)
4. Verify the total does not exceed the daily budget envelope
5. Either APPROVE the plan as-is, or ADJUST with specific corrections
6. Write a plain-English summary (3-5 sentences) that a dealer GM could read — what changed, why, and what to watch

Return ONLY valid JSON:
{
  "approved": <the full allocationDraft JSON, possibly with corrections>,
  "narrative": "<3-5 sentence plain-English summary for the GM>",
  "riskFlags": ["<any new flags you identified>"]
}`,
    messages: [{
      role: "user",
      content: `DATA CONTEXT:\n${dataAgentSummary}\n\nDRAFT ALLOCATION:\n${JSON.stringify(allocationDraft, null, 2)}\n\nCONSTRAINTS:\n${JSON.stringify({ rules }, null, 2)}`,
    }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      approved: allocationDraft,
      narrative: "Orchestrator review unavailable — using allocation agent output directly.",
      riskFlags: allocationDraft.riskFlags ?? [],
    };
  }

  const result = JSON.parse(jsonMatch[0]) as {
    approved: AllocationAgentOutput;
    narrative: string;
    riskFlags: string[];
  };

  return result;
}

// ---------------------------------------------------------------------------
// Phase 4 — Push budget updates to ad platforms
// ---------------------------------------------------------------------------

async function pushBudgetUpdates(
  dealershipId: string,
  allocations: AllocationAgentOutput["channelSplit"],
  channelPerf: ChannelPerformance[],
  rules: BudgetRules
): Promise<{ pushed: CampaignAllocation[]; errors: string[] }> {
  const svc = createServiceClient();

  // Load all active ad connections for this dealership
  const { data: connections } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .select("provider,encrypted_tokens,metadata" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("status" as never, "active" as never)
    .in("provider" as never, rules.managed_channels as never) as unknown as {
      data: Array<{
        provider:         AllocationChannel;
        encrypted_tokens: string;
        metadata:         Record<string, unknown>;
      }> | null;
    };

  const connByChannel = new Map<AllocationChannel, typeof connections>();
  for (const conn of connections ?? []) {
    connByChannel.set(conn.provider, [conn]);
  }

  // Build lookup: campaignId → current daily spend from perf data
  const campSpendLookup = new Map<string, number>();
  for (const ch of channelPerf) {
    for (const c of ch.campaigns) {
      campSpendLookup.set(`${ch.channel}::${c.campaignId}::${c.adGroupId}`,
        +(c.spendUsd / rules.lookback_days).toFixed(2));
    }
  }

  const pushed: CampaignAllocation[] = [];
  const errors: string[] = [];

  for (const channelAlloc of allocations) {
    const conns = connByChannel.get(channelAlloc.channel);
    if (!conns?.length) continue;

    const conn = conns[0];

    for (const camp of channelAlloc.campaigns) {
      const currentUsd = campSpendLookup.get(
        `${channelAlloc.channel}::${camp.campaignId}::${camp.adGroupId}`
      ) ?? 0;

      const changePct = currentUsd > 0
        ? Math.abs(camp.dailyBudgetUsd - currentUsd) / currentUsd * 100
        : 100;

      const allocation: CampaignAllocation = {
        channel:         channelAlloc.channel,
        campaignId:      camp.campaignId,
        campaignName:    channelPerf
          .find((ch) => ch.channel === channelAlloc.channel)
          ?.campaigns.find((c) => c.campaignId === camp.campaignId)
          ?.campaignName ?? camp.campaignId,
        adGroupId:       camp.adGroupId,
        currentUsd,
        recommendedUsd:  camp.dailyBudgetUsd,
        predictedRoas:   camp.predictedRoas,
        confidence:      camp.confidence,
        changeReason:    camp.changeReason,
        pushed:          false,
        pushError:       null,
      };

      // Skip if below min_change_pct threshold
      if (changePct < rules.min_change_pct && camp.dailyBudgetUsd !== 0) {
        allocation.changeReason += ` [skipped: change ${changePct.toFixed(1)}% < threshold ${rules.min_change_pct}%]`;
        pushed.push(allocation);
        continue;
      }

      if (!rules.auto_push) {
        pushed.push(allocation);
        continue;
      }

      try {
        const tokens = await decryptTokens<GoogleAdsTokens & MetaAdsTokens & TikTokAdsTokens>(
          conn.encrypted_tokens
        );

        switch (channelAlloc.channel) {
          case "google_ads": {
            // Google budget is at campaign-budget level; we need the budget resource ID
            // from metadata or fetch dynamically. Use a simplified direct approach.
            const accessToken = await getGoogleAdsAccessToken(
              (tokens as GoogleAdsTokens).refreshToken
            );
            const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
            const customerId = (tokens as GoogleAdsTokens).customerId;

            // Fetch the campaign's budget resource name
            const searchRes = await fetch(
              `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`,
              {
                method: "POST",
                headers: {
                  Authorization:     `Bearer ${accessToken}`,
                  "developer-token": devToken,
                  "Content-Type":    "application/json",
                  ...((tokens as GoogleAdsTokens).loginCustomerId
                    ? { "login-customer-id": (tokens as GoogleAdsTokens).loginCustomerId! }
                    : {}),
                },
                body: JSON.stringify({
                  query: `SELECT campaign.id, campaign_budget.id, campaign_budget.amount_micros FROM campaign WHERE campaign.id = '${camp.campaignId}'`,
                }),
              }
            );

            if (searchRes.ok) {
              const searchData = await searchRes.json() as {
                results?: Array<{ campaignBudget?: { id: string } }>;
              };
              const budgetId = searchData.results?.[0]?.campaignBudget?.id;
              if (budgetId) {
                await updateGoogleAdsBudget(
                  tokens as GoogleAdsTokens,
                  budgetId,
                  camp.dailyBudgetUsd
                );
                allocation.pushed = true;
              }
            }
            break;
          }

          case "meta_ads":
            await updateMetaAdSetBudget(
              tokens as MetaAdsTokens,
              camp.adGroupId,
              Math.round(camp.dailyBudgetUsd * 100) // Meta uses cents
            );
            allocation.pushed = true;
            break;

          case "tiktok_ads":
            await updateTikTokAdGroupBudget(
              tokens as TikTokAdsTokens,
              camp.adGroupId,
              camp.dailyBudgetUsd
            );
            allocation.pushed = true;
            break;
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        allocation.pushError = errMsg;
        errors.push(`${channelAlloc.channel}/${camp.campaignId}: ${errMsg.slice(0, 120)}`);
        console.error(`[budget-allocator] push error ${channelAlloc.channel}:`, errMsg);
      }

      pushed.push(allocation);
    }
  }

  return { pushed, errors };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runBudgetAllocator(
  dealershipId: string,
  totalBudgetUsd: number,
  dealershipName: string,
  overrideRules?: Partial<BudgetRules>
): Promise<BudgetAllocationResult> {
  const svc = createServiceClient();
  const today = todayIso();

  // Load budget rules from DB
  const { data: rulesRow } = await (svc as ReturnType<typeof createServiceClient>)
    .from("budget_rules" as never)
    .select("*" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .single() as unknown as { data: Record<string, unknown> | null };

  const rules: BudgetRules = {
    monthly_cap_usd:          (rulesRow?.monthly_cap_usd as number | null) ?? null,
    channel_limits:           (rulesRow?.channel_limits as Record<AllocationChannel, ChannelLimit>) ?? {
      google_ads: { min: 20, max: 1000 },
      meta_ads:   { min: 10, max: 500  },
      tiktok_ads: { min: 10, max: 300  },
    },
    min_change_pct:           (rulesRow?.min_change_pct as number) ?? 10,
    auto_push:                (rulesRow?.auto_push as boolean) ?? false,
    managed_channels:         (rulesRow?.managed_channels as AllocationChannel[]) ?? ["google_ads", "meta_ads"],
    blackout_windows:         (rulesRow?.blackout_windows as BudgetRules["blackout_windows"]) ?? [],
    channel_objectives:       (rulesRow?.channel_objectives as Record<AllocationChannel, OptimizationObjective>) ?? {} as Record<AllocationChannel, OptimizationObjective>,
    min_impressions_threshold: (rulesRow?.min_impressions_threshold as number) ?? 500,
    lookback_days:             (rulesRow?.lookback_days as number) ?? 14,
    ...overrideRules,
  };

  // Default objective fallback
  for (const ch of rules.managed_channels) {
    if (!rules.channel_objectives[ch]) {
      rules.channel_objectives[ch] = "roas";
    }
  }

  // Check blackout
  if (isBlackout(rules.blackout_windows)) {
    throw new Error("Budget allocation skipped — currently in a blackout window");
  }

  // Upsert allocation record as "computing"
  const { data: allocationRow } = await (svc as ReturnType<typeof createServiceClient>)
    .from("budget_allocations" as never)
    .upsert({
      dealership_id:   dealershipId,
      allocation_date: today,
      total_budget_usd: totalBudgetUsd,
      status:          "computing",
    } as never, { onConflict: "dealership_id,allocation_date" })
    .select("id" as never)
    .single() as unknown as { data: { id: string } | null };

  const allocationId = allocationRow?.id ?? "unknown";

  try {
    // ── Phase 1: Load performance data ─────────────────────────────────────
    const channelPerf = await loadChannelPerformance(dealershipId, rules);

    // ── Phase 1b: Data Agent analysis ──────────────────────────────────────
    const dataAgentSummary = channelPerf.length > 0
      ? await runDataAgent(channelPerf, rules, dealershipName)
      : "No performance data available. Recommend holding current budget distribution.";

    // ── Phase 2: Allocation Agent ───────────────────────────────────────────
    const allocationDraft = await runAllocationAgent(
      channelPerf,
      dataAgentSummary,
      rules,
      totalBudgetUsd,
      dealershipName
    );

    // ── Phase 3: Orchestrator review ───────────────────────────────────────
    const { approved, narrative, riskFlags } = await runOrchestratorReview(
      allocationDraft,
      channelPerf,
      rules,
      dataAgentSummary,
      dealershipName
    );

    // ── Phase 4: Push budget updates ────────────────────────────────────────
    await (svc as ReturnType<typeof createServiceClient>)
      .from("budget_allocations" as never)
      .update({ status: "pushing" } as never)
      .eq("id" as never, allocationId as never);

    const { pushed: campaigns, errors } = await pushBudgetUpdates(
      dealershipId,
      approved.channelSplit,
      channelPerf,
      rules
    );

    const pushedCount = campaigns.filter((c) => c.pushed).length;
    const skippedCount = campaigns.filter((c) => !c.pushed && !c.pushError).length;
    const errorCount   = campaigns.filter((c) => c.pushError).length;

    // ── Persist final allocation ─────────────────────────────────────────────
    const swarmReasoning = {
      dataAgentSummary,
      channelDecisions: JSON.stringify(approved.channelSplit.map((ch) => ({
        channel: ch.channel,
        daily: ch.dailyBudgetUsd,
        rationale: ch.rationale,
      }))),
      orchestratorNotes: approved.orchestratorNotes ?? "",
      riskFlags: [...(approved.riskFlags ?? []), ...(riskFlags ?? [])],
    };

    await (svc as ReturnType<typeof createServiceClient>)
      .from("budget_allocations" as never)
      .update({
        allocations:     campaigns as never,
        swarm_reasoning: swarmReasoning as never,
        summary:         narrative,
        status:          errors.length === campaigns.length && campaigns.length > 0 ? "failed" : "applied",
        pushed_at:       rules.auto_push ? new Date().toISOString() : null,
        push_errors:     errors as never,
      } as never)
      .eq("id" as never, allocationId as never);

    return {
      allocationId,
      allocationDate: today,
      totalBudgetUsd,
      allocations: campaigns,
      summary: narrative,
      status: "applied",
      pushed:  pushedCount,
      skipped: skippedCount,
      errors:  errorCount,
      swarmReasoning,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await (svc as ReturnType<typeof createServiceClient>)
      .from("budget_allocations" as never)
      .update({
        status: "failed",
        push_errors: [errMsg] as never,
      } as never)
      .eq("id" as never, allocationId as never);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Attribution: fill in actual ROAS the next day
// ---------------------------------------------------------------------------

export async function runBudgetAttribution(dealershipId: string): Promise<void> {
  const svc = createServiceClient();
  const yesterday = daysAgoIso(1);

  const { data: allocation } = await (svc as ReturnType<typeof createServiceClient>)
    .from("budget_allocations" as never)
    .select("id,allocations,total_budget_usd" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("allocation_date" as never, yesterday as never)
    .is("attribution_date" as never, null as never)
    .single() as unknown as { data: { id: string; allocations: CampaignAllocation[]; total_budget_usd: number } | null };

  if (!allocation) return;

  // Pull actual performance for yesterday
  const { data: perf } = await (svc as ReturnType<typeof createServiceClient>)
    .from("ads_performance" as never)
    .select("spend_usd,roas" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("date_start" as never, yesterday as never) as unknown as {
      data: Array<{ spend_usd: number; roas: number | null }> | null;
    };

  if (!perf || perf.length === 0) return;

  const actualSpend = perf.reduce((s, r) => s + Number(r.spend_usd), 0);
  const roasNumerator = perf.reduce((s, r) =>
    r.roas != null ? s + Number(r.roas) * Number(r.spend_usd) : s, 0);
  const actualRoas = actualSpend > 0 ? +(roasNumerator / actualSpend).toFixed(4) : null;

  // Compare to predicted ROAS (average of pushed campaigns)
  const pushed = (allocation.allocations ?? []).filter((a) => a.pushed && a.predictedRoas);
  const predictedRoasAvg = pushed.length > 0
    ? +(pushed.reduce((s, a) => s + (a.predictedRoas ?? 0), 0) / pushed.length).toFixed(4)
    : null;

  const predictionErrorPct = actualRoas && predictedRoasAvg
    ? +((actualRoas - predictedRoasAvg) / predictedRoasAvg * 100).toFixed(2)
    : null;

  await (svc as ReturnType<typeof createServiceClient>)
    .from("budget_allocations" as never)
    .update({
      attribution_date:      todayIso() as never,
      actual_spend_usd:      actualSpend as never,
      actual_roas:           actualRoas as never,
      prediction_error_pct:  predictionErrorPct as never,
    } as never)
    .eq("id" as never, allocation.id as never);
}
