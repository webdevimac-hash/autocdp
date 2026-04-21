import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle, Zap, Mail, MessageSquare, FileText, Bot, ArrowUpRight, Sparkles } from "lucide-react";
import { getMonthlyUsage } from "@/lib/billing/metering";

export const metadata = { title: "Billing" };

const PLANS = [
  {
    name: "Starter",
    price: "$499",
    period: "/mo",
    description: "Up to 500 customers, 3 campaigns/month",
    features: [
      "500 customer profiles",
      "3 campaigns/month",
      "Email + SMS channels",
      "Data & Creative Agents",
      "Basic analytics",
    ],
    highlight: false,
    featureCard: "feature-card-slate",
    badge: null,
  },
  {
    name: "Growth",
    price: "$999",
    period: "/mo",
    description: "Up to 5,000 customers, unlimited campaigns",
    features: [
      "5,000 customer profiles",
      "Unlimited campaigns",
      "Email + SMS + Direct Mail",
      "Full 5-agent swarm",
      "Cross-dealer learnings",
      "Priority support",
    ],
    highlight: true,
    featureCard: "feature-card-indigo",
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Unlimited — for dealer groups & MSOs",
    features: [
      "Unlimited customers",
      "Custom agent workflows",
      "Dedicated infrastructure",
      "White-label option",
      "SLA guarantee",
      "Dedicated CSM",
    ],
    highlight: false,
    featureCard: "feature-card-emerald",
    badge: null,
  },
];

const USAGE_ITEMS = [
  { label: "Agent Runs", icon: Bot, iconBg: "bg-violet-50", iconColor: "text-violet-600", unit: "runs", unitCost: "$0.05" },
  { label: "SMS Sent", icon: MessageSquare, iconBg: "bg-sky-50", iconColor: "text-sky-600", unit: "messages", unitCost: "$0.02" },
  { label: "Emails Sent", icon: Mail, iconBg: "bg-emerald-50", iconColor: "text-emerald-600", unit: "emails", unitCost: "Included" },
  { label: "Mail Pieces", icon: FileText, iconBg: "bg-indigo-50", iconColor: "text-indigo-600", unit: "pieces", unitCost: "$1.50" },
];

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user!.id)
    .single();

  let usage = { agentRuns: 0, smsSent: 0, emailSent: 0, mailPiecesSent: 0, totalCostCents: 0 };
  if (ud?.dealership_id) {
    try { usage = await getMonthlyUsage(ud.dealership_id); } catch { /* service client may not be configured yet */ }
  }

  const usageValues = [usage.agentRuns, usage.smsSent, usage.emailSent, usage.mailPiecesSent];

  return (
    <>
      <Header title="Billing" subtitle="Subscription & usage-based pricing" userEmail={user?.email} />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">

        {/* ── Current plan banner ──────────────────────────────── */}
        <div
          className="rounded-[var(--radius)] overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #0B1526 0%, #1E3048 100%)" }}
        >
          <div className="absolute inset-0 dark-grid opacity-60" />
          <div className="relative px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="chip chip-emerald">Trial</span>
                <span className="text-xs font-medium text-white/60">14 days remaining</span>
              </div>
              <p className="text-lg font-bold text-white">Free Trial</p>
              <p className="text-sm text-white/60 mt-0.5">Upgrade to unlock all features before your trial ends.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Sparkles className="w-4 h-4 text-white/30 hidden sm:block" />
              <Button className="bg-white text-slate-900 hover:bg-white/90 font-semibold shadow-[0_1px_3px_0_rgb(0_0_0/0.25)] shrink-0">
                Upgrade Now <ArrowUpRight className="ml-1.5 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Plans ────────────────────────────────────────────── */}
        <div>
          <h2 className="text-[13px] font-semibold text-slate-700 mb-3 uppercase tracking-wide">Choose a Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`feature-card ${plan.featureCard} relative bg-white rounded-[var(--radius)] border shadow-card flex flex-col ${
                  plan.highlight
                    ? "border-indigo-300 ring-1 ring-indigo-200"
                    : "border-slate-200"
                }`}
              >
                {plan.badge && (
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
                <div className="px-5 py-4 flex-1 space-y-2.5">
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
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                    size="sm"
                  >
                    {plan.name === "Enterprise" ? "Contact Sales" : `Start with ${plan.name}`}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Usage this month ─────────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div>
              <div className="inst-panel-title">Usage This Month</div>
              <div className="inst-panel-subtitle">Resets on the 1st. Billed in arrears.</div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[17px] font-bold text-slate-900 tabular-nums">${(usage.totalCostCents / 100).toFixed(2)}</span>
              <span className="text-xs text-slate-400 font-medium">charged</span>
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

        {/* ── Payment method ───────────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div className="inst-panel-title">Payment Method</div>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4 p-4 border border-slate-200 rounded-[var(--radius)] bg-slate-50/50">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-card shrink-0">
                <CreditCard className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800">No payment method on file</p>
                <p className="text-xs text-slate-400 mt-0.5">Add a card to activate your subscription after the trial.</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-8 shrink-0">
                <Zap className="w-3 h-3 mr-1.5" /> Add Card
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Payments processed securely via Stripe. Usage metering via Orb (Phase 2).
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
