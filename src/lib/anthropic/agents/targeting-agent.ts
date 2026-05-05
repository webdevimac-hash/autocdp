/**
 * Targeting Agent — Selects the optimal audience for a campaign.
 * Responsibilities: filter criteria generation, segment sizing, propensity scoring.
 */
import { getAnthropicClient, MODELS } from "../client";
import type { AgentContext, CustomerSegment, CampaignChannel, CampaignType } from "@/types";

export interface TargetingAgentInput {
  context: AgentContext;
  campaignGoal: string;
  channel: CampaignChannel;
  totalCustomers: number;
  segmentStats: {
    vip: number;
    active: number;
    atRisk: number;
    lapsed: number;
  };
  globalLearnings?: string[];
  campaignType?: CampaignType;
  /** Pre-formatted insights context from formatInsightsForPrompt() — soft guidance only. */
  dealershipInsights?: string;
  agedInventoryStats?: {
    totalAgedVehicles: number;
    avgDaysOnLot: number;
    topMakes: string[];
    matchedCustomers: number;
  };
}

export interface TargetingAgentOutput {
  segment: CustomerSegment;
  rationale: string;
  estimatedResponseRate: number;
  suggestedTiming: string;
  tokensUsed: number;
}

export async function runTargetingAgent(
  input: TargetingAgentInput
): Promise<TargetingAgentOutput> {
  const client = getAnthropicClient();

  const isAgedInventory = input.campaignType === "aged_inventory";

  const systemPrompt =
    `You are the Targeting Agent for AutoCDP. Your job is to select the optimal ` +
    `customer audience for marketing campaigns at auto dealerships.\n\n` +
    `You understand automotive customer behavior:\n` +
    `- Oil change intervals: every 3–6 months (3,000–7,500 miles)\n` +
    `- Major service: annually\n` +
    `- At-risk customers: 6–18 months since last visit\n` +
    `- Lapsed customers: 18+ months since last visit\n` +
    (isAgedInventory
      ? `\nAGED INVENTORY CAMPAIGN RULES:\n` +
        `- Target customers whose service history matches the aged vehicle makes/models\n` +
        `- Prioritize active and at-risk customers (they still visit, so they trust the dealer)\n` +
        `- Include lapsed customers only if they have strong make/model alignment\n` +
        `- Aged inventory campaigns have higher urgency — vehicles 45+ days on lot need to move\n` +
        `- Expected response rate is higher (12–22%) when vehicle matches customer history\n`
      : "") +
    `\nChannel-specific rules:\n` +
    `- SMS: high-intent, short messages, immediate response expected — use sparingly\n` +
    `- Email: nurture sequences, promotions, newsletters\n` +
    `- Direct mail: high-value, tactile — best for VIP and lapsed recovery\n` +
    `- Multi-channel: coordinated across all three\n\n` +
    `Always balance reach with relevance. A smaller, highly-targeted segment outperforms a large, generic one.`;

  const agedInventoryContext =
    isAgedInventory && input.agedInventoryStats
      ? `\nAGED INVENTORY CONTEXT:\n` +
        `- Aged vehicles in stock (45+ days): ${input.agedInventoryStats.totalAgedVehicles}\n` +
        `- Average days on lot: ${input.agedInventoryStats.avgDaysOnLot}\n` +
        `- Top makes: ${input.agedInventoryStats.topMakes.join(", ")}\n` +
        `- Customers matched to aged vehicles: ${input.agedInventoryStats.matchedCustomers}\n`
      : "";

  const userPrompt =
    `Create a targeting strategy for:\n\n` +
    `DEALERSHIP: ${input.context.dealershipName}\n` +
    `CAMPAIGN GOAL: ${input.campaignGoal}\n` +
    `CHANNEL: ${input.channel}\n` +
    `CAMPAIGN TYPE: ${isAgedInventory ? "Aged Inventory (vehicle-matched outreach)" : "Standard"}\n\n` +
    `CUSTOMER DATABASE:\n` +
    `- Total customers: ${input.totalCustomers}\n` +
    `- VIP: ${input.segmentStats.vip}\n` +
    `- Active: ${input.segmentStats.active}\n` +
    `- At-Risk: ${input.segmentStats.atRisk}\n` +
    `- Lapsed: ${input.segmentStats.lapsed}\n` +
    agedInventoryContext +
    (input.globalLearnings?.length ? `\nCROSS-DEALER INSIGHTS:\n${input.globalLearnings.join("\n")}` : "") +
    (input.dealershipInsights ?? "") +
    `\n\nRespond with JSON:\n` +
    `{\n` +
    `  "segment": {\n` +
    `    "filters": {\n` +
    `      "lifecycle_stage": ["active", "at_risk"],\n` +
    `      "max_days_since_visit": 365,\n` +
    `      "min_visits": 2\n` +
    `    },\n` +
    `    "estimated_size": 0\n` +
    `  },\n` +
    `  "rationale": "explanation of why this audience",\n` +
    `  "estimatedResponseRate": 0.15,\n` +
    `  "suggestedTiming": "Tuesday–Thursday, 10am–2pm local time"\n` +
    `}`;

  const response = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Targeting Agent");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Targeting Agent did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]);
  return { ...parsed, tokensUsed: response.usage.input_tokens + response.usage.output_tokens };
}
