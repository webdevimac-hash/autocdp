import { NextRequest, NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/billing/metering";

// POST /api/billing/webhook
// Receives webhook events from Stripe (and optionally Orb).
// Configure in Stripe Dashboard: https://dashboard.stripe.com/webhooks
// Events to forward: invoice.paid, invoice.payment_failed, customer.subscription.*
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature") ?? "";

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe-Signature header" }, { status: 400 });
  }

  let payload: string;
  try {
    payload = await req.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const result = await handleStripeWebhook(payload, signature);

  if (!result.received) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}

// ── Orb webhook stub ──────────────────────────────────────────
// Orb sends events for usage threshold alerts and invoice generation.
// Endpoint: POST /api/billing/orb-webhook (add if using Orb for metering)
