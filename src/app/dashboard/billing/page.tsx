import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreditCard, CheckCircle, Zap, Mail, MessageSquare, FileText, Bot, ArrowUpRight } from "lucide-react";
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
    badge: null,
  },
];

const USAGE_ITEMS = [
  { label: "Agent Runs", icon: Bot, unit: "runs", unitCost: "$0.05" },
  { label: "SMS Sent", icon: MessageSquare, unit: "messages", unitCost: "$0.02" },
  { label: "Emails Sent", icon: Mail, unit: "emails", unitCost: "Included" },
  { label: "Mail Pieces", icon: FileText, unit: "pieces", unitCost: "$1.50" },
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

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Current plan banner */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-brand-600 to-brand-700 text-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/20 text-white border-0 text-xs">Trial</Badge>
                <span className="text-sm font-medium opacity-80">14 days remaining</span>
              </div>
              <p className="text-xl font-bold">Free Trial</p>
              <p className="text-sm opacity-80 mt-0.5">Upgrade to unlock all features before your trial ends.</p>
            </div>
            <Button className="bg-white text-brand-700 hover:bg-white/90 shrink-0">
              Upgrade Now <ArrowUpRight className="ml-1.5 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Plans */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Choose a Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={`border-0 shadow-sm relative ${plan.highlight ? "ring-2 ring-brand-600" : ""}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-brand-600 text-white text-[10px]">{plan.badge}</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription className="text-xs">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full mt-2 ${plan.highlight ? "" : ""}`}
                    variant={plan.highlight ? "default" : "outline"}
                    size="sm"
                  >
                    {plan.name === "Enterprise" ? "Contact Sales" : `Start with ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Usage this month */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Usage This Month</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">${(usage.totalCostCents / 100).toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">charged</span>
              </div>
            </div>
            <CardDescription className="text-xs">Usage resets on the 1st of each month. Billed in arrears.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {USAGE_ITEMS.map((item, i) => (
              <div key={item.label}>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <item.icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.unitCost} per {item.unit}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{usageValues[i].toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{item.unit}</p>
                  </div>
                </div>
                {i < USAGE_ITEMS.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment method placeholder */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <CreditCard className="w-8 h-8 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">No payment method on file</p>
                <p className="text-xs text-muted-foreground">Add a card to activate your subscription after the trial.</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <Zap className="w-3 h-3 mr-1.5" /> Add Card
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Payments processed securely via Stripe. Usage metering via Orb (Phase 2).
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
