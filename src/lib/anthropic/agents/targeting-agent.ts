/**
 * Targeting Agent — Selects the optimal audience for a campaign.
 * Responsibilities: filter criteria generation, segment sizing, propensity scoring.
 */
import { getAnthropicClient, MODELS } from "../client";
import type { AgentContext, CustomerSegment, CampaignChannel } from "@/types";

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
  globalLearnings?: string[];      // anonymized patterns from other dealerships
}

export interface TargetingAgentOutput {
  segment: CustomerSegment;
  rationale: string;
  estimatedResponseRate: number;   // 0–1
  suggestedTiming: string;         // e.g., "Tuesday 10am–2pm"
  tokensUsed: number;
}

export async function runTargetingAgent(
  input: TargetingAgentInput
): Promise<TargetingAgentOutput> {
  const client = getAnthropicClient();

  const systemPrompt = `You are the Targeting Agent for AutoCDP. Your job is to select the optimal
customer audience for marketing campaigns at auto dealerships.

You understand automotive customer behavior:
- Oil change intervals: every 3–6 months (3,000–7,500 miles)
- Major service: annually
- At-risk customers: 6–18 months since last visit
- Lapsed customers: 18+ months since last visit

Channel-specific rules:
- SMS: high-intent, short messages, immediate response expected — use sparingly
- Email: nurture sequences, promotions, newsletters
- Direct mail: high-value, tactile — best for VIP and lapsed recovery
- Multi-channel: coordinated across all three

Always balance reach with relevance. A smaller, highly-targeted segment outperforms a large, generic one.`;

  const userPrompt = `Create a targeting strategy for:

DEALERSHIP: ${input.context.dealershipName}
CAMPAIGN GOAL: ${input.campaignGoal}
CHANNEL: ${input.channel}

CUSTOMER DATABASE:
- Total customers: ${input.totalCustomers}
- VIP: ${input.segmentStats.vip}
- Active: ${input.segmentStats.active}
- At-Risk: ${input.segmentStats.atRisk}
- Lapsed: ${input.segmentStats.lapsed}

${input.globalLearnings?.length ? `CROSS-DEALER INSIGHTS:\n${input.globalLearnings.join("\n")}` : ""}

Respond with JSON:
{
  "segment": {
    "filters": {
      "lifecycle_stage": ["active", "at_risk"],
      "max_days_since_visit": 365,
      "min_visits": 2
    },
    "estimated_size": 0
  },
  "rationale": "explanation of why this audience",
  "estimatedResponseRate": 0.15,
  "suggestedTiming": "Tuesday–Thursday, 10am–2pm local time"
}`;

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
