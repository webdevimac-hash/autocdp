import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { generateMonthlyInvoice, listInvoices, getBillingSettings } from "@/lib/billing/invoices";
import { buildInvoiceEmail } from "@/lib/email-templates/invoice-email";
import { sendEmail } from "@/lib/resend-client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const invoices = await listInvoices(dealershipId);
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  // Only owner/admin can generate invoices
  const { data: membership } = await supabase
    .from("user_dealerships")
    .select("role")
    .eq("user_id", user.id)
    .eq("dealership_id", dealershipId)
    .single() as { data: { role: string } | null };

  if (!["owner", "admin"].includes(membership?.role ?? "")) {
    return NextResponse.json({ error: "Owner or admin role required" }, { status: 403 });
  }

  const svc = createServiceClient();
  const { data: dealership } = await svc
    .from("dealerships")
    .select("name, plan_tier, settings")
    .eq("id", dealershipId)
    .single() as { data: { name: string; plan_tier: string; settings: Record<string, unknown> | null } | null };

  const { year, month } = await req.json().catch(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }) as { year: number; month: number };

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Valid year and month (1–12) required" }, { status: 400 });
  }

  try {
    const invoice = await generateMonthlyInvoice({
      dealershipId,
      year,
      month,
      dealerName: dealership?.name ?? "Dealership",
      planTier: (dealership as { plan_tier?: string } | null)?.plan_tier ?? "trial",
    });

    // Email invoice to controller if configured
    const billingSettings = await getBillingSettings(dealershipId);
    if (billingSettings.invoice_controller_email) {
      const { subject, html } = buildInvoiceEmail({
        invoice,
        dealerName: dealership?.name ?? "Dealership",
        billingSettings,
      });
      void sendEmail({
        to: billingSettings.invoice_controller_email,
        subject,
        html,
        fromName: "AutoCDP Billing",
        fromEmail: "billing@autocdp.io",
      });
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
