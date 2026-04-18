/**
 * Billing metering helpers — records usage events for hybrid billing.
 * Base fee (Stripe subscription) + usage overage (Stripe metering or Orb).
 */
import { createServiceClient } from "@/lib/supabase/server";
import type { BillingEventType } from "@/types";

// Unit costs in cents
export const UNIT_COSTS: Record<BillingEventType, number> = {
  agent_run: 5,          // $0.05 per agent run
  sms_sent: 2,           // $0.02 per SMS
  email_sent: 0,         // included in base tier
  mail_piece_sent: 150,  // $1.50 per direct mail piece (postage + print)
  api_call: 0,           // included
};

// Base monthly fees per plan (cents)
export const PLAN_BASE_FEES = {
  starter: 49900,    // $499/mo — up to 500 customers, 3 campaigns/mo
  growth: 99900,     // $999/mo — up to 5,000 customers, unlimited campaigns
  enterprise: 0,     // custom — negotiated
} as const;

export type PlanTier = keyof typeof PLAN_BASE_FEES;

export async function recordBillingEvent(
  dealershipId: string,
  eventType: BillingEventType,
  quantity = 1,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createServiceClient();
  const unitCost = UNIT_COSTS[eventType] * quantity;

  await supabase.from("billing_events").insert({
    dealership_id: dealershipId,
    event_type: eventType,
    quantity,
    unit_cost_cents: unitCost,
    metadata,
  });
}

export async function getMonthlyUsage(dealershipId: string): Promise<{
  agentRuns: number;
  smsSent: number;
  emailSent: number;
  mailPiecesSent: number;
  totalCostCents: number;
}> {
  const supabase = createServiceClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: events } = await supabase
    .from("billing_events")
    .select("event_type, quantity, unit_cost_cents")
    .eq("dealership_id", dealershipId)
    .gte("created_at", startOfMonth.toISOString());

  const usage = {
    agentRuns: 0,
    smsSent: 0,
    emailSent: 0,
    mailPiecesSent: 0,
    totalCostCents: 0,
  };

  for (const event of events ?? []) {
    usage.totalCostCents += event.unit_cost_cents;
    switch (event.event_type) {
      case "agent_run": usage.agentRuns += event.quantity; break;
      case "sms_sent": usage.smsSent += event.quantity; break;
      case "email_sent": usage.emailSent += event.quantity; break;
      case "mail_piece_sent": usage.mailPiecesSent += event.quantity; break;
    }
  }

  return usage;
}

// Stripe webhook event handler stub — implement with stripe-node in Phase 2
export async function handleStripeWebhook(
  payload: string,
  signature: string
): Promise<{ received: boolean; error?: string }> {
  // TODO Phase 2: verify Stripe-Signature header, parse event, handle:
  // - invoice.paid → update dealership billing status
  // - invoice.payment_failed → send dunning notice
  // - customer.subscription.deleted → downgrade/lock account
  console.log("Stripe webhook received", { payloadLength: payload.length, signature });
  return { received: true };
}
