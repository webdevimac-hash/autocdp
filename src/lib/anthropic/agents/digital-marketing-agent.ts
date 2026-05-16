/**
 * Digital Marketing Agent — Agent #6 in the AutoCDP Swarm
 *
 * Operates as a full-service, AI-powered digital marketing agency for auto dealerships.
 * Owns Google Ads, Meta Ads, and TikTok Ads while collaborating with the existing
 * 5-agent owned-channel swarm (mail, SMS, email).
 *
 * Core loop:
 *   1. ANALYZE  — Pull all cross-channel performance (paid + owned), CRM events, inventory
 *   2. STRATEGIZE — Generate/update the dealership's Digital Marketing Playbook
 *   3. RECOMMEND — Surface specific, justified spend recommendations with predicted ROI
 *   4. EXECUTE   — Push AI-generated creatives (with dealer approval for spend)
 *   5. LEARN     — Distill closed-loop learnings back into the playbook
 *
 * The agent gets demonstrably smarter every cycle: every push teaches it what works.
 */

import { getAnthropicClient, MODELS } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  PUSH_DIGITAL_AD_TOOL_DEFINITION,
  executePushDigitalAdTool,
  type PushDigitalAdInput,
} from "../tools/push-digital-ad";
import {
  UPDATE_PLAYBOOK_TOOL_DEFINITION,
  executeUpdatePlaybookTool,
  type UpdatePlaybookInput,
} from "../tools/update-playbook";
import { loadDealershipMemories, formatMemoriesForPrompt } from "@/lib/memories";
import { loadDealershipInsights, formatInsightsForPrompt } from "@/lib/insights";
import type { AgentContext } from "@/types";

// ── Types ─────────────────────────────────────────────────────

export interface DigitalMarketingAgentInput {
  context:        AgentContext;
  mode:           "analyze" | "execute" | "full_cycle";
  /**
   * Channels the agent may use. Defaults to all connected platforms.
   * Constrain this to limit a run to a subset.
   */
  enabledPlatforms?: Array<"google_ads" | "meta_ads" | "tiktok_ads">;
  /**
   * When true, agent may push ads (requires an active dm_approvals row or
   * explicit dealer approval embedded in context).
   * When false, agent only analyzes and recommends.
   */
  allowExecute?:  boolean;
  /**
   * Approved dm_approvals IDs the agent may act on.
   * If empty and allowExecute is true, agent will request new approvals.
   */
  approvedActionIds?: string[];
  /** Free-form goal override from the dealer (e.g. "Move remaining F-150s this month"). */
  dealerGoal?:    string;
  /** Lookback window for performance analysis (days). Default: 30. */
  lookbackDays?:  number;
}

export interface DigitalMarketingAgentOutput {
  agentRunId:         string;
  mode:               string;
  playbookUpdated:    boolean;
  playbookVersion?:   number;
  adsCreated:         number;
  adsSkipped:         number;
  approvalsRequested: number;
  patternsLearned:    number;
  recommendations:    StrategicRecommendation[];
  performanceSummary: string;
  executiveBrief:     string;
  tokensUsed:         number;
  durationMs:         number;
  status:             "completed" | "partial" | "failed";
  error?:             string;
}

export interface StrategicRecommendation {
  priority:       "critical" | "high" | "medium" | "low";
  platform:       string;
  title:          string;
  rationale:      string;
  estimatedSpend: number | null;
  predictedROI:   string | null;
  requiresApproval: boolean;
  approvalId?:    string;
}

// ── System prompt ─────────────────────────────────────────────

function buildSystemPrompt(params: {
  dealershipName:  string;
  connectedPlatforms: string[];
  currentPlaybook: string;
  ownedChannelStats: string;
  paidChannelStats:  string;
  inventoryContext:  string;
  memoryContext:     string;
  insightsContext:   string;
  learningPatterns:  string;
  allowExecute:      boolean;
  dealerGoal?:       string;
}): string {
  return `You are AutoCDP's Digital Marketing Agent (#6) — a senior-level paid media strategist and execution engine.

You operate at the level of a top-tier digital marketing agency. You:
- Think in full-funnel strategy, not just ad placements
- Make data-driven decisions grounded in real campaign performance
- Learn from every touchpoint across ALL channels (mail, SMS, email, paid ads, CRM events)
- Proactively surface opportunities the dealer wouldn't have seen themselves
- Act with financial discipline — you never recommend spend without a clear ROI rationale

═══════════════════════════════════════════════
DEALERSHIP: ${params.dealershipName}
CONNECTED AD PLATFORMS: ${params.connectedPlatforms.join(", ") || "None (recommend connecting)"}
EXECUTION MODE: ${params.allowExecute ? "ACTIVE — may push ads to connected platforms" : "ANALYSIS ONLY — surface recommendations, do not push ads"}
${params.dealerGoal ? `DEALER GOAL THIS CYCLE: "${params.dealerGoal}"` : ""}
═══════════════════════════════════════════════

CURRENT DIGITAL MARKETING PLAYBOOK
${params.currentPlaybook || "No playbook yet — you will create the first version after analyzing available data."}

OWN-CHANNEL PERFORMANCE (last 30 days)
${params.ownedChannelStats || "No owned channel data available."}

PAID CHANNEL PERFORMANCE (last 30 days)
${params.paidChannelStats || "No paid ad data yet — this dealership has not run paid digital campaigns."}

DEALERSHIP INSIGHTS
${params.insightsContext || "No insights computed yet."}

INVENTORY CONTEXT
${params.inventoryContext || "No inventory data."}

DEALER MEMORIES & PREFERENCES
${params.memoryContext || "No memories stored."}

LEARNED PATTERNS (network-wide + dealership-specific)
${params.learningPatterns || "No patterns yet — will be generated after this analysis cycle."}

═══════════════════════════════════════════════
YOUR AGENCY-LEVEL RESPONSIBILITIES
═══════════════════════════════════════════════

1. STRATEGIC ANALYSIS
   - Identify the strongest ROI opportunities across all paid channels
   - Find audience segments underserved by current campaigns
   - Detect creative fatigue (declining CTR on same ad over time)
   - Spot seasonal or inventory-driven moments to capitalize on
   - Surface conquest opportunities (lapsed customers, competitor conquest)

2. FULL-FUNNEL THINKING
   - TOP: TikTok video, Meta Reach/Awareness, YouTube (via Google PMax) → brand awareness in-market
   - MID: Meta Consideration, Google Search (intent-based), TikTok In-Feed → capture consideration
   - BOTTOM: Google Search (brand + competitor), Meta Retargeting, Dynamic Ads → conversion
   - RETENTION: Retargeting existing customers, service reminder ads, upsell campaigns

3. CREATIVE STRATEGY
   - Google Search: 3–15 headlines (each ≤30 chars), 2–4 descriptions (≤90 chars), RSA format
   - Meta: Eye-catching image/video with ≤125 char primary text, ≤40 char headline
   - TikTok: Short-form video-first, hook in first 3 seconds, authentic/relatable tone
   - Always write from the perspective of what the CUSTOMER cares about, not what the dealer sells
   - Use inventory-specific offers when aged vehicles need to move fast

4. BUDGET OPTIMIZATION
   - Recommend specific budget splits based on performance data
   - Identify underperforming spend to reallocate
   - Flag campaigns with ROAS below 2.0x for review or pause
   - Suggest dayparting, geographic targeting, and audience exclusions

5. CLOSED-LOOP LEARNING
   - After each push cycle, measure what worked vs. what didn't
   - Extract patterns about which audiences, creatives, and offers performed
   - Update the Digital Marketing Playbook with new learnings
   - Build the playbook's offer library with proven CTAs

═══════════════════════════════════════════════
TOOL USAGE GUIDELINES
═══════════════════════════════════════════════

push_digital_ad:
- Only call when allowExecute is true AND you have a specific approved action
- Always include a clear rationale in the rationale field
- Prefer creative variations that TEST new angles vs. just repeating proven formats
- Every ad starts PAUSED — dealer enables them manually in the platform

update_playbook:
- Call ONCE per run to consolidate all learnings
- Include budget_allocation, top_audiences, creative_principles, offer_library
- Assign realistic confidence scores (0.0–1.0) to patterns
- Only mark patterns as high-confidence (>0.75) when backed by 3+ data points

SPEND DISCIPLINE:
- Never recommend a single campaign >$500/day without flagging it as requiring explicit approval
- Always estimate ROI range (conservative / optimistic) for recommended spend
- When a platform is not connected, recommend connecting it with a specific use case

COMPETITIVE INTELLIGENCE:
- If you see a make/model dominating inventory (e.g. "lots of F-150s"), recommend conquest campaigns targeting competitive shoppers
- Timing: Q1 = tax season (finance offers work), Q2 = spring (new models, trade-in equity), Q3 = back to school, Q4 = year-end clearance

NEVER:
- Push ads to a platform that is not connected (check connectedPlatforms list)
- Recommend spend without a clear, specific audience and objective
- Create duplicate ads for the same audience/objective already running
- Ignore owned channel performance — it informs where paid spend should focus`;
}

// ── Data loading helpers ──────────────────────────────────────

async function loadPaidChannelStats(
  dealershipId: string,
  lookbackDays: number
): Promise<string> {
  const svc = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: rows } = await svc
    .from("ads_performance" as never)
    .select("platform,campaign_name,impressions,clicks,conversions,spend_usd,roas,date_start" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .gte("date_start" as never, sinceStr as never)
    .order("spend_usd" as never, { ascending: false })
    .limit(200) as unknown as {
      data: Array<{
        platform: string;
        campaign_name: string;
        impressions: number;
        clicks: number;
        conversions: number;
        spend_usd: number;
        roas: number | null;
        date_start: string;
      }> | null;
    };

  if (!rows?.length) return "No paid ad data in this window.";

  // Aggregate by platform
  const byPlatform = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number; revenue: number; campaigns: Set<string> }>();

  for (const r of rows) {
    const p = byPlatform.get(r.platform) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, campaigns: new Set() };
    p.spend       += Number(r.spend_usd);
    p.impressions += r.impressions;
    p.clicks      += r.clicks;
    p.conversions += Number(r.conversions);
    p.revenue     += r.roas != null ? Number(r.roas) * Number(r.spend_usd) : 0;
    p.campaigns.add(r.campaign_name ?? "");
    byPlatform.set(r.platform, p);
  }

  const lines: string[] = [`Paid performance over last ${lookbackDays}d:`];
  for (const [platform, stats] of byPlatform) {
    const ctr  = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : "0";
    const roas = stats.spend > 0 ? (stats.revenue / stats.spend).toFixed(2) : "N/A";
    const cpc  = stats.clicks > 0 ? (stats.spend / stats.clicks).toFixed(2) : "N/A";
    lines.push(
      `  ${platform}: $${stats.spend.toFixed(0)} spend · ${stats.impressions.toLocaleString()} impr · ` +
      `${stats.clicks.toLocaleString()} clicks (${ctr}% CTR) · ${stats.conversions} conv · ` +
      `ROAS ${roas}x · CPC $${cpc} · ${stats.campaigns.size} active campaigns`
    );
  }

  // Top campaigns by spend
  const topCampaigns = rows.slice(0, 8);
  lines.push("\nTop campaigns (by spend):");
  for (const r of topCampaigns) {
    lines.push(
      `  [${r.platform}] ${r.campaign_name ?? "Unnamed"}: ` +
      `$${Number(r.spend_usd).toFixed(0)} · ${r.impressions.toLocaleString()} impr · ` +
      `ROAS ${r.roas?.toFixed(2) ?? "N/A"}x`
    );
  }

  return lines.join("\n");
}

async function loadOwnedChannelStats(
  dealershipId: string,
  lookbackDays: number
): Promise<string> {
  const svc = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  const sinceStr = since.toISOString();

  const [mailRes, auditRes] = await Promise.all([
    svc
      .from("mail_pieces" as never)
      .select("status,scanned_at,template_type" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .gte("created_at" as never, sinceStr as never) as unknown as Promise<{
        data: Array<{ status: string; scanned_at: string | null; template_type: string }> | null
      }>,
    svc
      .from("audit_log" as never)
      .select("action,created_at,metadata" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .in("action" as never, ["email.sent", "sms.sent", "email.opened", "link.clicked"] as never)
      .gte("created_at" as never, sinceStr as never)
      .limit(500) as unknown as Promise<{
        data: Array<{ action: string; created_at: string; metadata: Record<string, unknown> }> | null
      }>,
  ]);

  const lines: string[] = [`Owned channel performance over last ${lookbackDays}d:`];

  // Mail
  const mailPieces = mailRes.data ?? [];
  const sent       = mailPieces.length;
  const scanned    = mailPieces.filter((m) => m.scanned_at).length;
  const scanRate   = sent > 0 ? ((scanned / sent) * 100).toFixed(1) : "0";
  lines.push(`  Direct Mail: ${sent} sent · ${scanned} QR scans (${scanRate}% scan rate)`);

  // Email/SMS from audit
  const auditRows = auditRes.data ?? [];
  const emailSent = auditRows.filter((a) => a.action === "email.sent").length;
  const emailOpen = auditRows.filter((a) => a.action === "email.opened").length;
  const smsSent   = auditRows.filter((a) => a.action === "sms.sent").length;
  const linkClick = auditRows.filter((a) => a.action === "link.clicked").length;
  const openRate  = emailSent > 0 ? ((emailOpen / emailSent) * 100).toFixed(1) : "0";
  lines.push(`  Email: ${emailSent} sent · ${emailOpen} opens (${openRate}% open rate) · ${linkClick} link clicks`);
  lines.push(`  SMS: ${smsSent} sent`);

  return lines.join("\n");
}

async function loadCurrentPlaybook(dealershipId: string): Promise<string> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("dm_playbook" as never)
    .select("content,version,updated_at" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("is_current" as never, true as never)
    .maybeSingle() as unknown as {
      data: { content: Record<string, unknown>; version: number; updated_at: string } | null
    };

  if (!data) return "";

  const c = data.content as Record<string, unknown>;
  const lines: string[] = [`[Playbook v${data.version}, updated ${data.updated_at.slice(0,10)}]`];

  if (c.executive_summary) lines.push(`Summary: ${c.executive_summary}`);

  const ba = c.budget_allocation as Record<string, number> | undefined;
  if (ba) {
    lines.push(`Budget split: Google ${ba.google_ads ?? 0}% · Meta ${ba.meta_ads ?? 0}% · TikTok ${ba.tiktok_ads ?? 0}% · Owned ${ba.owned ?? 0}%`);
  }

  const principles = c.creative_principles as Array<{ principle: string; evidence_count: number }> | undefined;
  if (principles?.length) {
    lines.push("Top creative principles:");
    principles.slice(0, 3).forEach((p) => lines.push(`  - ${p.principle} (${p.evidence_count} data points)`));
  }

  const offers = c.offer_library as Array<{ offer_text: string; conversions: number }> | undefined;
  if (offers?.length) {
    lines.push("Best performing offers:");
    offers.slice(0, 3).forEach((o) => lines.push(`  - "${o.offer_text}" (${o.conversions} conversions)`));
  }

  return lines.join("\n");
}

async function loadLearningPatterns(dealershipId: string): Promise<string> {
  const svc = createServiceClient();

  const [globalRes, dealerRes] = await Promise.all([
    svc
      .from("dm_learning_patterns" as never)
      .select("pattern_type,title,description,confidence,platforms" as never)
      .is("dealership_id" as never, null as never)
      .eq("is_active" as never, true as never)
      .order("confidence" as never, { ascending: false })
      .limit(10) as unknown as Promise<{ data: Array<{ pattern_type: string; title: string; description: string; confidence: number; platforms: string[] }> | null }>,
    svc
      .from("dm_learning_patterns" as never)
      .select("pattern_type,title,description,confidence,platforms" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("is_active" as never, true as never)
      .order("confidence" as never, { ascending: false })
      .limit(15) as unknown as Promise<{ data: Array<{ pattern_type: string; title: string; description: string; confidence: number; platforms: string[] }> | null }>,
  ]);

  const lines: string[] = [];

  if (dealerRes.data?.length) {
    lines.push("Dealership-specific patterns:");
    dealerRes.data.forEach((p) =>
      lines.push(`  [${p.pattern_type}] ${p.title} (conf: ${(p.confidence * 100).toFixed(0)}%) — ${p.description}`)
    );
  }

  if (globalRes.data?.length) {
    lines.push("Global network patterns:");
    globalRes.data.slice(0, 5).forEach((p) =>
      lines.push(`  [${p.pattern_type}] ${p.title} — ${p.description}`)
    );
  }

  return lines.join("\n") || "No patterns yet.";
}

async function loadInventoryContext(dealershipId: string): Promise<string> {
  const svc = createServiceClient();
  const { data: inv } = await svc
    .from("inventory" as never)
    .select("year,make,model,condition,price,days_on_lot,status" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("status" as never, "available" as never)
    .order("days_on_lot" as never, { ascending: false })
    .limit(50) as unknown as {
      data: Array<{ year: number; make: string; model: string; condition: string; price: number; days_on_lot: number }> | null
    };

  if (!inv?.length) return "No inventory data.";

  const aged  = inv.filter((v) => v.days_on_lot >= 60);
  const fresh = inv.filter((v) => v.days_on_lot < 30);

  const lines: string[] = [
    `Total available: ${inv.length} vehicles`,
    `Aged (60+ days): ${aged.length} units — PRIORITY for paid ads`,
    `Fresh (<30 days): ${fresh.length} units`,
  ];

  if (aged.length) {
    lines.push("Top aged vehicles (paid ad candidates):");
    aged.slice(0, 6).forEach((v) =>
      lines.push(`  ${v.year} ${v.make} ${v.model} — ${v.days_on_lot}d on lot · $${Number(v.price).toLocaleString()}`)
    );
  }

  // Make distribution
  const makeCounts = new Map<string, number>();
  inv.forEach((v) => makeCounts.set(v.make, (makeCounts.get(v.make) ?? 0) + 1));
  const topMakes = [...makeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  lines.push(`Top makes in inventory: ${topMakes.map(([m, c]) => `${m} (${c})`).join(", ")}`);

  return lines.join("\n");
}

async function loadConnectedPlatforms(dealershipId: string): Promise<string[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("dms_connections" as never)
    .select("provider" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("status" as never, "active" as never)
    .in("provider" as never, ["google_ads", "meta_ads", "tiktok_ads"] as never) as unknown as {
      data: Array<{ provider: string }> | null
    };

  return (data ?? []).map((c) => c.provider);
}

async function loadPendingApprovals(dealershipId: string, approvedIds: string[]): Promise<string> {
  if (!approvedIds.length) return "No pre-approved actions for this run.";

  const svc = createServiceClient();
  const { data } = await svc
    .from("dm_approvals" as never)
    .select("id,approval_type,title,description,recommended_spend_usd,payload" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("status" as never, "approved" as never)
    .in("id" as never, approvedIds as never) as unknown as {
      data: Array<{ id: string; approval_type: string; title: string; description: string; recommended_spend_usd: number; payload: Record<string, unknown> }> | null
    };

  if (!data?.length) return "No valid approvals found for provided IDs.";

  return "Pre-approved actions dealer has authorized:\n" +
    data.map((a) =>
      `  [${a.id}] ${a.title} — $${a.recommended_spend_usd}/day approved\n    ${a.description}`
    ).join("\n");
}

// ── Request approval helper ───────────────────────────────────

async function createApprovalRequest(
  dealershipId: string,
  rec: StrategicRecommendation,
  payload: Record<string, unknown>
): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("dm_approvals" as never)
    .insert({
      dealership_id:         dealershipId,
      approval_type:         "campaign_launch",
      title:                 rec.title,
      description:           rec.rationale,
      recommended_spend_usd: rec.estimatedSpend,
      predicted_roi:         rec.predictedROI,
      agent_reasoning:       rec.rationale,
      payload,
      status:                "pending",
    } as never)
    .select("id" as never)
    .single() as unknown as { data: { id: string } | null };

  return data?.id ?? null;
}

// ── Main agent function ───────────────────────────────────────

export async function runDigitalMarketingAgent(
  input: DigitalMarketingAgentInput
): Promise<DigitalMarketingAgentOutput> {
  const svc      = createServiceClient();
  const client   = getAnthropicClient();
  const startedAt = Date.now();
  let totalTokens = 0;
  let playbookUpdated   = false;
  let playbookVersion: number | undefined;
  let adsCreated        = 0;
  let adsSkipped        = 0;
  let approvalsRequested = 0;
  let patternsLearned   = 0;
  const recommendations: StrategicRecommendation[] = [];

  const { data: runRecord } = await svc
    .from("agent_runs" as never)
    .insert({
      dealership_id: input.context.dealershipId,
      campaign_id:   input.context.campaignId ?? null,
      agent_type:    "digital_marketing",
      status:        "running",
      input_summary: `Mode: ${input.mode} | Goal: ${input.dealerGoal ?? "auto"} | Execute: ${input.allowExecute ?? false}`,
    } as never)
    .select("id" as never)
    .single() as unknown as { data: { id: string } | null };

  const finishRun = async (
    status: "completed" | "failed",
    summary: string,
    errMsg?: string
  ) => {
    if (!runRecord) return;
    await svc
      .from("agent_runs" as never)
      .update({
        status,
        output_summary: summary,
        error:          errMsg ?? null,
        duration_ms:    Date.now() - startedAt,
        completed_at:   new Date().toISOString(),
      } as never)
      .eq("id" as never, runRecord.id as never);
  };

  try {
    const lookback = input.lookbackDays ?? 30;
    const allowExecute = input.allowExecute ?? false;

    // ── 1. Load all context in parallel ──────────────────────
    const [
      connectedPlatforms,
      currentPlaybook,
      ownedChannelStats,
      paidChannelStats,
      inventoryContext,
      memories,
      insightsRaw,
      learningPatterns,
      approvalsContext,
    ] = await Promise.all([
      loadConnectedPlatforms(input.context.dealershipId),
      loadCurrentPlaybook(input.context.dealershipId),
      loadOwnedChannelStats(input.context.dealershipId, lookback),
      loadPaidChannelStats(input.context.dealershipId, lookback),
      loadInventoryContext(input.context.dealershipId),
      loadDealershipMemories(input.context.dealershipId),
      loadDealershipInsights(input.context.dealershipId),
      loadLearningPatterns(input.context.dealershipId),
      loadPendingApprovals(input.context.dealershipId, input.approvedActionIds ?? []),
    ]);

    const memoryContext   = formatMemoriesForPrompt(memories);
    const insightsContext = formatInsightsForPrompt(insightsRaw);

    const effectivePlatforms = input.enabledPlatforms
      ? connectedPlatforms.filter((p) => input.enabledPlatforms!.includes(p as "google_ads" | "meta_ads" | "tiktok_ads"))
      : connectedPlatforms;

    const systemPrompt = buildSystemPrompt({
      dealershipName:     input.context.dealershipName,
      connectedPlatforms: effectivePlatforms,
      currentPlaybook,
      ownedChannelStats,
      paidChannelStats,
      inventoryContext,
      memoryContext,
      insightsContext,
      learningPatterns,
      allowExecute,
      dealerGoal: input.dealerGoal,
    });

    // ── 2. Run agent with tool loop ───────────────────────────
    const userMessage = `
Run a complete ${input.mode === "analyze" ? "analysis" : input.mode === "execute" ? "execution" : "full analysis + execution"} cycle for ${input.context.dealershipName}.

${input.dealerGoal ? `Dealer's stated goal this cycle: "${input.dealerGoal}"` : "No specific dealer goal — use your strategic judgment based on the data."}

Pre-approved actions available: ${approvalsContext}

${allowExecute
  ? `You MAY push ads this cycle for approved actions. For NEW recommendations that require spend, create an approval request entry in your output (do not push without approval).`
  : `This is an ANALYSIS-ONLY run. Provide detailed recommendations but do not call push_digital_ad.`
}

Your output should cover:
1. Performance analysis — what's working, what's not, why
2. Top 3–5 specific, actionable recommendations with ROI rationale
3. Creative strategy for each connected platform
4. Playbook update (call update_playbook with everything you've learned)
${allowExecute ? "5. Push any ads for pre-approved actions (call push_digital_ad for each approved creative)" : ""}

Be specific. Use numbers. Think like a CMO who will be held accountable for results.
`;

    const tools = [
      PUSH_DIGITAL_AD_TOOL_DEFINITION,
      UPDATE_PLAYBOOK_TOOL_DEFINITION,
      // Read-only recommendation tool (agent builds these into text output)
    ] as Parameters<typeof client.messages.create>[0]["tools"];

    // Agentic loop with tool use
    const messages: Parameters<typeof client.messages.create>[0]["messages"] = [
      { role: "user", content: userMessage },
    ];

    let loopGuard = 0;
    let finalText = "";

    while (loopGuard < 8) {
      loopGuard++;

      const response = await client.messages.create({
        model:      MODELS.powerful,
        max_tokens: 8192,
        system:     systemPrompt,
        tools,
        messages,
      });

      totalTokens += response.usage.input_tokens + response.usage.output_tokens;

      // Collect text output
      const textBlocks = response.content.filter((b) => b.type === "text");
      finalText = textBlocks.map((b) => (b as { type: "text"; text: string }).text).join("\n\n");

      // Handle tool calls
      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
        const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

        for (const block of toolUseBlocks) {
          const tb = block as { type: "tool_use"; id: string; name: string; input: unknown };

          if (tb.name === "push_digital_ad" && allowExecute) {
            const adInput = tb.input as PushDigitalAdInput;
            const result = await executePushDigitalAdTool(adInput, input.context.dealershipId);

            if (result.ok) {
              adsCreated++;
              // Record in dm_campaigns
              await svc
                .from("dm_campaigns" as never)
                .insert({
                  dealership_id:        input.context.dealershipId,
                  platform:             adInput.platform,
                  platform_campaign_id: result.campaignId ?? result.adId,
                  name:                 adInput.campaign_name,
                  objective:            adInput.objective,
                  status:               "active",  // will be PAUSED in platform but active in our tracking
                  agent_rationale:      adInput.rationale,
                  platform_response:    result,
                } as never);
            } else {
              adsSkipped++;
            }

            toolResults.push({
              type:        "tool_result",
              tool_use_id: tb.id,
              content:     JSON.stringify(result),
            });

          } else if (tb.name === "push_digital_ad" && !allowExecute) {
            toolResults.push({
              type:        "tool_result",
              tool_use_id: tb.id,
              content:     JSON.stringify({ ok: false, error: "Execution not permitted in this run mode (allowExecute=false). Record this as a recommendation instead." }),
            });
            adsSkipped++;

          } else if (tb.name === "update_playbook") {
            const pbInput = tb.input as UpdatePlaybookInput;
            const result = await executeUpdatePlaybookTool(pbInput, input.context.dealershipId);

            if (result.ok) {
              playbookUpdated  = true;
              playbookVersion  = result.version;
              patternsLearned  = result.patternsWritten;
            }

            toolResults.push({
              type:        "tool_result",
              tool_use_id: tb.id,
              content:     JSON.stringify(result),
            });
          }
        }

        // Continue loop with tool results
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });

      } else {
        // stop_reason = end_turn
        break;
      }
    }

    // ── 3. Parse recommendations from final text ──────────────
    // Extract structured recommendations from the agent's output
    // (The agent writes them in the text; we parse them for the API response)
    const recRegex = /\*\*(?:Recommendation|Priority)\s*\d+[:\s]+([^\*]+)\*\*/gi;
    let match: RegExpExecArray | null;
    while ((match = recRegex.exec(finalText)) !== null && recommendations.length < 8) {
      recommendations.push({
        priority:         recommendations.length === 0 ? "critical" : "high",
        platform:         effectivePlatforms[0] ?? "google_ads",
        title:            match[1].trim(),
        rationale:        "",
        estimatedSpend:   null,
        predictedROI:     null,
        requiresApproval: true,
      });
    }

    // ── 4. Billing ────────────────────────────────────────────
    await svc
      .from("billing_events" as never)
      .insert({
        dealership_id: input.context.dealershipId,
        event_type:    "agent_run",
        quantity:      1,
        unit_cost_cents: Math.ceil(totalTokens * 0.015),  // opus pricing
        metadata: {
          agent:      "digital_marketing",
          tokens:     totalTokens,
          mode:       input.mode,
          ads_pushed: adsCreated,
        },
      } as never);

    const executiveBrief = finalText.slice(0, 1500);

    await finishRun(
      "completed",
      `Mode: ${input.mode} | Ads: ${adsCreated} pushed, ${adsSkipped} skipped | Playbook v${playbookVersion ?? "–"} | ${patternsLearned} patterns`
    );

    return {
      agentRunId:         runRecord?.id ?? "",
      mode:               input.mode,
      playbookUpdated,
      playbookVersion,
      adsCreated,
      adsSkipped,
      approvalsRequested,
      patternsLearned,
      recommendations,
      performanceSummary: paidChannelStats,
      executiveBrief,
      tokensUsed:         totalTokens,
      durationMs:         Date.now() - startedAt,
      status:             "completed",
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await finishRun("failed", "Agent error", msg);

    return {
      agentRunId:         runRecord?.id ?? "",
      mode:               input.mode,
      playbookUpdated:    false,
      adsCreated:         0,
      adsSkipped:         0,
      approvalsRequested: 0,
      patternsLearned:    0,
      recommendations:    [],
      performanceSummary: "",
      executiveBrief:     "",
      tokensUsed:         totalTokens,
      durationMs:         Date.now() - startedAt,
      status:             "failed",
      error:              msg,
    };
  }
}
