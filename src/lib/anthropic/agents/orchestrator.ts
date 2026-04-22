/**
 * Orchestration Agent — Coordinates the 5-agent swarm for end-to-end campaign creation.
 *
 * Two execution modes:
 *   runOrchestrator()          — Original mode: generates preview messages (no mail sent).
 *                                Used by /api/agents/test.
 *   runDirectMailOrchestrator() — Tool-use mode: Claude calls send_direct_mail per customer.
 *                                Used by /api/mail/send for real campaign execution.
 */
import { getAnthropicClient, MODELS } from "../client";
import { runDataAgent } from "./data-agent";
import { runTargetingAgent } from "./targeting-agent";
import { runCreativeAgent } from "./creative-agent";
import { runOptimizationAgent } from "./optimization-agent";
import {
  SEND_DIRECT_MAIL_TOOL_DEFINITION,
  executeSendDirectMailTool,
} from "../tools/send-direct-mail";
import {
  SEND_SMS_TOOL_DEFINITION,
  executeSendSmsTool,
  type SendSmsToolInput,
  type SendSmsToolResult,
} from "../tools/send-sms";
import {
  SEND_EMAIL_TOOL_DEFINITION,
  executeSendEmailTool,
  type SendEmailToolInput,
  type SendEmailToolResult,
} from "../tools/send-email";
import { createServiceClient } from "@/lib/supabase/server";
import { filterAndRankCustomers, SCORE_THRESHOLD } from "@/lib/scoring";
import type {
  AgentContext, Customer, Visit, CampaignChannel,
  SendDirectMailToolInput, SendDirectMailToolResult,
} from "@/types";

// ── Original orchestrator (preview only, no mail sent) ────────

export interface OrchestratorInput {
  context: AgentContext;
  campaignGoal: string;
  channel: CampaignChannel;
  dealershipTone?: string;
  maxCustomers?: number;
}

export interface OrchestratorOutput {
  agentRunId: string;
  dataInsights: string;
  targetedCount: number;
  messagesGenerated: number;
  totalTokensUsed: number;
  estimatedCostUsd: number;
  previewMessages: Array<{
    customerName: string;
    channel: CampaignChannel;
    subject?: string;
    content: string;
    confidence: number;
  }>;
  status: "completed" | "partial" | "failed";
  error?: string;
}

export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const supabase = createServiceClient();
  const client = getAnthropicClient();
  const startedAt = Date.now();
  let totalTokens = 0;

  const { data: runRecord } = await supabase
    .from("agent_runs")
    .insert({
      dealership_id: input.context.dealershipId,
      campaign_id: input.context.campaignId ?? null,
      agent_type: "orchestrator",
      status: "running",
      input_summary: `Goal: ${input.campaignGoal} | Channel: ${input.channel}`,
    })
    .select()
    .single();

  try {
    const planResponse = await client.messages.create({
      model: MODELS.powerful,
      max_tokens: 512,
      system: `You are the Orchestrator for AutoCDP's 5-agent swarm. Plan the campaign execution sequence.
Coordinate: Data Agent → Targeting Agent → Creative Agent (per customer) → Optimization Agent (post-send).`,
      messages: [{
        role: "user",
        content: `Plan execution for: ${input.campaignGoal} via ${input.channel} for ${input.context.dealershipName}.
Output JSON: {"plan": "summary", "priority_segments": ["segment1"], "risk_flags": []}`,
      }],
    });
    totalTokens += planResponse.usage.input_tokens + planResponse.usage.output_tokens;

    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .eq("dealership_id", input.context.dealershipId)
      .order("last_visit_date", { ascending: false })
      .limit(200);

    const { data: recentVisits } = await supabase
      .from("visits")
      .select("*")
      .eq("dealership_id", input.context.dealershipId)
      .gte("visit_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("visit_date", { ascending: false })
      .limit(100);

    if (!customers?.length) throw new Error("No customers found for this dealership");

    const dataOutput = await runDataAgent({
      context: input.context,
      customers: customers as Customer[],
      recentVisits: (recentVisits ?? []) as Visit[],
    });
    totalTokens += dataOutput.tokensUsed;

    const targetingOutput = await runTargetingAgent({
      context: input.context,
      campaignGoal: input.campaignGoal,
      channel: input.channel,
      totalCustomers: customers.length,
      segmentStats: dataOutput.segmentSummary,
    });
    totalTokens += targetingOutput.tokensUsed;

    const maxToProcess = Math.min(input.maxCustomers ?? 5, customers.length);
    const targetedCustomers = customers.slice(0, maxToProcess) as Customer[];
    const previewMessages = [];

    for (const customer of targetedCustomers) {
      const lastVisit = (recentVisits ?? []).find(
        (v) => v.customer_id === customer.id
      ) as Visit | undefined;

      const creative = await runCreativeAgent({
        context: input.context,
        customer,
        recentVisit: lastVisit ?? null,
        channel: input.channel === "multi_channel" ? "email" : input.channel,
        campaignGoal: input.campaignGoal,
        dealershipTone: input.dealershipTone,
      });
      totalTokens += creative.tokensUsed;

      previewMessages.push({
        customerName: `${customer.first_name} ${customer.last_name}`,
        channel: creative.channel,
        subject: creative.subject,
        content: creative.content,
        confidence: creative.confidence,
      });
    }

    await supabase.from("billing_events").insert({
      dealership_id: input.context.dealershipId,
      event_type: "agent_run",
      quantity: 1,
      unit_cost_cents: Math.ceil(totalTokens * 0.003),
      metadata: { agent: "orchestrator", tokens: totalTokens },
    });

    if (runRecord) {
      await supabase.from("agent_runs").update({
        status: "completed",
        input_tokens: Math.floor(totalTokens * 0.6),
        output_tokens: Math.floor(totalTokens * 0.4),
        duration_ms: Date.now() - startedAt,
        output_summary: `Targeted ${targetedCustomers.length} customers, generated ${previewMessages.length} messages`,
        completed_at: new Date().toISOString(),
      }).eq("id", runRecord.id);
    }

    return {
      agentRunId: runRecord?.id ?? "unknown",
      dataInsights: dataOutput.insights,
      targetedCount: targetedCustomers.length,
      messagesGenerated: previewMessages.length,
      totalTokensUsed: totalTokens,
      estimatedCostUsd: (totalTokens / 1_000_000) * 3.0,
      previewMessages,
      status: "completed",
    };
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
    return {
      agentRunId: runRecord?.id ?? "unknown",
      dataInsights: "",
      targetedCount: 0,
      messagesGenerated: 0,
      totalTokensUsed: totalTokens,
      estimatedCostUsd: 0,
      previewMessages: [],
      status: "failed",
      error: errMsg,
    };
  }
}

// ── Direct Mail Orchestrator (tool-use mode) ──────────────────
// Uses Anthropic's tool use API so Claude can call send_direct_mail
// in a proper multi-turn agentic loop.

export interface DirectMailOrchestratorInput {
  context: AgentContext;
  campaignGoal: string;
  templateType: "postcard_6x9" | "letter_6x9" | "letter_8.5x11";
  customerIds: string[];          // pre-filtered list of customers to mail
  dealershipTone?: string;
  dryRun?: boolean;               // if true: generate copy but skip PostGrid call
  isTest?: boolean;               // if true: marks mail_pieces rows with is_test = true
  createdBy?: string;
  /** When true, skips the score threshold so prospect/lead customers are included. */
  includeProspects?: boolean;
}

export interface DirectMailResult {
  customerId: string;
  customerName: string;
  result: SendDirectMailToolResult;
  generatedCopy: string;
}

export interface DirectMailOrchestratorOutput {
  agentRunId: string;
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  results: DirectMailResult[];
  totalTokensUsed: number;
  estimatedMailCostUsd: number;
  estimatedAiCostUsd: number;
  status: "completed" | "partial" | "failed";
  error?: string;
}

export async function runDirectMailOrchestrator(
  input: DirectMailOrchestratorInput
): Promise<DirectMailOrchestratorOutput> {
  const supabase = createServiceClient();
  const client = getAnthropicClient();
  const startedAt = Date.now();
  let totalTokens = 0;

  const { data: runRecord } = await supabase
    .from("agent_runs")
    .insert({
      dealership_id: input.context.dealershipId,
      campaign_id: input.context.campaignId ?? null,
      agent_type: "orchestrator",
      status: "running",
      input_summary: `Direct mail: ${input.campaignGoal} | ${input.customerIds.length} customers | ${input.templateType}${input.dryRun ? " [DRY RUN]" : ""}`,
    })
    .select()
    .single();

  try {
    // Load the selected customers + their most recent visits
    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .in("id", input.customerIds)
      .eq("dealership_id", input.context.dealershipId);

    if (!customers?.length) throw new Error("No valid customers found");

    // Deterministic pre-filter: skip low-signal customers before agent calls.
    // includeProspects bypasses the threshold for lead/prospect-only campaigns
    // where scoring has no signal (total_visits=0, lifecycle_stage="prospect").
    const { customers: filteredCustomers, filtered: preFiltered } =
      filterAndRankCustomers(customers as Customer[], SCORE_THRESHOLD, !input.includeProspects);
    if (preFiltered > 0) {
      console.info(`[direct-mail-orchestrator] Pre-filter removed ${preFiltered} low-score customers`);
    }
    if (!filteredCustomers.length) {
      throw new Error(
        input.includeProspects
          ? "No valid customers found"
          : "All selected customers scored below threshold — use includeProspects:true for lead campaigns"
      );
    }

    const { data: visits } = await supabase
      .from("visits")
      .select("*")
      .in("customer_id", filteredCustomers.map((c) => c.id))
      .eq("dealership_id", input.context.dealershipId)
      .order("visit_date", { ascending: false });

    const visitsByCustomer = new Map<string, Visit>();
    for (const v of visits ?? []) {
      if (!visitsByCustomer.has(v.customer_id)) {
        visitsByCustomer.set(v.customer_id, v as Visit);
      }
    }

    const results: DirectMailResult[] = [];

    // Process each customer — each gets its own tool-use conversation
    for (const customer of filteredCustomers) {
      const lastVisit = visitsByCustomer.get(customer.id);
      const visitContext = lastVisit
        ? `Last visit: ${lastVisit.visit_date?.slice(0, 10)} | Vehicle: ${[lastVisit.year, lastVisit.make, lastVisit.model].filter(Boolean).join(" ")} | Mileage: ${lastVisit.mileage?.toLocaleString() ?? "unknown"} | Service: ${lastVisit.service_type ?? "general"} | Notes: ${lastVisit.service_notes ?? "none"}`
        : "No previous visits recorded.";

      const systemPrompt = `You are the AutoCDP Orchestrator for ${input.context.dealershipName}.
You have one tool available: send_direct_mail.

Your task:
1. Write personalized ${input.templateType} copy for this customer based on their visit history.
2. Call send_direct_mail with the copy and appropriate variables.
3. Report the result.

Tone: ${input.dealershipTone ?? "friendly and professional"}
Template: ${input.templateType}
${input.dryRun ? "⚠ DRY RUN MODE: Generate copy and call the tool, but note this is a simulation." : ""}

Postcard guidelines (50–100 words, warm, personal, ends with soft CTA):
- Reference specific vehicle or service if known
- Include a clear offer or reason to return
- Sign off naturally

Letter guidelines (150–250 words, conversational business letter format):
- Formal but warm opening
- Reference service history specifically
- Make an offer or invitation
- Include next steps`;

      const userMessage = `Generate and send a personalized ${input.templateType} for:

CUSTOMER: ${customer.first_name} ${customer.last_name}
CUSTOMER ID: ${customer.id}
LIFECYCLE: ${customer.lifecycle_stage} | VISITS: ${customer.total_visits} | TOTAL SPEND: $${customer.total_spend.toFixed(0)}
${visitContext}

CAMPAIGN GOAL: ${input.campaignGoal}

Write the personalized copy, choose appropriate variables, then call send_direct_mail.`;

      // Multi-turn tool-use loop
      let messages: Parameters<typeof client.messages.create>[0]["messages"] = [
        { role: "user", content: userMessage },
      ];
      let generatedCopy = "";
      let toolResult: SendDirectMailToolResult | null = null;
      let iterations = 0;
      const MAX_ITERATIONS = 5;

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        const response = await client.messages.create({
          model: MODELS.standard,
          max_tokens: 1024,
          system: systemPrompt,
          // Dry run: keep the tool available so Claude writes real copy and calls it —
          // the executor below intercepts and simulates rather than calling PostGrid.
          tools: [SEND_DIRECT_MAIL_TOOL_DEFINITION],
          messages,
        });

        totalTokens += response.usage.input_tokens + response.usage.output_tokens;

        // Extract any text content as the generated copy
        for (const block of response.content) {
          if (block.type === "text" && block.text.length > 20) {
            generatedCopy = block.text;
          }
        }

        if (response.stop_reason === "end_turn") {
          // Claude finished without calling the tool (e.g. wrote copy in text form only).
          // For dry runs: treat the text copy as the result so the run shows success.
          // For live runs: flag as an unexpected no-tool-call.
          if (!toolResult) {
            if (input.dryRun && generatedCopy) {
              toolResult = {
                success: true,
                message: `[DRY RUN] Copy generated for ${customer.first_name} ${customer.last_name} (no tool call made)`,
              };
            } else {
              toolResult = {
                success: false,
                message: "Agent completed without calling send_direct_mail",
                error: "NO_TOOL_CALL",
              };
            }
          }
          break;
        }

        if (response.stop_reason === "tool_use") {
          // Find the tool use block
          const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
          const toolResults: Array<{
            type: "tool_result";
            tool_use_id: string;
            content: string;
          }> = [];

          for (const block of toolUseBlocks) {
            if (block.type !== "tool_use") continue;
            if (block.name !== "send_direct_mail") {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ error: "Unknown tool" }),
              });
              continue;
            }

            const toolInput = block.input as SendDirectMailToolInput;

            // In dry-run mode, simulate the result
            if (input.dryRun) {
              toolResult = {
                success: true,
                message: `[DRY RUN] Would send ${toolInput.template_type} to ${customer.first_name} ${customer.last_name}`,
              };
              // Extract generated copy from the tool input
              generatedCopy = toolInput.personalized_text;
            } else {
              toolResult = await executeSendDirectMailTool(toolInput, {
                dealershipId: input.context.dealershipId,
                campaignId: input.context.campaignId,
                createdBy: input.createdBy,
                isTest: input.isTest ?? false,
              });
              if (toolInput.personalized_text) {
                generatedCopy = toolInput.personalized_text;
              }
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(toolResult),
            });
          }

          // Continue the conversation with tool results
          messages = [
            ...messages,
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults },
          ];
        } else {
          // Unexpected stop reason — exit loop
          break;
        }
      }

      results.push({
        customerId: customer.id,
        customerName: `${customer.first_name} ${customer.last_name}`,
        result: toolResult ?? {
          success: false,
          message: "No tool result after max iterations",
          error: "MAX_ITERATIONS",
        },
        generatedCopy,
      });
    }

    // Summarize
    const successCount = results.filter((r) => r.result.success).length;
    const failedCount = results.length - successCount;

    // ── Fire-and-forget Optimization Agent ───────────────────
    // Runs after sends complete without blocking the response.
    // Skipped on dry runs — no real data to learn from.
    if (!input.dryRun && successCount > 0) {
      const successfulPieceIds = results
        .filter((r) => r.result.success && r.result.mail_piece_id)
        .map((r) => r.result.mail_piece_id!);

      void runOptimizationAgent({
        context: input.context,
        mailPieceIds: successfulPieceIds,
      }).catch((err) =>
        console.warn("[orchestrator] post-send optimization failed:", err)
      );
    }

    // Record orchestrator billing event
    await supabase.from("billing_events").insert({
      dealership_id: input.context.dealershipId,
      event_type: "agent_run",
      quantity: 1,
      unit_cost_cents: Math.ceil(totalTokens * 0.003),
      metadata: { agent: "direct_mail_orchestrator", tokens: totalTokens, pieces: successCount },
    });

    if (runRecord) {
      await supabase.from("agent_runs").update({
        status: failedCount === results.length ? "failed" : "completed",
        input_tokens: Math.floor(totalTokens * 0.6),
        output_tokens: Math.floor(totalTokens * 0.4),
        duration_ms: Date.now() - startedAt,
        output_summary: `${successCount}/${results.length} mail pieces sent${input.dryRun ? " (dry run)" : ""}`,
        completed_at: new Date().toISOString(),
      }).eq("id", runRecord.id);
    }

    return {
      agentRunId: runRecord?.id ?? "unknown",
      totalProcessed: results.length,
      successCount,
      failedCount,
      results,
      totalTokensUsed: totalTokens,
      estimatedMailCostUsd: (successCount * 120) / 100,  // $1.20 per piece (approx)
      estimatedAiCostUsd: (totalTokens / 1_000_000) * 3.0,
      status: failedCount === results.length ? "failed" : successCount < results.length ? "partial" : "completed",
    };
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
    return {
      agentRunId: runRecord?.id ?? "unknown",
      totalProcessed: 0,
      successCount: 0,
      failedCount: 0,
      results: [],
      totalTokensUsed: totalTokens,
      estimatedMailCostUsd: 0,
      estimatedAiCostUsd: 0,
      status: "failed",
      error: errMsg,
    };
  }
}

// ── Omnichannel Orchestrator (SMS + Email + Direct Mail) ──────

export type OmnichannelChannel = "sms" | "email" | "direct_mail" | "multi_channel";

export interface OmnichannelOrchestratorInput {
  context: AgentContext;
  campaignGoal: string;
  channels: OmnichannelChannel[];
  customerIds: string[];
  templateType?: "postcard_6x9" | "letter_6x9" | "letter_8.5x11";
  dealershipTone?: string;
  dryRun?: boolean;
  createdBy?: string;
}

export interface OmnichannelResult {
  customerId: string;
  customerName: string;
  channel: string;
  success: boolean;
  communicationId?: string;
  mailPieceId?: string;
  message: string;
  error?: string;
}

export interface OmnichannelOrchestratorOutput {
  agentRunId: string;
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  results: OmnichannelResult[];
  totalTokensUsed: number;
  status: "completed" | "partial" | "failed";
  error?: string;
}

export async function runOmnichannelOrchestrator(
  input: OmnichannelOrchestratorInput
): Promise<OmnichannelOrchestratorOutput> {
  const supabase = createServiceClient();
  const client = getAnthropicClient();
  const startedAt = Date.now();
  let totalTokens = 0;

  const { data: runRecord } = await supabase
    .from("agent_runs")
    .insert({
      dealership_id: input.context.dealershipId,
      campaign_id: input.context.campaignId ?? null,
      agent_type: "orchestrator",
      status: "running",
      input_summary: `Omnichannel: ${input.campaignGoal} | channels: ${input.channels.join(",")} | ${input.customerIds.length} customers${input.dryRun ? " [DRY RUN]" : ""}`,
    })
    .select()
    .single();

  try {
    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .in("id", input.customerIds)
      .eq("dealership_id", input.context.dealershipId);

    if (!customers?.length) throw new Error("No valid customers found");

    // Deterministic pre-filter: skip low-signal customers before agent calls
    const { customers: filteredCustomers, filtered: preFiltered } =
      filterAndRankCustomers(customers as Customer[]);
    if (preFiltered > 0) {
      console.info(`[omnichannel-orchestrator] Pre-filter removed ${preFiltered} low-score customers`);
    }
    if (!filteredCustomers.length) throw new Error("All selected customers scored below threshold");

    const { data: visits } = await supabase
      .from("visits")
      .select("*")
      .in("customer_id", filteredCustomers.map((c) => c.id))
      .eq("dealership_id", input.context.dealershipId)
      .order("visit_date", { ascending: false });

    const visitsByCustomer = new Map<string, Visit>();
    for (const v of visits ?? []) {
      if (!visitsByCustomer.has(v.customer_id)) {
        visitsByCustomer.set(v.customer_id, v as Visit);
      }
    }

    const tools = [];
    if (input.channels.includes("sms") || input.channels.includes("multi_channel")) {
      tools.push(SEND_SMS_TOOL_DEFINITION);
    }
    if (input.channels.includes("email") || input.channels.includes("multi_channel")) {
      tools.push(SEND_EMAIL_TOOL_DEFINITION);
    }
    if (input.channels.includes("direct_mail") || input.channels.includes("multi_channel")) {
      tools.push(SEND_DIRECT_MAIL_TOOL_DEFINITION);
    }

    const results: OmnichannelResult[] = [];

    for (const customer of filteredCustomers) {
      const lastVisit = visitsByCustomer.get(customer.id);
      const visitContext = lastVisit
        ? `Last visit: ${lastVisit.visit_date?.slice(0, 10)} | Vehicle: ${[lastVisit.year, lastVisit.make, lastVisit.model].filter(Boolean).join(" ")} | Service: ${lastVisit.service_type ?? "general"}`
        : "No previous visits.";

      const channelNote = input.channels.includes("multi_channel")
        ? "You have access to send_sms, send_email, and send_direct_mail. Choose the best channel for this customer."
        : `Use the ${input.channels.join(" or ")} channel(s) available to you.`;

      const systemPrompt = `You are the AutoCDP Orchestrator for ${input.context.dealershipName}.
Available tools: ${tools.map((t) => t.name).join(", ")}.
${channelNote}
Tone: ${input.dealershipTone ?? "friendly and professional"}
${input.dryRun ? "⚠ DRY RUN MODE: Generate copy and call the tool — this is a simulation." : ""}

Per-channel guidelines:
- SMS: Max 160 chars, first name, soft CTA, no HTML
- Email: Subject + HTML body, 2–3 short paragraphs, clear CTA
- Direct mail: Warm 50–120 word note, specific vehicle/service reference`;

      const userMessage = `Send a personalized outreach to:

CUSTOMER: ${customer.first_name} ${customer.last_name} (ID: ${customer.id})
LIFECYCLE: ${customer.lifecycle_stage} | VISITS: ${customer.total_visits} | SPEND: $${customer.total_spend.toFixed(0)}
${visitContext}

CAMPAIGN GOAL: ${input.campaignGoal}
TEMPLATE TYPE (for mail): ${input.templateType ?? "postcard_6x9"}

Generate personalized copy and call the appropriate tool(s).`;

      let messages: Parameters<typeof client.messages.create>[0]["messages"] = [
        { role: "user", content: userMessage },
      ];

      let iterations = 0;
      const MAX_ITERATIONS = 5;
      const customerResults: OmnichannelResult[] = [];

      while (iterations < MAX_ITERATIONS) {
        iterations++;

        const response = await client.messages.create({
          model: MODELS.standard,
          max_tokens: 1024,
          system: systemPrompt,
          tools: input.dryRun ? [] : tools,
          messages,
        });

        totalTokens += response.usage.input_tokens + response.usage.output_tokens;

        if (response.stop_reason === "end_turn" || (input.dryRun && iterations === 1)) {
          if (customerResults.length === 0) {
            const textBlock = response.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
            customerResults.push({
              customerId: customer.id,
              customerName: `${customer.first_name} ${customer.last_name}`,
              channel: input.channels[0] ?? "sms",
              success: true,
              message: input.dryRun
                ? `[DRY RUN] ${textBlock?.text?.slice(0, 200) ?? "Copy generated"}`
                : "Agent completed without calling a tool",
              error: input.dryRun ? undefined : "NO_TOOL_CALL",
            });
          }
          break;
        }

        if (response.stop_reason === "tool_use") {
          const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
          const toolResultContents: Array<{
            type: "tool_result";
            tool_use_id: string;
            content: string;
          }> = [];

          for (const block of toolUseBlocks) {
            if (block.type !== "tool_use") continue;
            let toolResultData: Record<string, unknown>;

            if (block.name === "send_sms") {
              const res = await executeSendSmsTool(
                block.input as SendSmsToolInput,
                { dealershipId: input.context.dealershipId, campaignId: input.context.campaignId, createdBy: input.createdBy, dryRun: input.dryRun }
              );
              toolResultData = res;
              customerResults.push({
                customerId: customer.id,
                customerName: `${customer.first_name} ${customer.last_name}`,
                channel: "sms",
                success: res.success,
                communicationId: res.communication_id,
                message: res.message,
                error: res.error,
              });
            } else if (block.name === "send_email") {
              const res = await executeSendEmailTool(
                block.input as SendEmailToolInput,
                { dealershipId: input.context.dealershipId, campaignId: input.context.campaignId, createdBy: input.createdBy, dryRun: input.dryRun }
              );
              toolResultData = res;
              customerResults.push({
                customerId: customer.id,
                customerName: `${customer.first_name} ${customer.last_name}`,
                channel: "email",
                success: res.success,
                communicationId: res.communication_id,
                message: res.message,
                error: res.error,
              });
            } else if (block.name === "send_direct_mail") {
              const res = await executeSendDirectMailTool(
                block.input as SendDirectMailToolInput,
                { dealershipId: input.context.dealershipId, campaignId: input.context.campaignId, createdBy: input.createdBy }
              );
              toolResultData = res;
              customerResults.push({
                customerId: customer.id,
                customerName: `${customer.first_name} ${customer.last_name}`,
                channel: "direct_mail",
                success: res.success,
                mailPieceId: res.mail_piece_id,
                message: res.message,
                error: res.error,
              });
            } else {
              toolResultData = { error: "Unknown tool" };
            }

            toolResultContents.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(toolResultData),
            });
          }

          messages = [
            ...messages,
            { role: "assistant", content: response.content },
            { role: "user", content: toolResultContents },
          ];
        } else {
          break;
        }
      }

      results.push(...customerResults);
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    await supabase.from("billing_events").insert({
      dealership_id: input.context.dealershipId,
      event_type: "agent_run",
      quantity: 1,
      unit_cost_cents: Math.ceil(totalTokens * 0.003),
      metadata: { agent: "omnichannel_orchestrator", tokens: totalTokens, sent: successCount },
    });

    if (runRecord) {
      await supabase.from("agent_runs").update({
        status: failedCount === results.length ? "failed" : "completed",
        input_tokens: Math.floor(totalTokens * 0.6),
        output_tokens: Math.floor(totalTokens * 0.4),
        duration_ms: Date.now() - startedAt,
        output_summary: `${successCount}/${results.length} messages sent across ${input.channels.join(",")}`,
        completed_at: new Date().toISOString(),
      }).eq("id", runRecord.id);
    }

    return {
      agentRunId: runRecord?.id ?? "unknown",
      totalProcessed: results.length,
      successCount,
      failedCount,
      results,
      totalTokensUsed: totalTokens,
      status: failedCount === results.length ? "failed" : successCount < results.length ? "partial" : "completed",
    };
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
    return {
      agentRunId: runRecord?.id ?? "unknown",
      totalProcessed: 0,
      successCount: 0,
      failedCount: 0,
      results: [],
      totalTokensUsed: totalTokens,
      status: "failed",
      error: errMsg,
    };
  }
}
