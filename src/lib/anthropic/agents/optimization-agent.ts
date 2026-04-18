/**
 * Optimization Agent — Analyzes direct mail campaign outcomes and extracts
 * anonymized patterns into global_learnings for cross-dealer network effects.
 *
 * Design:
 *   - Receives mail_pieces + scan stats (ZERO PII — only aggregate counts/rates)
 *   - Claude extracts specific, actionable patterns from the anonymized data
 *   - Patterns written to global_learnings (no dealership_id, no customer data)
 *   - Per-dealership audit row written to learning_outcomes
 *
 * Called by:
 *   - runDirectMailOrchestrator() after successful sends (automatic, fire-and-forget)
 *   - /app/track/[id] on first QR scan (fire-and-forget, lightweight)
 *   - POST /api/mail/optimize (manual "Learn from Campaign" button)
 */
import { getAnthropicClient, MODELS } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import type { AgentContext } from "@/types";

// ── I/O types ─────────────────────────────────────────────────

export interface OptimizationAgentInput {
  context: AgentContext;
  mailPieceIds?: string[];   // analyze specific pieces; omit = recent lookbackDays
  lookbackDays?: number;     // default 30; ignored when mailPieceIds is set
}

export interface OptimizationAgentOutput {
  agentRunId: string;
  patternsExtracted: number;
  patternsWritten: number;
  insights: string;
  tokensUsed: number;
  status: "completed" | "skipped" | "failed";
  error?: string;
}

// ── Agent ─────────────────────────────────────────────────────

export async function runOptimizationAgent(
  input: OptimizationAgentInput
): Promise<OptimizationAgentOutput> {
  const supabase = createServiceClient();
  const client = getAnthropicClient();
  const startedAt = Date.now();

  const { data: runRecord } = await supabase
    .from("agent_runs")
    .insert({
      dealership_id: input.context.dealershipId,
      campaign_id: input.context.campaignId ?? null,
      agent_type: "optimization",
      status: "running",
      input_summary: input.mailPieceIds?.length
        ? `Analyzing ${input.mailPieceIds.length} mail piece(s)`
        : `Analyzing last ${input.lookbackDays ?? 30}d of mail pieces`,
    })
    .select()
    .single();

  const finishRun = async (
    status: "completed" | "failed",
    summary: string,
    errMsg?: string
  ) => {
    if (!runRecord) return;
    await supabase
      .from("agent_runs")
      .update({
        status,
        output_summary: summary,
        error: errMsg ?? null,
        duration_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runRecord.id);
  };

  try {
    // ── 1. Load mail pieces ─────────────────────────────────
    let query = supabase
      .from("mail_pieces")
      .select(
        "id, template_type, variables, status, scanned_count, cost_cents, sent_at, created_at"
      )
      .eq("dealership_id", input.context.dealershipId)
      .neq("status", "pending");

    if (input.mailPieceIds?.length) {
      query = query.in("id", input.mailPieceIds);
    } else {
      const since = new Date(
        Date.now() - (input.lookbackDays ?? 30) * 24 * 60 * 60 * 1000
      ).toISOString();
      query = query.gte("created_at", since);
    }

    const { data: pieces } = await query.limit(200);

    if (!pieces?.length) {
      await finishRun("completed", "No mail pieces to analyze — skipped");
      return {
        agentRunId: runRecord?.id ?? "unknown",
        patternsExtracted: 0,
        patternsWritten: 0,
        insights: "No mail pieces available for analysis.",
        tokensUsed: 0,
        status: "skipped",
      };
    }

    // Require ≥2 submitted pieces for meaningful pattern extraction
    const sentPieces = pieces.filter((p) =>
      ["processing", "in_production", "in_transit", "delivered"].includes(p.status)
    );

    if (sentPieces.length < 2) {
      await finishRun(
        "completed",
        `Skipped — only ${sentPieces.length} sent piece(s); need ≥2`
      );
      return {
        agentRunId: runRecord?.id ?? "unknown",
        patternsExtracted: 0,
        patternsWritten: 0,
        insights: `Not enough data yet (${sentPieces.length} sent piece${sentPieces.length === 1 ? "" : "s"}). Patterns will be extracted once more mail is sent.`,
        tokensUsed: 0,
        status: "skipped",
      };
    }

    // ── 2. Build anonymized aggregate buckets ───────────────
    // Group by template_type × vehicle-model × service-type
    // ZERO customer PII — only aggregate counts and rates

    type Bucket = {
      template_type: string;
      vehicle_segment: string; // model token only e.g. "F-150", "Camry"
      service_type: string;
      offer_preview: string;   // first 60 chars of offer — no names/addresses
      sent: number;
      scans: number;
      delivered: number;
    };

    const buckets = new Map<string, Bucket>();

    for (const piece of sentPieces) {
      const vars = (piece.variables ?? {}) as Record<string, string>;
      // Strip year and make — keep only model token to avoid VIN-level specificity
      const vehicleParts = (vars.vehicle ?? "").trim().split(/\s+/);
      const vehicleSegment = vehicleParts[vehicleParts.length - 1] ?? "";
      const serviceType = vars.service_type ?? "";
      const offerPreview = (vars.offer ?? "general offer").slice(0, 60);
      const key = `${piece.template_type}||${vehicleSegment}||${serviceType}`;

      if (!buckets.has(key)) {
        buckets.set(key, {
          template_type: piece.template_type,
          vehicle_segment: vehicleSegment,
          service_type: serviceType,
          offer_preview: offerPreview,
          sent: 0,
          scans: 0,
          delivered: 0,
        });
      }

      const b = buckets.get(key)!;
      b.sent++;
      b.scans += piece.scanned_count ?? 0;
      if (piece.status === "delivered") b.delivered++;
    }

    const statsRows = Array.from(buckets.values()).map((b) => ({
      ...b,
      scan_rate_pct: b.sent > 0 ? +((b.scans / b.sent) * 100).toFixed(2) : 0,
      delivery_rate_pct: b.sent > 0 ? +((b.delivered / b.sent) * 100).toFixed(2) : 0,
    }));

    const totalScans = sentPieces.reduce((s, p) => s + (p.scanned_count ?? 0), 0);
    const overallScanRatePct = +((totalScans / sentPieces.length) * 100).toFixed(2);

    // ── 3. Load existing patterns for deduplication context ─
    const { data: existingPatterns } = await supabase
      .from("global_learnings")
      .select("pattern_type, description, confidence, sample_size, vehicle_segment")
      .order("confidence", { ascending: false })
      .limit(15);

    // ── 4. Claude — extract actionable patterns ─────────────
    const systemPrompt = `You are the Optimization Agent for AutoCDP, an AI CRM for auto dealerships.

Your job: analyze anonymized direct mail performance data and extract reusable, specific patterns that will make future AI-generated campaigns measurably more effective.

STRICT RULES:
- Zero customer names, emails, addresses, phone numbers, or any PII
- Only aggregate statistics — counts, rates, percentages
- Every pattern must be specific enough to be injected into a Creative Agent system prompt and immediately actionable
- Flag confidence < 0.5 for groups with fewer than 3 pieces
- Do not duplicate existing global_learnings unless new data materially changes the confidence
- Pattern types: "offer_performance" | "template_performance" | "vehicle_segment" | "copy_element" | "timing"

Strong pattern (accept):
  "postcard_6x9 with 15%-off service headline for F-150 owners → 9.2% QR scan rate, 3× the 3% network baseline"

Weak pattern (reject):
  "Postcards work better than letters" — too vague, not actionable

Return a JSON array (empty [] is valid if data is insufficient):
[
  {
    "pattern_type": "offer_performance",
    "description": "one-sentence, specific, actionable finding",
    "pattern_data": {
      "template_type": "postcard_6x9",
      "vehicle_segment": "F-150",
      "service_type": "oil_change",
      "scan_rate_pct": 9.2,
      "sample_size": 14,
      "key_insight": "brief mechanic explanation"
    },
    "confidence": 0.78,
    "sample_size": 14,
    "vehicle_segment": "F-150"
  }
]`;

    const userPrompt = `Analyze this direct mail performance data for ${input.context.dealershipName}.

SUMMARY
Pieces analyzed: ${sentPieces.length} | Total QR scans: ${totalScans} | Overall scan rate: ${overallScanRatePct}%

SEGMENT BREAKDOWN (anonymized — no PII):
${JSON.stringify(statsRows, null, 2)}

EXISTING GLOBAL PATTERNS (do not duplicate without new supporting evidence):
${
  existingPatterns?.length
    ? existingPatterns
        .map(
          (p) =>
            `- [${p.pattern_type}] ${p.description} (confidence: ${p.confidence}, n=${p.sample_size}${p.vehicle_segment ? `, vehicle: ${p.vehicle_segment}` : ""})`
        )
        .join("\n")
    : "None yet — this is the first optimization run."
}

Extract 0–5 patterns. Return [] if nothing is statistically significant.`;

    const response = await client.messages.create({
      model: MODELS.standard,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    const rawText = response.content[0];
    if (rawText.type !== "text") throw new Error("Unexpected response type from Optimization Agent");

    const jsonMatch = rawText.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Optimization Agent did not return a JSON array");

    const patterns: Array<{
      pattern_type: string;
      description: string;
      pattern_data: Record<string, unknown>;
      confidence: number;
      sample_size: number;
      vehicle_segment?: string;
    }> = JSON.parse(jsonMatch[0]);

    // ── 5. Write patterns to global_learnings ───────────────
    let patternsWritten = 0;
    for (const pattern of patterns) {
      if (!pattern.description?.trim()) continue;
      const { error } = await supabase.from("global_learnings").insert({
        pattern_type: pattern.pattern_type,
        description: pattern.description,
        pattern_data: pattern.pattern_data ?? {},
        confidence: Math.min(Math.max(pattern.confidence ?? 0.5, 0), 1),
        sample_size: pattern.sample_size ?? sentPieces.length,
        vehicle_segment: pattern.vehicle_segment ?? null,
        region: null, // never store geographic PII
      });
      if (!error) patternsWritten++;
    }

    // ── 6. Per-dealership learning_outcomes audit row ───────
    await supabase.from("learning_outcomes").insert({
      dealership_id: input.context.dealershipId,
      campaign_id: input.context.campaignId ?? null,
      outcome_type: "direct_mail_scan_rate",
      context: {
        pieces_analyzed: sentPieces.length,
        template_breakdown: statsRows.map((r) => ({
          template: r.template_type,
          vehicle: r.vehicle_segment,
          service: r.service_type,
          sent: r.sent,
        })),
      },
      result: {
        total_scans: totalScans,
        overall_scan_rate_pct: overallScanRatePct,
        patterns_extracted: patterns.length,
        patterns_written: patternsWritten,
      },
      model_version: "v1",
    });

    // ── 7. Billing event ────────────────────────────────────
    await supabase.from("billing_events").insert({
      dealership_id: input.context.dealershipId,
      event_type: "agent_run",
      quantity: 1,
      unit_cost_cents: Math.ceil(tokensUsed * 0.003),
      metadata: {
        agent: "optimization",
        tokens: tokensUsed,
        pieces_analyzed: sentPieces.length,
        patterns_written: patternsWritten,
      },
    });

    const insights =
      patterns.length > 0
        ? `Extracted ${patterns.length} pattern(s) from ${sentPieces.length} pieces (${totalScans} QR scans). ` +
          patterns
            .slice(0, 3)
            .map((p) => p.description)
            .join("; ")
        : `Analyzed ${sentPieces.length} pieces (${totalScans} scans). No statistically significant patterns yet — continue sending to build signal.`;

    await finishRun(
      "completed",
      `${patternsWritten}/${patterns.length} patterns written to global_learnings`
    );

    return {
      agentRunId: runRecord?.id ?? "unknown",
      patternsExtracted: patterns.length,
      patternsWritten,
      insights,
      tokensUsed,
      status: "completed",
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[runOptimizationAgent]", errMsg);
    await finishRun("failed", "Failed", errMsg);
    return {
      agentRunId: runRecord?.id ?? "unknown",
      patternsExtracted: 0,
      patternsWritten: 0,
      insights: "",
      tokensUsed: 0,
      status: "failed",
      error: errMsg,
    };
  }
}
