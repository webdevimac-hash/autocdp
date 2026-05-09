import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import {
  Mail, MessageSquare, FileText, Bot,
  ArrowUpRight, Sparkles, TrendingDown, ShieldCheck, AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMonthlyUsage, PLAN_BASE_FEES, type PlanTier } from "@/lib/billing/metering";
import { getBillingSettings, listInvoices } from "@/lib/billing/invoices";
import { BillingSettingsPanel } from "@/components/billing/billing-settings-panel";

export const metadata = { title: "Billing" };

const PLANS: {
  name: string; tier: string; price: string; period: string;
  description: string; features: string[]; highlight: boolean;
  featureCard: string; badge: string | null;
}[] = [
  {
    name: "Starter", tier: "starter",
    price: "$499", period: "/mo",
    description: "Up to 500 customers, 3 campaigns/month",
    features: [
      "500 customer profiles",
      "3 campaigns/month",
      "Email + SMS channels",
      "Data & Creative Agents",
      "Basic analytics",
    ],
    highlight: false, featureCard: "feature-card-slate", badge: null,
  },
  {
    name: "Growth", tier: "growth",
    price: "$999", period: "/mo",
    description: "Up to 5,000 customers, unlimited campaigns",
    features: [
      "5,000 customer profiles",
      "Unlimited campaigns",
      "Email + SMS + Direct Mail",
      "Full 5-agent swarm",
      "Cross-dealer learnings",
      "Priority support",
    ],
    highlight: true, featureCard: "feature-card-indigo", badge: "Most Popular",
  },
  {
    name: "Enterprise", tier: "enterprise",
    price: "Custom", period: "",
    description: "Unlimited — for dealer groups & MSOs",
    features: [
      "Unlimited customers",
      "Custom agent workflows",
      "Dedicated infrastructure",
      "ACH & invoice billing",
      "SLA guarantee",
      "Dedicated CSM",
    ],
    highlight: false, featureCard: "feature-card-emerald", badge: null,
  },
];

const USAGE_ITEMS = [
  { label: "Agent Runs",  icon: Bot,           iconBg: "bg-violet-50",  iconColor: "text-violet-600", unit: "runs",     unitCost: "$0.05" },
  { label: "SMS Sent",    icon: MessageSquare, iconBg: "bg-sky-50",     iconColor: "text-sky-600",    unit: "messages", unitCost: "$0.02" },
  { label: "Emails Sent", icon: Mail,          iconBg: "bg-emerald-50", iconColor: "text-emerald-600",unit: "emails",   unitCost: "Included" },
  { label: "Mail Pieces", icon: FileText,       iconBg: "bg-indigo-50",  iconColor: "text-indigo-600", unit: "pieces",   unitCost: "$1.50" },
];

function buildSpendInsight(
  planTier: string,
  usage: Awaited<ReturnType<typeof getMonthlyUsage>>,
  dayOfMonth: number,
  daysInMonth: number,
): { message: string; type: "info" | "positive" | "neutral" } {
  const projectedCents = dayOfMonth > 0
    ? Math.round(usage.totalCostCents * (daysInMonth / dayOfMonth))
    : usage.totalCostCents;
  const projected = projectedCents / 100;

  if (planTier === "trial" || planTier === "starter") {
    if (usage.mailPiecesSent > 0) {
      const mailCost = usage.mailPiecesSent * 1.50;
      return {
        message: `Direct mail (${usage.mailPiecesSent} pieces, ~$${mailCost.toFixed(0)}) is your largest variable cost. Targeting your top RFM quintile typically cuts list size 30–40% with similar response rates.`,
        type: "info",
      };
    }
    if (projectedCents > 0) {
      return {
        message: `Projected variable spend at current pace: ~$${projected.toFixed(0)} this month. Starter plan ($499/mo) bundles SMS, email, and agent runs.`,
        type: "info",
      };
    }
    return { message: "No variable usage recorded yet this month. Run your first campaign to see spend data here.", type: "neutral" };
  }
  if (planTier === "growth") {
    const mailCost = usage.mailPiecesSent * 1.50;
    if (usage.mailPiecesSent > 50) {
      return {
        message: `Direct mail is $${mailCost.toFixed(0)} this month (${usage.mailPiecesSent} pieces). Focusing on RFM score ≥60 typically reduces piece count 25–35% without a meaningful drop in booked appointments.`,
        type: "positive",
      };
    }
    return {
      message: `Variable spend is $${(usage.totalCostCents / 100).toFixed(2)} so far. Growth plan includes unlimited campaigns — aim for at least one per week to get full value.`,
      type: "neutral",
    };
  }
  return { message: "Enterprise plan active. Your billing is managed by your account team.", type: "neutral" };
}

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id, role")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string; role: string } | null };

  const dealershipId = ud?.dealership_id;
  const userRole     = ud?.role ?? "member";
  const canEdit      = ["owner", "admin"].includes(userRole);

  let usage        = { agentRuns: 0, smsSent: 0, emailSent: 0, mailPiecesSent: 0, totalCostCents: 0 };
  let planTier     = "trial";
  let dealerName   = "My Dealership";
  let billingSettings = {
    payment_method_preference: "card" as const,
    invoice_threshold_cents: 50000,
    invoice_require_payment_before_print: false,
  };
  let invoices = [];

  if (dealershipId) {
    try { usage = await getMonthlyUsage(dealershipId); } catch { /* not yet configured */ }

    const svc = createServiceClient();
    const { data: dl } = await svc
      .from("dealerships")
      .select("name, plan_tier")
      .eq("id", dealershipId)
      .single() as { data: { name: string; plan_tier: string } | null };

    planTier   = dl?.plan_tier ?? "trial";
    dealerName = dl?.name ?? "My Dealership";

    try {
      [billingSettings, invoices] = await Promise.all([
        getBillingSettings(dealershipId),
        listInvoices(dealershipId),
      ]);
    } catch { /* tables may not exist yet */ }
  }

  const now          = new Date();
  const dayOfMonth   = now.getDate();
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  const usageValues  = [usage.agentRuns, usage.smsSent, usage.emailSent, usage.mailPiecesSent];
  const currentPlan  = PLANS.find((p) => p.tier === planTier);
  const planBaseCents = planTier in PLAN_BASE_FEES ? PLAN_BASE_FEES[planTier as PlanTier] : 0;
  const insight       = buildSpendInsight(planTier, usage, dayOfMonth, daysInMonth);

  const tierColors: Record<string, string> = {
    trial: "chip-amber", starter: "chip-slate", growth: "chip-indigo", enterprise: "chip-emerald",
  };
  const tierChip = tierColors[planTier] ?? "chip-slate";

  const paymentLabel = billingSettings.payment_method_preference === "ach"
    ? `ACH${billingSettings.ach_bank_name ? ` · ${billingSettings.ach_bank_name}` : ""}${billingSettings.ach_account_last4 ? ` ···${billingSettings.ach_account_last4}` : ""}`
    : "Credit / Debit Card";

  const overdueCount = (invoices as { status: string }[]).filter((i) => i.status === "overdue").length;

  return (
    <>
      <Header title="Billing" subtitle={`${dealerName} · ${paymentLabel}`} userEmail={user?.email} />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">

        {/* ── Overdue invoice alert ──────────────────────────────── */}
        {overdueCount > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-800 font-medium">
              {overdueCount} overdue invoice{overdueCount > 1 ? "s" : ""}. Direct mail campaigns may be blocked until settled. See Invoices below.
            </p>
          </div>
        )}

        {/* ── Current tier banner ────────────────────────────────── */}
        <div
          className="rounded-[var(--radius)] overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #0B1526 0%, #1E3048 100%)" }}
        >
          <div className="absolute inset-0 dark-grid opacity-60" />
          <div className="relative px-6 py-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`chip ${tierChip} capitalize`}>{planTier}</span>
                  {planTier === "trial" && (
                    <span className="text-xs font-medium text-white/60">{daysRemaining} days remaining this period</span>
                  )}
                </div>
                <p className="text-lg font-bold text-white">
                  {currentPlan ? `${currentPlan.name} Plan — ${currentPlan.price}${currentPlan.period}` : "Free Trial"}
                </p>
                <p className="text-sm text-white/60 mt-0.5">
                  {planBaseCents > 0
                    ? `Base fee $${(planBaseCents / 100).toFixed(0)}/mo + usage overage · ${paymentLabel}`
                    : "No base fee during trial. Upgrade to unlock full features."}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-2xl font-bold text-white tabular-nums">${(usage.totalCostCents / 100).toFixed(2)}</p>
                  <p className="text-xs text-white/50">variable this month</p>
                </div>
                {planTier === "trial" || planTier === "starter" ? (
                  <Button className="bg-white text-slate-900 hover:bg-white/90 font-semibold shadow-[0_1px_3px_0_rgb(0_0_0/0.25)] shrink-0">
                    Upgrade Now <ArrowUpRight className="ml-1.5 w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-white/8 border border-white/12 rounded-lg px-3 py-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-white/80">Active</span>
                  </div>
                )}
              </div>
            </div>

            {/* Spend intelligence */}
            <div className={`mt-4 rounded-lg px-4 py-3 flex items-start gap-2.5 ${
              insight.type === "positive" ? "bg-emerald-500/10 border border-emerald-500/20"
              : insight.type === "info"   ? "bg-indigo-500/10 border border-indigo-500/20"
              : "bg-white/5 border border-white/10"
            }`}>
              {insight.type === "positive" ? <TrendingDown className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
               : insight.type === "info"   ? <AlertCircle  className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
               : <Sparkles className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />}
              <p className="text-xs text-white/70 leading-relaxed">{insight.message}</p>
            </div>
          </div>
        </div>

        {/* ── Plans ─────────────────────────────────────────────── */}
        <div>
          <h2 className="text-[13px] font-semibold text-slate-700 mb-3 uppercase tracking-wide">Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = plan.tier === planTier;
              return (
                <div
                  key={plan.name}
                  className={`feature-card ${plan.featureCard} relative bg-white rounded-[var(--radius)] border shadow-card flex flex-col ${
                    isCurrent ? "border-emerald-300 ring-1 ring-emerald-200"
                    : plan.highlight ? "border-indigo-300 ring-1 ring-indigo-200"
                    : "border-slate-200"
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="chip chip-emerald px-3 py-1 shadow-sm">Current Plan</span>
                    </div>
                  )}
                  {!isCurrent && plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="chip chip-indigo px-3 py-1 shadow-sm">{plan.badge}</span>
                    </div>
                  )}
                  <div className="px-5 pt-5 pb-4">
                    <p className="text-[13px] font-semibold text-slate-900">{plan.name}</p>
                    <div className="flex items-baseline gap-0.5 mt-1.5">
                      <span className="text-3xl font-bold text-slate-900 tracking-tight">{plan.price}</span>
                      <span className="text-sm text-slate-400">{plan.period}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{plan.description}</p>
                  </div>
                  <div className="border-t border-slate-100 mx-5" />
                  <div className="px-5 py-4 flex-1">
                    <ul className="space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-[13px] text-slate-600">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="px-5 pb-5">
                    <Button className="w-full" variant={isCurrent ? "outline" : plan.highlight ? "default" : "outline"} size="sm" disabled={isCurrent}>
                      {isCurrent ? "Current Plan" : plan.name === "Enterprise" ? "Contact Sales" : `Switch to ${plan.name}`}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Usage this month ──────────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div>
              <div className="inst-panel-title">Usage This Month</div>
              <div className="inst-panel-subtitle">
                {dayOfMonth} of {daysInMonth} days elapsed · Resets on the 1st · Billed in arrears
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[17px] font-bold text-slate-900 tabular-nums">${(usage.totalCostCents / 100).toFixed(2)}</span>
              <span className="text-xs text-slate-400 font-medium">variable</span>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {USAGE_ITEMS.map((item, i) => (
              <div key={item.label} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.iconBg}`}>
                    <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.unitCost} per {item.unit}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-slate-900 tabular-nums">{usageValues[i].toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{item.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Interactive: invoices + payment + invoice settings ── */}
        {dealershipId && (
          <BillingSettingsPanel
            initial={billingSettings}
            canEdit={canEdit}
            invoices={invoices}
            dealershipId={dealershipId}
          />
        )}

      </main>
    </>
  );
}
