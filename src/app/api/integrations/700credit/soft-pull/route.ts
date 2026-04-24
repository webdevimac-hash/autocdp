/**
 * POST /api/integrations/700credit/soft-pull
 *
 * FCRA-safe soft credit pull for existing customers only.
 * Enforces visit history gate before contacting 700Credit.
 * Never alters FCRA disclosures or adverse action text.
 *
 * Body: { customer_id, address?: {...} }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  SevenHundredCreditClient,
  checkVisitHistoryGate,
  formatFcraDisclosure,
  FCRA_ADVERSE_ACTION_REMINDER,
} from "@/lib/integrations/700credit-fcra";
import type { Customer } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    customer_id: string;
    address?: { street: string; city: string; state: string; zip: string };
  };

  if (!body.customer_id) {
    return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
  }

  const svc = createServiceClient();

  type UdRow = { dealership_id: string; role: string } | null;
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id, role")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  // Load customer
  const { data: customer } = await svc
    .from("customers")
    .select("*")
    .eq("id", body.customer_id)
    .eq("dealership_id", ud.dealership_id)
    .single() as unknown as { data: Customer | null };

  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // FCRA gate: must have existing visit history
  const gate = checkVisitHistoryGate(customer.total_visits ?? 0);
  if (!gate.permitted) {
    return NextResponse.json({
      error: "FCRA_GATE_FAILED",
      message: gate.reason,
      visit_count: gate.visitCount,
    }, { status: 403 });
  }

  // Load dealership for disclosure
  type DealershipRow = { name: string; settings: Record<string, unknown> } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("name, settings")
    .eq("id", ud.dealership_id)
    .single() as unknown as { data: DealershipRow };

  // Load 700Credit credentials
  type ConnectionRow = { encrypted_tokens: string | null } | null;
  const { data: conn } = await svc
    .from("dms_connections")
    .select("encrypted_tokens")
    .eq("dealership_id", ud.dealership_id)
    .eq("provider", "seven_hundred_credit")
    .eq("status", "active")
    .single() as unknown as { data: ConnectionRow };

  if (!conn?.encrypted_tokens) {
    return NextResponse.json({ error: "No active 700Credit connection configured" }, { status: 404 });
  }

  let tokens: Record<string, string>;
  try {
    tokens = JSON.parse(Buffer.from(conn.encrypted_tokens, "base64").toString("utf-8"));
  } catch {
    return NextResponse.json({ error: "Failed to decrypt 700Credit credentials" }, { status: 500 });
  }

  const client = new SevenHundredCreditClient({
    baseUrl: tokens.base_url ?? "https://api.700credit.com",
    apiKey: tokens.api_key,
    dealerCode: tokens.dealer_code,
  });

  const addr = body.address ?? (customer.address as { street?: string; city?: string; state?: string; zip?: string } | null);
  if (!addr?.street || !addr?.city || !addr?.state || !addr?.zip) {
    return NextResponse.json({
      error: "Customer address is incomplete. Street, city, state, and zip are required for a soft pull.",
    }, { status: 422 });
  }

  try {
    const result = await client.softPull(
      {
        firstName: customer.first_name,
        lastName: customer.last_name,
        address: {
          street: addr.street!,
          city: addr.city!,
          state: addr.state!,
          zip: addr.zip!,
        },
      },
      customer.id,
      ud.dealership_id
    );

    return NextResponse.json({
      success: true,
      result,
      fcra_disclosure: formatFcraDisclosure(dealership?.name ?? "this dealership"),
      adverse_action_reminder: FCRA_ADVERSE_ACTION_REMINDER,
      gate: {
        visit_count: gate.visitCount,
        permitted: gate.permitted,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as { message?: string }).message ?? String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** GET — return the FCRA disclosure text for a given dealership (for UI rendering). */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  type UdRow = { dealership_id: string } | null;
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  type DealershipRow = { name: string } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("name")
    .eq("id", ud.dealership_id)
    .single() as unknown as { data: DealershipRow };

  return NextResponse.json({
    fcra_disclosure: formatFcraDisclosure(dealership?.name ?? "this dealership"),
    adverse_action_reminder: FCRA_ADVERSE_ACTION_REMINDER,
  });
}
