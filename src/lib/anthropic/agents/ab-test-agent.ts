/**
 * A/B Test Analysis Agent
 *
 * Analyzes direct mail A/B test results for a campaign:
 *   1. Groups mail_pieces by ab_variant from variables JSON
 *   2. Computes scan rates per variant
 *   3. Declares winner + calculates lift %
 *   4. Extracts a named pattern via Claude Haiku → writes to global_learnings
 *
 * Called from POST /api/ai/ab-results/[campaignId]
 * Also exposed as runABTestAnalysis() for orchestrator fire-and-forget use.
 */
import { getAnthropicClient, MODELS } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import type { AgentContext } from "@/types";

// ── I/O ───────────────────────────────────────────────────────

export interface ABTestAnalysisInput {
  context: AgentContext;
  campaignId: string;
  variantALabel?: string;
  variantBLabel?: string;
}

export interface ABVariantMetrics {
  variant: "A" | "B";
  label: string;
  sent: number;
  delivered: number;
  scanned: number;
  scanRate: number; // percent (0–100)
}

export interface ABTestAnalysisOutput {
  campaignId: string;
  variantA: ABVariantMetrics;
  variantB: ABVariantMetrics;
  winner: "A" | "B" | "tie";
  liftPct: number;
  confidence: "high" | "medium" | "low";
  patternExtracted: string;
  patternsWritten: number;
  status: "completed" | "insufficient_data" | "failed";
  error?: string;
}

// ── Agent ─────────────────────────────────────────────────────

export async function runABTestAnalysis(
  input: ABTestAnalysisInput
): Promise<ABTestAnalysisOutput> {
  const supabase = createServiceClient();
  const client = getAnthropicClient();

  const emptyMetrics = (v: "A" | "B", label: string): ABVariantMetrics => ({
    variant: v,
    label,
    sent: 0,
    delivered: 0,
    scanned: 0,
    scanRate: 0,
  });

  try {
    type PieceRow = {
      id: string;
      variables: Record<string, string> | null;
      scanned_count: number | null;
      status: string | null;
    };

    const { data: pieces } = (await supabase
      .from("mail_pieces")
      .select("id, variables, scanned_count, status")
      .eq("campaign_id", input.campaignId)
      .eq("dealership_id", input.context.dealershipId)
    ) as unknown as { data: PieceRow[] | null };

    if (!pieces?.length) {
      return {
        campaignId: input.campaignId,
        variantA: emptyMetrics("A", input.variantALabel ?? "Variant A"),
        variantB: emptyMetrics("B", input.variantBLabel ?? "Variant B"),
        winner: "tie",
        liftPct: 0,
        confidence: "low",
        patternExtracted: "",
        patternsWritten: 0,
        status: "insufficient_data",
      };
    }

    // Group pieces by variant (default to "A" if not tagged)
    const groups: Record<"A" | "B", { sent: number; delivered: number; scanned: number }> = {
      A: { sent: 0, delivered: 0, scanned: 0 },
      B: { sent: 0, delivered: 0, scanned: 0 },
    };

    for (const p of pieces) {
      const variant = ((p.variables?.ab_variant as string | undefined) ?? "A") as "A" | "B";
      if (variant !== "A" && variant !== "B") continue;
      groups[variant].sent++;
      if (["delivered", "in_transit", "in_production"].includes(p.status ?? "")) {
        groups[variant].delivered++;
      }
      if ((p.scanned_count ?? 0) > 0) groups[variant].scanned++;
    }

    const makeMetrics = (variant: "A" | "B", label: string): ABVariantMetrics => ({
      variant,
      label,
      ...groups[variant],
      scanRate:
        groups[variant].delivered > 0
          ? +((groups[variant].scanned / groups[variant].delivered) * 100).toFixed(1)
          : 0,
    });

    const metricsA = makeMetrics("A", input.variantALabel ?? "Variant A");
    const metricsB = makeMetrics("B", input.variantBLabel ?? "Variant B");

    // Need ≥ 5 delivered per variant for meaningful stats
    if (metricsA.delivered < 5 || metricsB.delivered < 5) {
      return {
        campaignId: input.campaignId,
        variantA: metricsA,
        variantB: metricsB,
        winner: "tie",
        liftPct: 0,
        confidence: "low",
        patternExtracted: "Insufficient data — need ≥ 5 delivered pieces per variant to declare a winner.",
        patternsWritten: 0,
        status: "insufficient_data",
      };
    }

    // Declare winner (require ≥ 0.5 pp gap to avoid noise)
    const winner: "A" | "B" | "tie" =
      metricsA.scanRate > metricsB.scanRate + 0.5
        ? "A"
        : metricsB.scanRate > metricsA.scanRate + 0.5
        ? "B"
        : "tie";

    const winnerRate = Math.max(metricsA.scanRate, metricsB.scanRate);
    const loserRate = Math.min(metricsA.scanRate, metricsB.scanRate);
    const liftPct =
      winner !== "tie" && loserRate > 0
        ? +((winnerRate - loserRate) / loserRate * 100).toFixed(0)
        : 0;

    // Statistical confidence by sample size
    const minSample = Math.min(metricsA.delivered, metricsB.delivered);
    const confidence: "high" | "medium" | "low" =
      minSample >= 50 ? "high" : minSample >= 20 ? "medium" : "low";

    // Extract pattern via Haiku (fast + cheap)
    let patternExtracted = "";
    let patternsWritten = 0;

    if (winner !== "tie") {
      const winMetrics = winner === "A" ? metricsA : metricsB;
      const loseMetrics = winner === "A" ? metricsB : metricsA;

      try {
        const resp = await client.messages.create({
          model: MODELS.fast,
          max_tokens: 200,
          system:
            `You are an AutoCDP analytics agent. Extract a concise, actionable pattern from A/B test results. ` +
            `Output JSON only: {"pattern": "under 100 chars — describe WHAT performed better and a concrete reason WHY"}`,
          messages: [
            {
              role: "user",
              content:
                `A/B test for ${input.context.dealershipName}:\n` +
                `WINNER: ${winMetrics.label} — ${winMetrics.scanRate}% scan rate (${winMetrics.scanned}/${winMetrics.delivered})\n` +
                `LOSER:  ${loseMetrics.label} — ${loseMetrics.scanRate}% scan rate (${loseMetrics.scanned}/${loseMetrics.delivered})\n` +
                `Lift: +${liftPct}%\n` +
                `Extract the single most actionable pattern.`,
            },
          ],
        });

        const text =
          resp.content[0].type === "text" ? resp.content[0].text : "";
        const match = text.match(/\{[\s\S]+?\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as { pattern?: string };
          patternExtracted = parsed.pattern ?? "";
        }
      } catch {
        patternExtracted = `${winMetrics.label} outperformed ${loseMetrics.label} by ${liftPct}% scan-rate lift`;
      }

      if (patternExtracted) {
        await supabase.from("global_learnings").insert({
          pattern_type: "ab_winner",
          description: patternExtracted,
          pattern_data: {
            winner_variant: winner,
            winner_label: winMetrics.label,
            loser_label: loseMetrics.label,
            winner_scan_rate: winMetrics.scanRate,
            loser_scan_rate: loseMetrics.scanRate,
            lift_pct: liftPct,
            sample_size: minSample,
            campaign_id: input.campaignId,
            dealership_id: input.context.dealershipId,
          },
          confidence: confidence === "high" ? 0.85 : confidence === "medium" ? 0.65 : 0.45,
          sample_size: minSample,
          region: null,
          vehicle_segment: null,
        });
        patternsWritten = 1;
      }
    }

    return {
      campaignId: input.campaignId,
      variantA: metricsA,
      variantB: metricsB,
      winner,
      liftPct,
      confidence,
      patternExtracted,
      patternsWritten,
      status: "completed",
    };
  } catch (error) {
    return {
      campaignId: input.campaignId,
      variantA: emptyMetrics("A", input.variantALabel ?? "Variant A"),
      variantB: emptyMetrics("B", input.variantBLabel ?? "Variant B"),
      winner: "tie",
      liftPct: 0,
      confidence: "low",
      patternExtracted: "",
      patternsWritten: 0,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
