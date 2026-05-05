/**
 * Data Agent — Analyzes customer records and visit history.
 * Responsibilities: segmentation insights, churn risk scoring, vehicle interest patterns.
 */
import { getAnthropicClient, MODELS } from "../client";
import type { Customer, Visit, AgentContext, CampaignType, InventoryVehicle } from "@/types";

export interface DataAgentInput {
  context: AgentContext;
  customers: Customer[];
  recentVisits: Visit[];
  question?: string;
  campaignType?: CampaignType;
  agedInventory?: InventoryVehicle[];
  /** Pre-formatted insights context from formatInsightsForPrompt() — soft guidance only. */
  dealershipInsights?: string;
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
  vehicleInterestSummary?: string;
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

  // For aged inventory campaigns, extract make/model distribution from visits
  const visitMakeSummary =
    input.campaignType === "aged_inventory" && input.recentVisits.length > 0
      ? (() => {
          const makeCounts: Record<string, number> = {};
          const modelCounts: Record<string, number> = {};
          for (const v of input.recentVisits) {
            if (v.make) makeCounts[v.make] = (makeCounts[v.make] ?? 0) + 1;
            if (v.model) modelCounts[v.model] = (modelCounts[v.model] ?? 0) + 1;
          }
          const topMakes = Object.entries(makeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([m, n]) => `${m} (${n} visits)`);
          const topModels = Object.entries(modelCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([m, n]) => `${m} (${n} visits)`);
          return `Top makes in service history: ${topMakes.join(", ")}\nTop models in service history: ${topModels.join(", ")}`;
        })()
      : null;

  const agedInventorySection =
    input.campaignType === "aged_inventory" && input.agedInventory?.length
      ? `\nAGED INVENTORY (${input.agedInventory.length} vehicles, 45+ days on lot):\n` +
        input.agedInventory
          .slice(0, 10)
          .map((v) =>
            `  • ${[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ")} — ${v.days_on_lot}d on lot, ${v.price ? "$" + Number(v.price).toLocaleString() : "price TBD"}`
          )
          .join("\n")
      : "";

  const systemPrompt =
    `You are the Data Agent for AutoCDP, an AI-powered Customer Data Platform for auto dealerships.\n\n` +
    `Your role is to analyze customer data and extract actionable insights for ${input.context.dealershipName}.\n` +
    (input.dealershipInsights ?? "") +
    `Focus on:\n` +
    `1. Customer lifecycle stage distribution and trends\n` +
    `2. Churn risk signals (customers overdue for service)\n` +
    `3. Revenue concentration and VIP identification\n` +
    `4. Seasonal patterns in service visits\n` +
    (input.campaignType === "aged_inventory"
      ? `5. Vehicle brand/model affinity — which makes/models appear most in service history\n` +
        `6. Match aged inventory to customer vehicle interests\n`
      : "") +
    `\nReturn structured JSON matching the DataAgentOutput interface.\n` +
    `Be concise and data-driven. Always include specific customer IDs for churn risk.`;

  const userPrompt =
    `Analyze this customer dataset for ${input.context.dealershipName}:\n\n` +
    `CUSTOMERS (${input.customers.length} total, showing first 50):\n` +
    JSON.stringify(customerSummary, null, 2) +
    `\n\nRECENT VISITS (last 2 years, ${input.recentVisits.length} total):\n` +
    JSON.stringify(input.recentVisits.slice(0, 20), null, 2) +
    (visitMakeSummary ? `\n\nVEHICLE INTEREST PATTERNS:\n${visitMakeSummary}` : "") +
    agedInventorySection +
    (input.question ? `\n\nSPECIFIC QUESTION: ${input.question}` : "") +
    `\n\nRespond with JSON:\n` +
    `{\n` +
    `  "insights": "narrative summary of key findings",\n` +
    `  "segmentSummary": {"vip": 0, "active": 0, "atRisk": 0, "lapsed": 0},\n` +
    `  "churnRiskCustomerIds": ["id1", "id2"],\n` +
    `  "topRecommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]` +
    (input.campaignType === "aged_inventory"
      ? `,\n  "vehicleInterestSummary": "which makes/models dominate service history and how they align with aged inventory"`
      : "") +
    `\n}`;

  const response = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Data Agent");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Data Agent did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    ...parsed,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}
