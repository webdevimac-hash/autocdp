/**
 * Data Agent — Analyzes customer records and visit history.
 * Responsibilities: segmentation insights, churn risk scoring, lifetime value estimation.
 */
import { getAnthropicClient, MODELS } from "../client";
import type { Customer, Visit, AgentContext } from "@/types";

export interface DataAgentInput {
  context: AgentContext;
  customers: Customer[];
  recentVisits: Visit[];
  question?: string;
}

export interface DataAgentOutput {
  insights: string;
  segmentSummary: {
    vip: number;
    active: number;
    atRisk: number;
    lapsed: number;
  };
  churnRiskCustomerIds: string[];
  topRecommendations: string[];
  tokensUsed: number;
}

export async function runDataAgent(input: DataAgentInput): Promise<DataAgentOutput> {
  const client = getAnthropicClient();

  const customerSummary = input.customers.slice(0, 50).map((c) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    lifecycle_stage: c.lifecycle_stage,
    total_visits: c.total_visits,
    total_spend: c.total_spend,
    last_visit_date: c.last_visit_date,
    tags: c.tags,
  }));

  const systemPrompt = `You are the Data Agent for AutoCDP, an AI-powered Customer Data Platform for auto dealerships.

Your role is to analyze customer data and extract actionable insights for ${input.context.dealershipName}.
Focus on:
1. Customer lifecycle stage distribution and trends
2. Churn risk signals (customers overdue for service)
3. Revenue concentration and VIP identification
4. Seasonal patterns in service visits

Return structured JSON matching the DataAgentOutput interface.
Be concise and data-driven. Always include specific customer IDs for churn risk.`;

  const userPrompt = `Analyze this customer dataset for ${input.context.dealershipName}:

CUSTOMERS (${input.customers.length} total, showing first 50):
${JSON.stringify(customerSummary, null, 2)}

RECENT VISITS (last 30 days, ${input.recentVisits.length} total):
${JSON.stringify(input.recentVisits.slice(0, 20), null, 2)}

${input.question ? `SPECIFIC QUESTION: ${input.question}` : ""}

Respond with JSON:
{
  "insights": "narrative summary of key findings",
  "segmentSummary": {"vip": 0, "active": 0, "atRisk": 0, "lapsed": 0},
  "churnRiskCustomerIds": ["id1", "id2"],
  "topRecommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`;

  const response = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Data Agent");

  // Extract JSON from response (model may wrap in markdown)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Data Agent did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    ...parsed,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}
