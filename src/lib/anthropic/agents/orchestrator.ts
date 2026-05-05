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
import { runCoopAgent, type CoopAgentOutput } from "./coop-agent";
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
import { matchCustomersToVehicles, formatAssignedVehicleForPrompt } from "@/lib/aged-inventory";
import { loadBaselineExamples } from "@/lib/anthropic/baseline";
import { loadDealershipMemories, formatMemoriesForPrompt } from "@/lib/memories";
import { loadDealershipInsights, formatInsightsForPrompt } from "@/lib/insights";
import type {
  AgentContext, Customer, Visit, CampaignChannel, CampaignType,
  InventoryVehicle, AgedInventoryMatch,
  SendDirectMailToolInput, SendDirectMailToolResult, DesignStyle,
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

    const [customersRes, dealershipRes, baselineExamples, dealershipInsightsRaw] = await Promise.all([
      supabase.from("customers").select("*").eq("dealership_id", input.context.dealershipId).order("last_visit_date", { ascending: false }).limit(200),
      supabase.from("dealerships").select("phone, address, hours, logo_url, website_url, settings").eq("id", input.context.dealershipId).single(),
      loadBaselineExamples(input.context.dealershipId),
      loadDealershipInsights(input.context.dealershipId),
    ]);
    const insightsContext = formatInsightsForPrompt(dealershipInsightsRaw);
    const customers = customersRes.data;
    const dealershipRaw = dealershipRes.data ?? undefined;
    const dealershipProfile = dealershipRaw
      ? { ...dealershipRaw, xtimeUrl: (dealershipRaw as Record<string, unknown>).settings?.xtime_url as string | null ?? null }
      : undefined;

    const { data: recentVisits } = await supabase
      .from("visits")
      .select("*")
      .eq("dealership_id", input.context.dealershipId)
      .gte("visit_date", new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString())
      .order("visit_date", { ascending: false })
      .limit(500);

    if (!customers?.length) throw new Error("No customers found for this dealership");

    const dataOutput = await runDataAgent({
      context: input.context,
      customers: customers as Customer[],
      recentVisits: (recentVisits ?? []) as Visit[],
      dealershipInsights: insightsContext,
    });
    totalTokens += dataOutput.tokensUsed;

    const targetingOutput = await runTargetingAgent({
      context: input.context,
      campaignGoal: input.campaignGoal,
      channel: input.channel,
      totalCustomers: customers.length,
      segmentStats: dataOutput.segmentSummary,
      dealershipInsights: insightsContext,
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
        dealershipProfile,
        baselineExamples,
        dealershipInsights: insightsContext,
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
  customerIds: string[];
  dealershipTone?: string;
  dryRun?: boolean;
  isTest?: boolean;
  createdBy?: string;
  includeProspects?: boolean;
  campaignType?: CampaignType;
  includeBookNow?: boolean;
  designStyle?: DesignStyle;
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
    // Load the selected customers + their most recent visits + dealership profile + baseline
    const [{ data: customers }, { data: dealershipProfile }, dmBaselineExamples, dealerMemories, dmInsightsRaw] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .in("id", input.customerIds)
        .eq("dealership_id", input.context.dealershipId),
      supabase
        .from("dealerships")
        .select("phone, address, hours, website_url, logo_url, settings")
        .eq("id", input.context.dealershipId)
        .single() as Promise<{ data: { phone?: string | null; address?: Record<string, string> | null; hours?: Record<string, string> | null; website_url?: string | null; logo_url?: string | null; settings?: Record<string, unknown> | null } | null }>,
      loadBaselineExamples(input.context.dealershipId),
      loadDealershipMemories(input.context.dealershipId),
      loadDealershipInsights(input.context.dealershipId),
    ]);
    const dmInsightsContext = formatInsightsForPrompt(dmInsightsRaw);

    const xtimeUrl = (dealershipProfile?.settings?.xtime_url as string | undefined) ?? null;

    if (!customers?.length) throw new Error("No valid customers found");

    const dealershipContactLines = [
      dealershipProfile?.phone ? `Phone: ${dealershipProfile.phone}` : null,
      dealershipProfile?.address?.street
        ? `Address: ${[dealershipProfile.address.street, dealershipProfile.address.city, dealershipProfile.address.state, dealershipProfile.address.zip].filter(Boolean).join(", ")}`
        : null,
      dealershipProfile?.hours
        ? `Hours: ${Object.entries(dealershipProfile.hours).slice(0, 4).map(([d, h]) => `${d}: ${h}`).join(", ")}`
        : null,
      dealershipProfile?.website_url ? `Website: ${dealershipProfile.website_url}` : null,
    ].filter(Boolean);
    const dealershipContactSection = dealershipContactLines.length
      ? `\nDEALERSHIP CONTACT (use in CTAs when relevant):\n${dealershipContactLines.join("\n")}\n`
      : "";

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

    // ── Aged inventory matching ───────────────────────────────
    let vehicleAssignments: Map<string, AgedInventoryMatch> | null = null;
    if (input.campaignType === "aged_inventory") {
      const { data: agedVehicles } = await supabase
        .from("inventory")
        .select("id, dealership_id, vin, year, make, model, trim, color, mileage, condition, price, days_on_lot, status, metadata, created_at, updated_at")
        .eq("dealership_id", input.context.dealershipId)
        .eq("status", "available")
        .gte("days_on_lot", 45)
        .order("days_on_lot", { ascending: false })
        .limit(50) as unknown as { data: InventoryVehicle[] | null };

      if (agedVehicles?.length) {
        vehicleAssignments = matchCustomersToVehicles(
          filteredCustomers,
          (visits ?? []) as Visit[],
          agedVehicles
        );
        console.info(`[direct-mail-orchestrator] Aged inventory: ${agedVehicles.length} vehicles, ${vehicleAssignments.size} customers matched`);
      }
    }

    // ── Co-op eligibility check ───────────────────────────────
    let coopOutput: CoopAgentOutput | null = null;
    if (input.campaignType === "coop") {
      const estCost = filteredCustomers.length * 1.35;
      coopOutput = await runCoopAgent({
        context: input.context,
        channel: "direct_mail",
        campaignGoal: input.campaignGoal,
        recipientCount: filteredCustomers.length,
        estimatedCostUsd: estCost,
      });
      totalTokens += coopOutput.tokensUsed;
      if (coopOutput.eligible) {
        console.info(`[direct-mail-orchestrator] Co-op: ${coopOutput.programs.length} program(s), est. reimb. $${coopOutput.reimbursementEstimateUsd.toFixed(0)}`);
      }
    }

    const results: DirectMailResult[] = [];

    // Process each customer — each gets its own tool-use conversation
    for (const customer of filteredCustomers) {
      const lastVisit = visitsByCustomer.get(customer.id);
      const visitContext = lastVisit
        ? `Last visit: ${lastVisit.visit_date?.slice(0, 10)} | Vehicle: ${[lastVisit.year, lastVisit.make, lastVisit.model].filter(Boolean).join(" ")} | Mileage: ${lastVisit.mileage?.toLocaleString() ?? "unknown"} | Service: ${lastVisit.service_type ?? "general"} | Notes: ${lastVisit.service_notes ?? "none"}`
        : "No previous visits recorded.";

      const vehicleMatch = vehicleAssignments?.get(customer.id);
      const agedVehicleNote = vehicleMatch
        ? `\n\n${formatAssignedVehicleForPrompt(vehicleMatch)}`
        : "";

      const bookNowSystemNote = input.includeBookNow && xtimeUrl
        ? `\nBOOK NOW (X-Time): Include this scheduling URL naturally in your CTA: ${xtimeUrl}\n` +
          `Anchor text: "Book your appointment online" or "Schedule now".\n`
        : "";

      const disclaimerNote =
        `\nDO NOT write any opt-out, unsubscribe, STOP, or legal disclaimer text — appended automatically after send.\n`;

      const dealerMemoriesSection = formatMemoriesForPrompt(dealerMemories);

      const dmBaselineSection = dmBaselineExamples.length > 0
        ? `\nDEALERSHIP STYLE GUIDELINES — mirror the tone, length, and structure of these past mail pieces:\n\n` +
          dmBaselineExamples.slice(0, 8).map((ex, i) => {
            const typeTag = ex.mail_type ? ` [${ex.mail_type}]` : "";
            return `Example ${i + 1}${typeTag}:\n"""\n${ex.example_text.trim()}\n"""`;
          }).join("\n\n") + `\n`
        : "";

      const designStyleNote = input.designStyle && input.designStyle !== "standard"
        ? `\nDESIGN STYLE: ${input.designStyle}\n` +
          (input.designStyle === "multi-panel"
            ? `This is a multi-panel postcard with a hero image zone and a message panel. Write bold headline copy + a concise personal message + a strong CTA.\n`
            : input.designStyle === "premium-fluorescent"
            ? `This is a premium fluorescent design with dark background and neon accents. Write a punchy bold headline + short impactful message. Use high-energy language.\n`
            : input.designStyle === "complex-fold"
            ? `This is a tri-fold letter. Write a compelling cover headline, a personal story/service reminder for the inner-left panel, and a clear offer + CTA for the inner-right panel. Separate sections with --- delimiters.\n`
            : "")
        : "";

      const systemPrompt =
        `You are the AutoCDP Orchestrator for ${input.context.dealershipName}.\n` +
        `You have one tool available: send_direct_mail.\n\n` +
        `Your task:\n` +
        `1. Write personalized ${input.templateType} copy for this customer based on their visit history.\n` +
        `2. Call send_direct_mail with the copy and appropriate variables.\n` +
        `3. Report the result.\n\n` +
        `Tone: ${input.dealershipTone ?? "friendly and professional"}\n` +
        `Template: ${input.templateType}\n` +
        (input.dryRun ? `⚠ DRY RUN MODE: Generate copy and call the tool, but note this is a simulation.\n` : "") +
        (input.campaignType === "aged_inventory"
          ? `\nCAMPAIGN TYPE: Aged Inventory — move specific vehicles that have been on the lot 45+ days.\n`
          : input.campaignType === "coop" && coopOutput?.coopContext
          ? coopOutput.coopContext
          : "") +
        dealershipContactSection +
        dmBaselineSection +
        dealerMemoriesSection +
        dmInsightsContext +
        bookNowSystemNote +
        disclaimerNote +
        designStyleNote +
        `\nPostcard guidelines (50–100 words, warm, personal, ends with soft CTA):\n` +
        `- Reference specific vehicle or service if known\n` +
        `- Include a clear offer or reason to return\n` +
        `- Sign off naturally\n\n` +
        `Letter guidelines (150–250 words, conversational business letter format):\n` +
        `- Formal but warm opening\n` +
        `- Reference service history specifically\n` +
        `- Make an offer or invitation\n` +
        `- Include next steps` +
        agedVehicleNote;

      const userMessage =
        `Generate and send a personalized ${input.templateType} for:\n\n` +
        `CUSTOMER: ${customer.first_name} ${customer.last_name}\n` +
        `CUSTOMER ID: ${customer.id}\n` +
        `LIFECYCLE: ${customer.lifecycle_stage} | VISITS: ${customer.total_visits} | TOTAL SPEND: $${customer.total_spend.toFixed(0)}\n` +
        `${visitContext}\n\n` +
        `CAMPAIGN GOAL: ${input.campaignGoal}\n` +
        (vehicleMatch
          ? `\nAGED VEHICLE TO REFERENCE: ${[vehicleMatch.vehicle.year, vehicleMatch.vehicle.make, vehicleMatch.vehicle.model, vehicleMatch.vehicle.trim].filter(Boolean).join(" ")} — ${vehicleMatch.vehicle.days_on_lot} days on lot${vehicleMatch.vehicle.price ? ` — $${Number(vehicleMatch.vehicle.price).toLocaleString()}` : ""}\n` +
            `Match basis: ${vehicleMatch.matchReasons.join(", ")}\n`
          : "") +
        `\nWrite the personalized copy, choose appropriate variables, then call send_direct_mail.`;

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
                designStyle: input.designStyle,
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
  includeProspects?: boolean;
  campaignType?: CampaignType;
  includeBookNow?: boolean;
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
    const [{ data: customers }, { data: omnichannelDealershipProfile }, omniBaselineExamples, omniInsightsRaw] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .in("id", input.customerIds)
        .eq("dealership_id", input.context.dealershipId),
      supabase
        .from("dealerships")
        .select("phone, address, hours, website_url, settings")
        .eq("id", input.context.dealershipId)
        .single() as Promise<{ data: { phone?: string | null; address?: Record<string, string> | null; hours?: Record<string, string> | null; website_url?: string | null; settings?: Record<string, unknown> | null } | null }>,
      loadBaselineExamples(input.context.dealershipId),
      loadDealershipInsights(input.context.dealershipId),
    ]);
    const omniInsightsContext = formatInsightsForPrompt(omniInsightsRaw);

    const omnichannelXtimeUrl = (omnichannelDealershipProfile?.settings?.xtime_url as string | undefined) ?? null;

    if (!customers?.length) throw new Error("No valid customers found");

    const omnichannelContactLines = [
      omnichannelDealershipProfile?.phone ? `Phone: ${omnichannelDealershipProfile.phone}` : null,
      omnichannelDealershipProfile?.address?.street
        ? `Address: ${[omnichannelDealershipProfile.address.street, omnichannelDealershipProfile.address.city, omnichannelDealershipProfile.address.state, omnichannelDealershipProfile.address.zip].filter(Boolean).join(", ")}`
        : null,
      omnichannelDealershipProfile?.hours
        ? `Hours: ${Object.entries(omnichannelDealershipProfile.hours).slice(0, 4).map(([d, h]) => `${d}: ${h}`).join(", ")}`
        : null,
      omnichannelDealershipProfile?.website_url ? `Website: ${omnichannelDealershipProfile.website_url}` : null,
    ].filter(Boolean);
    const omnichannelContactSection = omnichannelContactLines.length
      ? `\nDEALERSHIP CONTACT (use in CTAs when relevant):\n${omnichannelContactLines.join("\n")}\n`
      : "";

    // Deterministic pre-filter: skip low-signal customers before agent calls
    const { customers: filteredCustomers, filtered: preFiltered } =
      filterAndRankCustomers(customers as Customer[], SCORE_THRESHOLD, !input.includeProspects);
    if (preFiltered > 0) {
      console.info(`[omnichannel-orchestrator] Pre-filter removed ${preFiltered} low-score customers`);
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

    // ── Aged inventory matching ───────────────────────────────
    let omnichannelVehicleAssignments: Map<string, AgedInventoryMatch> | null = null;
    if (input.campaignType === "aged_inventory") {
      const { data: agedVehicles } = await supabase
        .from("inventory")
        .select("id, dealership_id, vin, year, make, model, trim, color, mileage, condition, price, days_on_lot, status, metadata, created_at, updated_at")
        .eq("dealership_id", input.context.dealershipId)
        .eq("status", "available")
        .gte("days_on_lot", 45)
        .order("days_on_lot", { ascending: false })
        .limit(50) as unknown as { data: InventoryVehicle[] | null };

      if (agedVehicles?.length) {
        omnichannelVehicleAssignments = matchCustomersToVehicles(
          filteredCustomers,
          (visits ?? []) as Visit[],
          agedVehicles
        );
        console.info(`[omnichannel-orchestrator] Aged inventory: ${agedVehicles.length} vehicles, ${omnichannelVehicleAssignments.size} customers matched`);
      }
    }

    // ── Co-op eligibility check ───────────────────────────────
    let omnichannelCoopOutput: CoopAgentOutput | null = null;
    if (input.campaignType === "coop") {
      const primaryChannel = input.channels.find((ch) => ch !== "multi_channel") ?? input.channels[0] ?? "email";
      const estCost = filteredCustomers.length * (primaryChannel === "direct_mail" ? 1.35 : 0.02);
      omnichannelCoopOutput = await runCoopAgent({
        context: input.context,
        channel: primaryChannel,
        campaignGoal: input.campaignGoal,
        recipientCount: filteredCustomers.length,
        estimatedCostUsd: estCost,
      });
      totalTokens += omnichannelCoopOutput.tokensUsed;
      if (omnichannelCoopOutput.eligible) {
        console.info(`[omnichannel-orchestrator] Co-op: ${omnichannelCoopOutput.programs.length} program(s), est. reimb. $${omnichannelCoopOutput.reimbursementEstimateUsd.toFixed(0)}`);
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

      const omnichannelVehicleMatch = omnichannelVehicleAssignments?.get(customer.id);
      const agedVehicleSystemNote = omnichannelVehicleMatch
        ? `\n${formatAssignedVehicleForPrompt(omnichannelVehicleMatch)}\n`
        : "";

      const channelNote = input.channels.includes("multi_channel")
        ? "You have access to send_sms, send_email, and send_direct_mail. Choose the best channel for this customer."
        : `Use the ${input.channels.join(" or ")} channel(s) available to you.`;

      const omnichannelBookNowNote = input.includeBookNow && omnichannelXtimeUrl
        ? `\nBOOK NOW (X-Time): Include this scheduling URL naturally in CTAs: ${omnichannelXtimeUrl}\n`
        : "";

      const omnichannelDisclaimerNote =
        `\nDO NOT write opt-out, STOP, unsubscribe, or legal disclaimer text — appended automatically.\n`;

      const omniBaselineSection = omniBaselineExamples.length > 0
        ? `\nDEALERSHIP STYLE GUIDELINES — mirror tone and structure from these past pieces:\n\n` +
          omniBaselineExamples.slice(0, 8).map((ex, i) => {
            const typeTag = ex.mail_type ? ` [${ex.mail_type}]` : "";
            return `Example ${i + 1}${typeTag}:\n"""\n${ex.example_text.trim()}\n"""`;
          }).join("\n\n") + `\n`
        : "";

      const systemPrompt =
        `You are the AutoCDP Orchestrator for ${input.context.dealershipName}.\n` +
        `Available tools: ${tools.map((t) => t.name).join(", ")}.\n` +
        `${channelNote}\n` +
        `Tone: ${input.dealershipTone ?? "friendly and professional"}\n` +
        (input.dryRun ? `⚠ DRY RUN MODE: Generate copy and call the tool — this is a simulation.\n` : "") +
        (input.campaignType === "aged_inventory"
          ? `CAMPAIGN TYPE: Aged Inventory — move specific vehicles that have been on lot 45+ days.\n`
          : input.campaignType === "coop" && omnichannelCoopOutput?.coopContext
          ? omnichannelCoopOutput.coopContext
          : "") +
        omnichannelContactSection +
        omniBaselineSection +
        omniInsightsContext +
        omnichannelBookNowNote +
        omnichannelDisclaimerNote +
        agedVehicleSystemNote +
        `\nPer-channel guidelines:\n` +
        `- SMS: Max 160 chars, first name, soft CTA, no HTML\n` +
        `- Email: Subject + HTML body, 2–3 short paragraphs, clear CTA\n` +
        `- Direct mail: Warm 50–120 word note, specific vehicle/service reference`;

      const userMessage =
        `Send a personalized outreach to:\n\n` +
        `CUSTOMER: ${customer.first_name} ${customer.last_name} (ID: ${customer.id})\n` +
        `LIFECYCLE: ${customer.lifecycle_stage} | VISITS: ${customer.total_visits} | SPEND: $${customer.total_spend.toFixed(0)}\n` +
        `${visitContext}\n\n` +
        `CAMPAIGN GOAL: ${input.campaignGoal}\n` +
        `TEMPLATE TYPE (for mail): ${input.templateType ?? "postcard_6x9"}\n` +
        (omnichannelVehicleMatch
          ? `\nAGED VEHICLE TO REFERENCE: ${[omnichannelVehicleMatch.vehicle.year, omnichannelVehicleMatch.vehicle.make, omnichannelVehicleMatch.vehicle.model, omnichannelVehicleMatch.vehicle.trim].filter(Boolean).join(" ")} — ${omnichannelVehicleMatch.vehicle.days_on_lot} days on lot${omnichannelVehicleMatch.vehicle.price ? ` — $${Number(omnichannelVehicleMatch.vehicle.price).toLocaleString()}` : ""}\n` +
            `Match basis: ${omnichannelVehicleMatch.matchReasons.join(", ")}\n`
          : "") +
        `\nGenerate personalized copy and call the appropriate tool(s).`;

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
