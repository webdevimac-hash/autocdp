/**
 * Campaign Sequence Planner — Autonomous Drip Follow-Up Logic
 *
 * After any direct mail send, the swarm automatically plans 1–2 intelligent
 * follow-up touches (SMS, email) based on scan/no-scan status, customer
 * lifecycle stage, and channel availability.
 *
 * Rule-based (no LLM) — deterministic, instant, zero AI cost.
 * Sequence steps are written to campaign_sequences table for the scheduler.
 *
 * Sequence logic (postcard send):
 *   Day 14: if no QR scan → SMS nudge (if any customer has phone)
 *   Day 21: if still no scan → email with fresh angle (if any has email)
 *
 * Sequence logic (SMS send):
 *   Day 7:  if no reply → email follow-up (if any has email)
 */
import { createServiceClient } from "@/lib/supabase/server";
import type { AgentContext } from "@/types";

// ── Types ─────────────────────────────────────────────────────

export type SequenceCondition =
  | "no_scan_14d"   // trigger if customer hasn't scanned the QR within 14 days
  | "no_scan_21d"
  | "no_reply_7d"   // trigger if no SMS reply within 7 days
  | "scanned"       // trigger after a QR scan (upsell sequence)
  | "always";

export type SequenceChannel = "sms" | "email" | "direct_mail";

export interface SequenceStep {
  stepIndex: number;
  channel: SequenceChannel;
  /** Days after the initial send to evaluate + fire this step */
  dayOffset: number;
  condition: SequenceCondition;
  /** Natural-language hint for Creative Agent when writing the follow-up */
  messageHint: string;
  estimatedCostLabel: string;
}

export interface PlannedSequence {
  campaignId: string;
  dealershipId: string;
  steps: SequenceStep[];
  plannedAt: string;
}

export interface SequencePlannerInput {
  context: AgentContext;
  campaignId: string;
  campaignGoal: string;
  channel: SequenceChannel;
  sentCount: number;
  hasPhoneNumbers: boolean;
  hasEmailAddresses: boolean;
}

export interface SequencePlannerOutput {
  sequence: PlannedSequence;
  stepsWritten: number;
  status: "planned" | "skipped" | "failed";
  error?: string;
}

// ── Planner ───────────────────────────────────────────────────

function buildSteps(input: SequencePlannerInput): SequenceStep[] {
  const { channel, campaignGoal, hasPhoneNumbers, hasEmailAddresses } = input;
  const steps: SequenceStep[] = [];

  if (channel === "direct_mail") {
    // Day 14: SMS if no scan + phone available
    if (hasPhoneNumbers) {
      steps.push({
        stepIndex: 1,
        channel: "sms",
        dayOffset: 14,
        condition: "no_scan_14d",
        messageHint:
          `Short SMS (≤ 160 chars) for customers who haven't scanned the postcard yet. ` +
          `Reference that we mailed something. Re-state the core value: "${campaignGoal}". ` +
          `Include dealership phone. Warm, not pushy.`,
        estimatedCostLabel: "$0.02 / SMS",
      });
    }

    // Day 21: Email if still no scan + email available
    if (hasEmailAddresses) {
      steps.push({
        stepIndex: 2,
        channel: "email",
        dayOffset: 21,
        condition: "no_scan_21d",
        messageHint:
          `Email follow-up for customers who haven't responded to the postcard or SMS. ` +
          `Use a fresh angle — lead with the benefit, not the mailer. ` +
          `Goal: "${campaignGoal}". Include a clear CTA button. 2–3 paragraphs max.`,
        estimatedCostLabel: "$0.001 / email",
      });
    }
  }

  if (channel === "sms") {
    // Day 7: Email if no reply + email available
    if (hasEmailAddresses) {
      steps.push({
        stepIndex: 1,
        channel: "email",
        dayOffset: 7,
        condition: "no_reply_7d",
        messageHint:
          `Follow-up email for customers who didn't respond to the SMS. ` +
          `More detail — explain the offer and why it matters to them specifically. ` +
          `Goal: "${campaignGoal}". Include a CTA button.`,
        estimatedCostLabel: "$0.001 / email",
      });
    }

    // Day 14: Direct mail for high-value non-responders if goal warrants it
    if (campaignGoal.toLowerCase().includes("vip") || campaignGoal.toLowerCase().includes("lapsed")) {
      steps.push({
        stepIndex: 2,
        channel: "direct_mail",
        dayOffset: 14,
        condition: "no_reply_7d",
        messageHint:
          `Physical mailer for high-value customers who didn't respond to SMS or email. ` +
          `This is the final touch — make it personal and compelling. Goal: "${campaignGoal}".`,
        estimatedCostLabel: "$1.20 / postcard",
      });
    }
  }

  if (channel === "email") {
    // Day 7: SMS nudge if phone available
    if (hasPhoneNumbers) {
      steps.push({
        stepIndex: 1,
        channel: "sms",
        dayOffset: 7,
        condition: "no_scan_14d",
        messageHint:
          `SMS for customers who haven't clicked the email. Very brief — ` +
          `reference the email, restate the core offer. "${campaignGoal}". ≤ 160 chars.`,
        estimatedCostLabel: "$0.02 / SMS",
      });
    }
  }

  return steps;
}

export async function planCampaignSequence(
  input: SequencePlannerInput
): Promise<SequencePlannerOutput> {
  const supabase = createServiceClient();
  const plannedAt = new Date().toISOString();

  try {
    const steps = buildSteps(input);

    if (!steps.length) {
      return {
        sequence: {
          campaignId: input.campaignId,
          dealershipId: input.context.dealershipId,
          steps: [],
          plannedAt,
        },
        stepsWritten: 0,
        status: "skipped",
      };
    }

    // Persist to DB — non-blocking, non-fatal
    try {
      await supabase.from("campaign_sequences").insert(
        steps.map((s) => ({
          campaign_id: input.campaignId,
          dealership_id: input.context.dealershipId,
          step_index: s.stepIndex,
          channel: s.channel,
          day_offset: s.dayOffset,
          condition: s.condition,
          message_hint: s.messageHint,
          estimated_cost_label: s.estimatedCostLabel,
          status: "planned",
        }))
      );
    } catch (dbErr) {
      // Table may not exist yet — don't fail the whole sequence plan
      console.warn("[sequence-planner] DB write failed (table may not exist):", dbErr);
    }

    return {
      sequence: {
        campaignId: input.campaignId,
        dealershipId: input.context.dealershipId,
        steps,
        plannedAt,
      },
      stepsWritten: steps.length,
      status: "planned",
    };
  } catch (error) {
    return {
      sequence: {
        campaignId: input.campaignId,
        dealershipId: input.context.dealershipId,
        steps: [],
        plannedAt,
      },
      stepsWritten: 0,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
