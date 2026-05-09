import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_BASE_FEES, type PlanTier } from "@/lib/billing/metering";

// ── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_cents: number;
  total_cents: number;
  event_type?: string;
}

export interface Invoice {
  id: string;
  dealership_id: string;
  invoice_number: string;
  billing_month: number;
  billing_year: number;
  line_items: InvoiceLineItem[];
  base_fee_cents: number;
  usage_cents: number;
  subtotal_cents: number;
  status: "draft" | "sent" | "paid" | "overdue";
  payment_method: string | null;
  controller_email: string | null;
  controller_notified_at: string | null;
  sent_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingSettings {
  payment_method_preference: "card" | "ach";
  ach_bank_name?: string;
  ach_account_last4?: string;
  ach_routing_last4?: string;
  invoice_controller_email?: string;
  invoice_threshold_cents: number;
  invoice_require_payment_before_print: boolean;
}

const EVENT_LABELS: Record<string, string> = {
  agent_run:       "AI Agent Runs",
  sms_sent:        "SMS Messages",
  email_sent:      "Email Sends",
  mail_piece_sent: "Direct Mail Pieces (print + postage)",
  api_call:        "API Calls",
};

// ── Billing settings (stored in dealerships.settings JSONB) ──────────────────

export async function getBillingSettings(dealershipId: string): Promise<BillingSettings> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("dealerships")
    .select("settings")
    .eq("id", dealershipId)
    .single();
  const s = (data?.settings ?? {}) as Record<string, unknown>;
  return {
    payment_method_preference:          (s.payment_method_preference as "card" | "ach") ?? "card",
    ach_bank_name:                      s.ach_bank_name                 as string | undefined,
    ach_account_last4:                  s.ach_account_last4             as string | undefined,
    ach_routing_last4:                  s.ach_routing_last4             as string | undefined,
    invoice_controller_email:           s.invoice_controller_email      as string | undefined,
    invoice_threshold_cents:            (s.invoice_threshold_cents      as number | undefined) ?? 50000,
    invoice_require_payment_before_print: (s.invoice_require_payment_before_print as boolean | undefined) ?? false,
  };
}

export async function saveBillingSettings(
  dealershipId: string,
  updates: Partial<BillingSettings>,
): Promise<void> {
  const svc = createServiceClient();
  const { data } = await svc.from("dealerships").select("settings").eq("id", dealershipId).single();
  const existing = (data?.settings ?? {}) as Record<string, unknown>;
  await svc.from("dealerships").update({
    settings: { ...existing, ...updates },
  }).eq("id", dealershipId);
}

// ── Invoice generation ────────────────────────────────────────────────────────

export async function generateMonthlyInvoice(opts: {
  dealershipId: string;
  year: number;
  month: number;
  dealerName: string;
  planTier: string;
}): Promise<Invoice> {
  const { dealershipId, year, month, dealerName, planTier } = opts;
  const svc = createServiceClient();

  // Return existing invoice for this period
  const { data: existing } = await (svc as unknown as { from: (t: string) => { select: (c: string) => { eq: (a: string, b: unknown) => { eq: (a: string, b: unknown) => { eq: (a: string, b: unknown) => { single: () => Promise<{ data: Invoice | null }> } } } } } }).from("invoices")
    .select("*").eq("dealership_id", dealershipId).eq("billing_year", year).eq("billing_month", month).single();
  if (existing) return existing;

  // Aggregate billing events for the month
  const startOfMonth = new Date(year, month - 1, 1).toISOString();
  const endOfMonth   = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  const { data: events } = await svc
    .from("billing_events")
    .select("event_type, quantity, unit_cost_cents")
    .eq("dealership_id", dealershipId)
    .gte("created_at", startOfMonth)
    .lte("created_at", endOfMonth);

  const agg: Record<string, { qty: number; cost: number }> = {};
  for (const ev of events ?? []) {
    if (!agg[ev.event_type]) agg[ev.event_type] = { qty: 0, cost: 0 };
    agg[ev.event_type].qty  += ev.quantity;
    agg[ev.event_type].cost += ev.unit_cost_cents;
  }

  const lineItems: InvoiceLineItem[] = [];

  // Base plan fee first
  const baseFee = planTier in PLAN_BASE_FEES ? PLAN_BASE_FEES[planTier as PlanTier] : 0;
  if (baseFee > 0) {
    const monthName = new Date(year, month - 1).toLocaleString("en-US", { month: "long" });
    lineItems.push({
      description: `${planTier.charAt(0).toUpperCase() + planTier.slice(1)} Plan — ${monthName} ${year}`,
      quantity: 1,
      unit_cents: baseFee,
      total_cents: baseFee,
    });
  }

  // Usage line items
  for (const [type, { qty, cost }] of Object.entries(agg)) {
    if (qty > 0) {
      lineItems.push({
        description: EVENT_LABELS[type] ?? type.replace(/_/g, " "),
        quantity: qty,
        unit_cents: Math.round(cost / qty),
        total_cents: cost,
        event_type: type,
      });
    }
  }

  const usageCents   = lineItems.filter((l) => l.event_type).reduce((s, l) => s + l.total_cents, 0);
  const subtotalCents = lineItems.reduce((s, l) => s + l.total_cents, 0);

  const invoiceNumber = `INV-${year}-${String(month).padStart(2, "0")}-${dealershipId.slice(0, 6).toUpperCase()}`;
  const dueDate       = new Date(year, month, 15); // 15th of the following month

  const billingSettings = await getBillingSettings(dealershipId);

  const { data: invoice, error } = await (svc as never as {
    from: (t: string) => {
      insert: (d: unknown) => { select: (c: string) => { single: () => Promise<{ data: Invoice | null; error: unknown }> } }
    }
  }).from("invoices").insert({
    dealership_id:   dealershipId,
    invoice_number:  invoiceNumber,
    billing_month:   month,
    billing_year:    year,
    line_items:      lineItems,
    base_fee_cents:  baseFee,
    usage_cents:     usageCents,
    subtotal_cents:  subtotalCents,
    status:          "sent",
    controller_email: billingSettings.invoice_controller_email ?? null,
    due_date:        dueDate.toISOString().split("T")[0],
    sent_at:         new Date().toISOString(),
  }).select("*").single();

  if (error || !invoice) throw new Error("Failed to create invoice record");
  return invoice;
}

// ── Invoice list ─────────────────────────────────────────────────────────────

export async function listInvoices(dealershipId: string, limit = 12): Promise<Invoice[]> {
  const svc = createServiceClient();
  const { data } = await (svc as never as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: unknown) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: Invoice[] | null }>
          }
        }
      }
    }
  }).from("invoices")
    .select("*")
    .eq("dealership_id", dealershipId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ── Print run gate ────────────────────────────────────────────────────────────

export interface PrintRunGateResult {
  allowed: boolean;
  reason?: string;
  blockedByInvoiceId?: string;
  controllerNotified: boolean;
}

export async function checkPrintRunGate(
  dealershipId: string,
  printCostCents: number,
): Promise<PrintRunGateResult> {
  const settings = await getBillingSettings(dealershipId);
  const svc = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Check for overdue invoices
  const { data: overdueInvoices } = await (svc as never as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: unknown) => {
          in: (col: string, vals: string[]) => {
            lt: (col: string, val: string) => Promise<{ data: Array<{ id: string; invoice_number: string; subtotal_cents: number }> | null }>
          }
        }
      }
    }
  }).from("invoices")
    .select("id, invoice_number, subtotal_cents")
    .eq("dealership_id", dealershipId)
    .in("status", ["sent", "overdue"])
    .lt("due_date", today);

  if (settings.invoice_require_payment_before_print && overdueInvoices?.length) {
    const inv = overdueInvoices[0];
    return {
      allowed: false,
      reason: `Invoice ${inv.invoice_number} ($${(inv.subtotal_cents / 100).toFixed(2)}) is past due. Please settle this invoice before sending additional print campaigns.`,
      blockedByInvoiceId: inv.id,
      controllerNotified: false,
    };
  }

  // Notify controller if this run crosses the threshold
  const threshold = settings.invoice_threshold_cents;
  const shouldNotify = printCostCents >= threshold && !!settings.invoice_controller_email;

  return { allowed: true, controllerNotified: shouldNotify };
}
