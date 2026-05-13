import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scanViolations } from "@/lib/anthropic/guardrails";
import { getCadenceStatus } from "@/lib/cadence";
import type { CampaignScoreResult } from "@/types";

/**
 * POST /api/mail/score
 *
 * Deterministic campaign pre-send scoring — no AI call, instant response.
 * Returns an overall score (0–100), estimated response rate, risk level,
 * audience quality score, and compliance score.
 *
 * Body:
 *   customerIds    string[]
 *   templateType   string   (optional)
 *   campaignGoal   string
 *   channel        string   (default: "direct_mail")
 *   previewContent string   (optional — if provided, runs compliance scan)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.json({ error: "No dealership" }, { status: 400 });
    }

    const body = await req.json();
    const {
      customerIds,
      templateType,
      campaignGoal,
      channel = "direct_mail",
      previewContent,
    }: {
      customerIds: string[];
      templateType?: string;
      campaignGoal?: string;
      channel?: string;
      previewContent?: string;
    } = body;

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: "customerIds required" }, { status: 400 });
    }

    const svc = createServiceClient();

    const [{ data: customers }, cadenceMap, { data: learnings }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, lifecycle_stage, address")
        .in("id", customerIds)
        .eq("dealership_id", ud.dealership_id),
      getCadenceStatus(ud.dealership_id, customerIds),
      svc
        .from("global_learnings")
        .select("description, confidence, pattern_type, pattern_data, vehicle_segment")
        .in("pattern_type", ["template_performance", "offer_performance"])
        .gte("confidence", 0.55)
        .order("confidence", { ascending: false })
        .limit(12),
    ]);

    const total = customers?.length ?? 0;
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // ── Audience score ───────────────────────────────────────────
    let audienceScore = 65;

    const addressable = (customers ?? []).filter(
      (c) => (c.address as Record<string, string> | null)?.street
    ).length;
    const addressPct = total > 0 ? addressable / total : 0;

    if (channel === "direct_mail") {
      if (addressPct >= 0.9) {
        audienceScore += 15;
      } else if (addressPct >= 0.7) {
        audienceScore += 8;
      } else {
        audienceScore -= Math.round((1 - addressPct) * 20);
        warnings.push(`${total - addressable} of ${total} customers have no mailing address and will be skipped`);
      }
    }

    const stageCount = (customers ?? []).reduce((acc, c) => {
      const stage = c.lifecycle_stage as string;
      acc[stage] = (acc[stage] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const highValueCount = (stageCount.vip ?? 0) + (stageCount.lapsed ?? 0);
    const highValuePct = highValueCount / Math.max(total, 1);
    if (highValuePct >= 0.4) audienceScore += 10;
    else if (highValuePct >= 0.2) audienceScore += 5;

    if (total < 5) {
      audienceScore -= 10;
      warnings.push("Small audience (< 5 recipients) — too small for statistical learning");
    } else if (total >= 50) {
      audienceScore += 5; // Large batches generate better signal
    }

    const suppressed = Array.from(cadenceMap.values()).filter((r) => !r.eligible).length;
    const suppressedPct = total > 0 ? suppressed / total : 0;
    if (suppressedPct > 0.5) {
      audienceScore -= 20;
      warnings.push(`${suppressed} customers are in cadence cooldown (contacted < 60 days ago) and will be skipped`);
    } else if (suppressedPct > 0.2) {
      audienceScore -= 10;
      suggestions.push(`${suppressed} customers are in cooldown — consider waiting or narrowing the audience`);
    }

    audienceScore = Math.max(0, Math.min(100, audienceScore));

    // ── Compliance score ──────────────────────────────────────────
    let complianceScore = 100;
    let hasBlockViolation = false;

    if (previewContent?.trim()) {
      const findings = scanViolations(previewContent);
      for (const f of findings) {
        if (f.severity === "block") {
          complianceScore -= 40;
          hasBlockViolation = true;
        } else {
          complianceScore -= 12;
        }
      }
      if (findings.length > 0) {
        const labels = findings.slice(0, 2).map((f) => f.label);
        warnings.push(`${findings.length} compliance issue(s) in preview copy: ${labels.join("; ")}`);
        suggestions.push("Regenerate copy or use the guardrail rewrite to fix issues before sending");
      }
    } else {
      // Can't fully score without copy — nudge user to generate preview
      complianceScore = 88;
      suggestions.push("Generate a preview to score compliance before sending");
    }

    complianceScore = Math.max(0, Math.min(100, complianceScore));

    // ── Estimated response rate ───────────────────────────────────
    // Base rates from industry benchmarks (QR scans for direct mail)
    let estimatedResponseRate = channel === "direct_mail" ? 3.0 : channel === "sms" ? 5.5 : 2.0;

    // Boost from matching global learnings
    const relevantLearnings = (learnings ?? []).filter((l) => {
      const pd = l.pattern_data as Record<string, unknown> | null;
      return !templateType || !pd?.template_type || pd.template_type === templateType;
    });

    if (relevantLearnings.length > 0) {
      const weightedSum = relevantLearnings.reduce((sum, l) => {
        const pd = l.pattern_data as Record<string, unknown> | null;
        const scanRate = typeof pd?.scan_rate_pct === "number" ? pd.scan_rate_pct : 0;
        return sum + scanRate * (l.confidence ?? 0.5);
      }, 0);
      const weightedAvg = weightedSum / relevantLearnings.length;
      // Blend network data with baseline (70% network, 30% base)
      estimatedResponseRate = weightedAvg * 0.7 + estimatedResponseRate * 0.3;
    }

    if (templateType === "postcard_6x9") estimatedResponseRate += 0.8;  // best QR format
    if (highValuePct >= 0.4) estimatedResponseRate += 1.2;              // VIP+lapsed = high intent
    if (total >= 20) estimatedResponseRate += 0.4;                      // sample size

    estimatedResponseRate = Math.min(25, Math.max(0.5, +estimatedResponseRate.toFixed(1)));

    // ── Overall score ─────────────────────────────────────────────
    const responseBonus = Math.min(15, estimatedResponseRate * 1.2);
    const overallScore = Math.round(
      audienceScore * 0.45 + complianceScore * 0.35 + responseBonus * 0.2 * 5
    );

    const riskLevel: "low" | "medium" | "high" =
      hasBlockViolation || overallScore < 50
        ? "high"
        : overallScore < 72
        ? "medium"
        : "low";

    // ── Suggestions ───────────────────────────────────────────────
    if (audienceScore < 60 && channel === "direct_mail") {
      suggestions.push("Add mailing addresses — direct mail requires a valid delivery address per piece");
    }
    if (highValuePct < 0.2 && channel === "direct_mail") {
      suggestions.push("Include VIP or lapsed customers for better direct mail response rates");
    }
    if (estimatedResponseRate < 2.0 && relevantLearnings.length === 0) {
      suggestions.push("No network performance data for this template yet — start with a small batch to build signal");
    }
    if (!campaignGoal?.trim()) {
      suggestions.push("Add a specific campaign goal to help the AI personalize copy more effectively");
    }
    if (total >= 10 && total <= 20 && channel === "direct_mail") {
      suggestions.push("Consider sending 5–10 test pieces first to validate copy before the full batch");
    }

    const result: CampaignScoreResult = {
      overallScore: Math.max(0, Math.min(100, overallScore)),
      estimatedResponseRate,
      riskLevel,
      complianceScore,
      audienceScore,
      warnings,
      suggestions,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/mail/score]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
