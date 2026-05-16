/**
 * update_playbook — Anthropic tool definition + executor.
 *
 * Called by the Digital Marketing Agent to persist strategic learnings:
 *   1. Upsert the dealership's dm_playbook with the new strategic plan.
 *   2. Write individual patterns to dm_learning_patterns.
 *
 * This is the mechanism by which the agent gets smarter over time.
 */
import { createServiceClient } from "@/lib/supabase/server";

// ── Tool definition ───────────────────────────────────────────

export const UPDATE_PLAYBOOK_TOOL_DEFINITION = {
  name: "update_playbook",
  description: `Save strategic insights, patterns, and recommendations to the dealership's Digital Marketing Playbook.
Call this after analyzing performance data to persist what you've learned.
The playbook evolves with every cycle and is injected into future agent runs.
Use this to record winning creative formats, audience insights, timing patterns, budget allocation recommendations, and offer effectiveness.`,
  input_schema: {
    type: "object" as const,
    required: ["playbook_update"],
    properties: {
      playbook_update: {
        type: "object",
        description: "The updated strategic playbook content.",
        properties: {
          budget_allocation: {
            type: "object",
            description: "Recommended % split across channels. E.g. { google_ads: 40, meta_ads: 35, tiktok_ads: 15, owned: 10 }",
            properties: {
              google_ads: { type: "number" },
              meta_ads:   { type: "number" },
              tiktok_ads: { type: "number" },
              owned:      { type: "number" },
            },
          },
          top_audiences: {
            type: "array",
            description: "Highest-performing audience segments this dealership has found.",
            items: {
              type: "object",
              properties: {
                name:        { type: "string" },
                description: { type: "string" },
                platforms:   { type: "array", items: { type: "string" } },
                priority:    { type: "string", enum: ["high", "medium", "low"] },
                evidence:    { type: "string" },
              },
            },
          },
          creative_principles: {
            type: "array",
            description: "What creative approaches work best for this dealership's audience.",
            items: {
              type: "object",
              properties: {
                principle:      { type: "string" },
                rationale:      { type: "string" },
                evidence_count: { type: "number" },
              },
            },
          },
          offer_library: {
            type: "array",
            description: "Proven offers and their performance metrics.",
            items: {
              type: "object",
              properties: {
                offer_text:   { type: "string" },
                channels:     { type: "array", items: { type: "string" } },
                ctr_lift_pct: { type: "number" },
                conversions:  { type: "number" },
                notes:        { type: "string" },
              },
            },
          },
          bidding_strategy: {
            type: "object",
            description: "Recommended bid strategies per platform.",
            properties: {
              google: { type: "string" },
              meta:   { type: "string" },
              tiktok: { type: "string" },
            },
          },
          seasonal_patterns: {
            type: "array",
            description: "Performance patterns by time of year.",
            items: {
              type: "object",
              properties: {
                month_range:    { type: "string" },
                recommendation: { type: "string" },
                channel_focus:  { type: "string" },
              },
            },
          },
          channel_mix: {
            type: "object",
            description: "Which channels to use at each funnel stage.",
            properties: {
              awareness:     { type: "array", items: { type: "string" } },
              consideration: { type: "array", items: { type: "string" } },
              conversion:    { type: "array", items: { type: "string" } },
              retention:     { type: "array", items: { type: "string" } },
            },
          },
          executive_summary: {
            type: "string",
            description: "1–3 sentence summary of the current strategic position and top recommendation.",
          },
        },
      },
      new_patterns: {
        type: "array",
        description: "Individual patterns to add to dm_learning_patterns.",
        items: {
          type: "object",
          required: ["pattern_type", "title", "description"],
          properties: {
            pattern_type: {
              type: "string",
              enum: ["creative", "audience", "timing", "offer", "bidding", "channel_mix", "funnel", "seasonal"],
            },
            title:       { type: "string" },
            description: { type: "string" },
            confidence:  { type: "number", description: "0.0–1.0" },
            platforms:   { type: "array", items: { type: "string" } },
            evidence:    { type: "object" },
          },
        },
      },
      performance_since: {
        type: "string",
        description: "ISO date string of the earliest data point this playbook was trained on.",
      },
    },
  },
} as const;

// ── Input type ────────────────────────────────────────────────

export interface UpdatePlaybookInput {
  playbook_update: Record<string, unknown>;
  new_patterns?: Array<{
    pattern_type: string;
    title:        string;
    description:  string;
    confidence?:  number;
    platforms?:   string[];
    evidence?:    Record<string, unknown>;
  }>;
  performance_since?: string;
}

export interface UpdatePlaybookResult {
  ok:               boolean;
  playbookId?:      string;
  version?:         number;
  patternsWritten:  number;
  error?:           string;
}

// ── Executor ─────────────────────────────────────────────────

export async function executeUpdatePlaybookTool(
  input: UpdatePlaybookInput,
  dealershipId: string
): Promise<UpdatePlaybookResult> {
  const svc = createServiceClient();
  let patternsWritten = 0;

  try {
    // Retire old current playbook
    await svc
      .from("dm_playbook" as never)
      .update({ is_current: false } as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("is_current" as never, true as never);

    // Get current version number
    const { data: latest } = await svc
      .from("dm_playbook" as never)
      .select("version" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("version" as never, { ascending: false })
      .limit(1)
      .maybeSingle() as unknown as { data: { version: number } | null };

    const nextVersion = (latest?.version ?? 0) + 1;

    // Insert new playbook version
    const { data: pb, error: pbErr } = await svc
      .from("dm_playbook" as never)
      .insert({
        dealership_id:    dealershipId,
        version:          nextVersion,
        content:          input.playbook_update,
        is_current:       true,
        performance_since: input.performance_since ?? null,
        updated_at:       new Date().toISOString(),
      } as never)
      .select("id, version" as never)
      .single() as unknown as {
        data: { id: string; version: number } | null;
        error: { message: string } | null;
      };

    if (pbErr || !pb) {
      return { ok: false, patternsWritten: 0, error: pbErr?.message ?? "Failed to save playbook" };
    }

    // Write patterns
    if (input.new_patterns?.length) {
      const patternRows = input.new_patterns.map((p) => ({
        dealership_id: dealershipId,
        pattern_type:  p.pattern_type,
        title:         p.title,
        description:   p.description,
        confidence:    Math.min(1, Math.max(0, p.confidence ?? 0.6)),
        platforms:     p.platforms ?? [],
        evidence:      p.evidence ?? {},
        is_active:     true,
        updated_at:    new Date().toISOString(),
      }));

      const { error: pErr } = await svc
        .from("dm_learning_patterns" as never)
        .insert(patternRows as never);

      if (!pErr) patternsWritten = patternRows.length;
    }

    return {
      ok:              true,
      playbookId:      pb.id,
      version:         pb.version,
      patternsWritten,
    };
  } catch (err) {
    return {
      ok:             false,
      patternsWritten,
      error:          err instanceof Error ? err.message : "Unknown error",
    };
  }
}
