import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";

// ── Input types ───────────────────────────────────────────────────────────────

export interface HealthMetrics {
  dealerName: string;
  customers: {
    total: number;
    reachable: number;   // have email or phone
    lifecycle: { vip: number; active: number; at_risk: number; lapsed: number; prospect: number };
    avgDaysSinceVisit: number;
    atRiskPct: number;
    lapsedPct: number;
  };
  inventory: {
    total: number;
    avgDaysOnLot: number;
    buckets: { lt30: number; d30to60: number; d60to90: number; gt90: number };
    agedPct: number;  // % of vehicles on lot 60+ days
  };
  campaigns: {
    mailSent: number;
    mailDeliveryRate: number;
    mailScanRate: number;
    smsSent: number;
    smsClickRate: number;
    emailSent: number;
    emailOpenRate: number;
    agentRunsLast30d: number;
  };
  service: {
    visitsLast90d: number;
    avgROValueDollars: number;
    uniqueCustomersServiced: number;
    retentionRate: number;  // % of active customers with a visit in last 90d
  };
  insights: {
    sentimentPositive: string[];
    sentimentNegative: string[];
    reviewPositive: string[];
    reviewNegative: string[];
  };
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface HealthRecommendation {
  id: string;
  priority: "critical" | "high" | "medium";
  category: "retention" | "inventory" | "engagement" | "revenue" | "operations";
  title: string;
  description: string;
  suggested_action: string;
  expected_impact: string;
  action_type: "campaign" | "inventory" | "settings" | "review" | null;
  action_url: string | null;
}

export interface HealthAnalysis {
  overall_score: number;
  score_label: "Excellent" | "Good" | "Fair" | "Needs Attention" | "Critical";
  analyzed_at: string;
  component_scores: {
    customer_retention: number;
    inventory_health: number;
    campaign_engagement: number;
    revenue_health: number;
  };
  recommendations: HealthRecommendation[];
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export async function runHealthAgent(metrics: HealthMetrics): Promise<HealthAnalysis> {
  const client = getAnthropicClient();

  const prompt = `You are a dealership performance analyst for AutoCDP. Analyze this dealership's metrics and produce a health report.

DEALERSHIP: ${metrics.dealerName}

CUSTOMER HEALTH:
- Total customers: ${metrics.customers.total} (${metrics.customers.reachable} reachable via email/phone)
- VIP: ${metrics.customers.lifecycle.vip} | Active: ${metrics.customers.lifecycle.active} | At-Risk: ${metrics.customers.lifecycle.at_risk} (${metrics.customers.atRiskPct}%) | Lapsed: ${metrics.customers.lifecycle.lapsed} (${metrics.customers.lapsedPct}%) | Prospects: ${metrics.customers.lifecycle.prospect}
- Average days since last visit: ${metrics.customers.avgDaysSinceVisit}

INVENTORY HEALTH:
- Total available vehicles: ${metrics.inventory.total}
- Average days on lot: ${metrics.inventory.avgDaysOnLot}
- <30 days: ${metrics.inventory.buckets.lt30} | 30-60d: ${metrics.inventory.buckets.d30to60} | 60-90d: ${metrics.inventory.buckets.d60to90} | 90+d: ${metrics.inventory.buckets.gt90}
- Aged inventory (60+ days): ${metrics.inventory.agedPct}%

CAMPAIGN PERFORMANCE (last 90 days):
- Direct mail: ${metrics.campaigns.mailSent} sent, ${metrics.campaigns.mailDeliveryRate}% delivered, ${metrics.campaigns.mailScanRate}% scan rate
- SMS: ${metrics.campaigns.smsSent} sent, ${metrics.campaigns.smsClickRate}% click rate
- Email: ${metrics.campaigns.emailSent} sent, ${metrics.campaigns.emailOpenRate}% open rate
- AI agent runs (last 30d): ${metrics.campaigns.agentRunsLast30d}

SERVICE METRICS (last 90 days):
- Total visits: ${metrics.service.visitsLast90d}
- Average RO value: $${metrics.service.avgROValueDollars}
- Unique customers serviced: ${metrics.service.uniqueCustomersServiced}
- Active customer retention rate: ${metrics.service.retentionRate}%

SENTIMENT & REVIEWS:
- Positive themes: ${metrics.insights.sentimentPositive.join(", ") || "none captured"}
- Negative themes: ${metrics.insights.sentimentNegative.join(", ") || "none captured"}
- Review positives: ${metrics.insights.reviewPositive.join(", ") || "not connected"}
- Review negatives: ${metrics.insights.reviewNegative.join(", ") || "not connected"}

Produce a JSON health report. Rules:
- Scores: 0-100. Weight customer retention 30%, inventory health 25%, campaign engagement 25%, revenue health 20%
- Overall score = weighted average of component scores
- score_label: ≥80 "Excellent", ≥65 "Good", ≥50 "Fair", ≥35 "Needs Attention", <35 "Critical"
- Generate 3-5 recommendations ordered by priority (critical → high → medium)
- Reference EXACT numbers from the metrics — vague recommendations are useless
- Flag critical issues: aged inventory >30%, at-risk customers >25%, scan rate <4%, retention rate <20%
- Each recommendation must have a concrete single-sentence action
- Expected impact should be quantified where possible (e.g. "estimated 15-20 reactivated customers")
- action_url options: "/dashboard/campaigns" for campaigns, "/dashboard/inventory" for inventory issues, "/dashboard/settings" for configuration, "/dashboard/analytics" for tracking

Respond with ONLY valid JSON matching this exact structure:
{
  "overall_score": <integer 0-100>,
  "score_label": <"Excellent"|"Good"|"Fair"|"Needs Attention"|"Critical">,
  "analyzed_at": "${new Date().toISOString()}",
  "component_scores": {
    "customer_retention": <integer 0-100>,
    "inventory_health": <integer 0-100>,
    "campaign_engagement": <integer 0-100>,
    "revenue_health": <integer 0-100>
  },
  "recommendations": [
    {
      "id": "rec_1",
      "priority": <"critical"|"high"|"medium">,
      "category": <"retention"|"inventory"|"engagement"|"revenue"|"operations">,
      "title": <max 65 characters>,
      "description": <2-3 sentences with specific numbers>,
      "suggested_action": <one clear sentence>,
      "expected_impact": <quantified outcome>,
      "action_type": <"campaign"|"inventory"|"settings"|"review"|null>,
      "action_url": <url string or null>
    }
  ]
}`;

  const resp = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  // Strip markdown fences if present
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(json) as HealthAnalysis;
}
