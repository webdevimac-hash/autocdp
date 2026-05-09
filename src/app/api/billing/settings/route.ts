import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { getBillingSettings, saveBillingSettings } from "@/lib/billing/invoices";
import type { BillingSettings } from "@/lib/billing/invoices";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const settings = await getBillingSettings(dealershipId);
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only owner/admin can change billing settings
  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const { data: membership } = await supabase
    .from("user_dealerships")
    .select("role")
    .eq("user_id", user.id)
    .eq("dealership_id", dealershipId)
    .single() as { data: { role: string } | null };

  if (!["owner", "admin"].includes(membership?.role ?? "")) {
    return NextResponse.json({ error: "Owner or admin role required to update billing settings" }, { status: 403 });
  }

  const updates = await req.json().catch(() => ({})) as Partial<BillingSettings>;

  // Validate
  if (updates.payment_method_preference && !["card", "ach"].includes(updates.payment_method_preference)) {
    return NextResponse.json({ error: "payment_method_preference must be 'card' or 'ach'" }, { status: 400 });
  }
  if (updates.invoice_threshold_cents !== undefined && updates.invoice_threshold_cents < 0) {
    return NextResponse.json({ error: "invoice_threshold_cents must be ≥ 0" }, { status: 400 });
  }
  if (updates.invoice_controller_email && !updates.invoice_controller_email.includes("@")) {
    return NextResponse.json({ error: "Invalid controller email" }, { status: 400 });
  }

  await saveBillingSettings(dealershipId, updates);
  const updated = await getBillingSettings(dealershipId);
  return NextResponse.json(updated);
}
