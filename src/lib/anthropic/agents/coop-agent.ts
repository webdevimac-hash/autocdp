/**
 * Co-op Agent — 6th agent in the AutoCDP swarm.
 *
 * Runs only when campaign_type = "coop". Checks manufacturer co-op program
 * eligibility, generates compliant copy guidelines, injects required disclaimers,
 * and estimates reimbursement. Runs after Targeting, before Creative.
 */

import { getAnthropicClient, MODELS } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import type { AgentContext, CommunicationChannel } from "@/types";

export interface CoopProgram {
  id: string;
  dealership_id: string;
  manufacturer: string;
  program_name: string;
  eligible_makes: string[] | null;
  eligible_model_years: number[] | null;
  reimbursement_rate: number;
  max_reimbursement_usd: number | null;
  required_disclaimers: string[];
  copy_guidelines: string;
  eligibility_requirements: string;
  is_active: boolean;
  valid_from: string | null;
  valid_through: string | null;
}

export interface CoopAgentInput {
  context: AgentContext;
  channel: CommunicationChannel | "multi_channel";
  campaignGoal: string;
  recipientCount: number;
  estimatedCostUsd: number;
}

export interface CoopAgentOutput {
  eligible: boolean;
  programs: CoopProgram[];
  requiredDisclaimers: string[];
  copyGuidelines: string;
  reimbursementEstimateUsd: number;
  coopContext: string;
  tokensUsed: number;
  agentRunId: string;
}

export async function runCoopAgent(input: CoopAgentInput): Promise<CoopAgentOutput> {
  const supabase = createServiceClient();
  const client = getAnthropicClient();
  const startedAt = Date.now();

  const { data: runRecord } = await supabase
    .from("agent_runs")
    .insert({
      dealership_id: input.context.dealershipId,
      campaign_id: input.context.campaignId ?? null,
      agent_type: "coop",
      status: "running",
      input_summary: `Co-op eligibility: ${input.recipientCount} recipients | ${input.channel} | goal: ${input.campaignGoal.slice(0, 80)}`,
    })
    .select()
    .single();

  try {
    const { data: rawPrograms } = await supabase
      .from("dealership_coop_programs")
      .select("*")
      .eq("dealership_id", input.context.dealershipId)
      .eq("is_active", true)
      .or(`valid_through.is.null,valid_through.gte.${new Date().toISOString().slice(0, 10)}`)
      .order("manufacturer");

    const programs = (rawPrograms ?? []) as CoopProgram[];

    if (programs.length === 0) {
      if (runRecord) {
        await supabase.from("agent_runs").update({
          status: "completed",
          input_tokens: 0, output_tokens: 0,
          duration_ms: Date.now() - startedAt,
          output_summary: "No active co-op programs configured",
          completed_at: new Date().toISOString(),
        }).eq("id", runRecord.id);
      }
      return {
        eligible: false, programs: [], requiredDisclaimers: [], copyGuidelines: "",
        reimbursementEstimateUsd: 0, coopContext: "", tokensUsed: 0,
        agentRunId: runRecord?.id ?? "unknown",
      };
    }

    const programsBlock = programs.map((p, i) =>
      `Program ${i + 1}: ${p.manufacturer} — ${p.program_name}\n` +
      `  Eligible makes: ${p.eligible_makes?.join(", ") ?? "All"}\n` +
      `  Eligible model years: ${p.eligible_model_years?.join(", ") ?? "All"}\n` +
      `  Reimbursement: ${Math.round(p.reimbursement_rate * 100)}%` +
      (p.max_reimbursement_usd ? ` (max $${p.max_reimbursement_usd})` : "") + `\n` +
      `  Validity: ${p.valid_from ?? "any"} → ${p.valid_through ?? "ongoing"}\n` +
      `  Eligibility requirements: ${p.eligibility_requirements}\n` +
      `  Required disclaimers: ${p.required_disclaimers.join(" | ")}\n` +
      `  Copy guidelines: ${p.copy_guidelines}`
    ).join("\n\n");

    const systemPrompt =
      `You are the Co-op Advertising Compliance Agent for AutoCDP.\n` +
      `Your role: analyze active co-op programs, determine which apply to this campaign,\n` +
      `and produce precise, actionable guidance for the Creative Agent.\n\n` +
      `Rules:\n` +
      `- Only recommend programs that clearly match the campaign goal and channel\n` +
      `- Copy guidelines must be specific (what TO say, what NOT to say, required taglines)\n` +
      `- Include ALL required disclaimers verbatim — never paraphrase or shorten them\n` +
      `- Reimbursement: apply rate × campaign cost, cap at max_reimbursement_usd\n` +
      `- creative_agent_context: 2–3 sentences the Creative Agent reads before writing copy`;

    const userPrompt =
      `DEALERSHIP: ${input.context.dealershipName}\n` +
      `CAMPAIGN GOAL: ${input.campaignGoal}\n` +
      `CHANNEL: ${input.channel}\n` +
      `RECIPIENTS: ${input.recipientCount}\n` +
      `ESTIMATED CAMPAIGN COST: $${input.estimatedCostUsd.toFixed(2)}\n\n` +
      `ACTIVE CO-OP PROGRAMS:\n${programsBlock}\n\n` +
      `Respond with JSON only:\n` +
      `{\n` +
      `  "eligible_program_indices": [0],\n` +
      `  "eligibility_reasoning": "brief explanation",\n` +
      `  "required_disclaimers": ["verbatim disclaimer text"],\n` +
      `  "copy_guidelines": "specific rules for copy: required mentions, prohibited claims, approved taglines",\n` +
      `  "estimated_reimbursement_usd": 0.00,\n` +
      `  "compliance_risks": ["risk 1"],\n` +
      `  "creative_agent_context": "2-3 sentence briefing for the Creative Agent"\n` +
      `}`;

    const response = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    const block = response.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type from Co-op Agent");

    const jsonMatch = block.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Co-op Agent did not return valid JSON");

    const parsed = JSON.parse(jsonMatch[0]) as {
      eligible_program_indices: number[];
      eligibility_reasoning: string;
      required_disclaimers: string[];
      copy_guidelines: string;
      estimated_reimbursement_usd: number;
      compliance_risks: string[];
      creative_agent_context: string;
    };

    const eligiblePrograms = (parsed.eligible_program_indices ?? [])
      .filter((i) => i >= 0 && i < programs.length)
      .map((i) => programs[i]);

    const coopContext = eligiblePrograms.length > 0
      ? `\nCO-OP ADVERTISING — MANUFACTURER COMPLIANCE REQUIRED:\n` +
        parsed.creative_agent_context + `\n\n` +
        `CO-OP COPY RULES:\n${parsed.copy_guidelines}\n` +
        (parsed.compliance_risks?.length
          ? `\nCOMPLIANCE RISKS TO AVOID:\n${parsed.compliance_risks.map((r) => `• ${r}`).join("\n")}\n`
          : "") +
        `\nREQUIRED DISCLAIMERS — append verbatim after your message copy:\n` +
        (parsed.required_disclaimers ?? []).map((d) => `  "${d}"`).join("\n") + `\n`
      : "";

    const out: CoopAgentOutput = {
      eligible: eligiblePrograms.length > 0,
      programs: eligiblePrograms,
      requiredDisclaimers: parsed.required_disclaimers ?? [],
      copyGuidelines: parsed.copy_guidelines ?? "",
      reimbursementEstimateUsd: parsed.estimated_reimbursement_usd ?? 0,
      coopContext,
      tokensUsed,
      agentRunId: runRecord?.id ?? "unknown",
    };

    if (runRecord) {
      await supabase.from("agent_runs").update({
        status: "completed",
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        duration_ms: Date.now() - startedAt,
        output_summary: eligiblePrograms.length > 0
          ? `${eligiblePrograms.length} eligible: ${eligiblePrograms.map((p) => p.program_name).join(", ")} — est. reimb. $${out.reimbursementEstimateUsd.toFixed(0)}`
          : "No eligible co-op programs for this campaign",
        completed_at: new Date().toISOString(),
      }).eq("id", runRecord.id);
    }

    return out;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (runRecord) {
      await supabase.from("agent_runs").update({
        status: "failed",
        error: errMsg,
        duration_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      }).eq("id", runRecord.id);
    }
    // Non-fatal — return empty result so campaign can proceed without co-op
    return {
      eligible: false, programs: [], requiredDisclaimers: [], copyGuidelines: "",
      reimbursementEstimateUsd: 0, coopContext: "", tokensUsed: 0,
      agentRunId: runRecord?.id ?? "unknown",
    };
  }
}
