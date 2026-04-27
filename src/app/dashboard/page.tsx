import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import {
  Users, Megaphone, Mail, TrendingUp, ArrowUpRight,
  Bot, Clock, CheckCircle, Sparkles, ArrowUp, ArrowDown,
  Zap, Database, ChevronRight,
} from "lucide-react";
import { formatRelativeDate, formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: userDealership } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user!.id)
    .single();

  const dealershipId = userDealership?.dealership_id;

  const [customersRes, campaignsRes, commsRes, agentRunsRes] = await Promise.all([
    supabase.from("customers").select("id, lifecycle_stage, total_spend", { count: "exact" }).eq("dealership_id", dealershipId ?? ""),
    supabase.from("campaigns").select("id, name, status, stats, channel, updated_at").eq("dealership_id", dealershipId ?? "").order("updated_at", { ascending: false }).limit(6),
    supabase.from("communications").select("id, status, channel, created_at").eq("dealership_id", dealershipId ?? "").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("agent_runs").select("id, agent_type, status, created_at, output_summary").eq("dealership_id", dealershipId ?? "").order("created_at", { ascending: false }).limit(6),
  ]);

  const customers = customersRes.data ?? [];
  const totalCustomers = customersRes.count ?? 0;
  const campaigns = campaignsRes.data ?? [];
  const comms = commsRes.data ?? [];
  const agentRuns = agentRunsRes.data ?? [];

  const vipCount = customers.filter((c) => c.lifecycle_stage === "vip").length;
  const atRiskCount = customers.filter((c) => c.lifecycle_stage === "at_risk").length;
  const totalRevenue = customers.reduce((s, c) => s + (c.total_spend ?? 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const sentThisMonth = comms.filter((c) => c.status === "sent" || c.status === "delivered").length;

  const stats = [
    {
      title: "Total Customers",
      value: totalCustomers.toLocaleString(),
      change: "+12%",
      trend: "up" as const,
      note: "vs. last month",
      icon: Users,
      accent: "stat-card-indigo",
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      href: "/dashboard/customers",
    },
    {
      title: "Active Campaigns",
      value: String(activeCampaigns),
      change: String(campaigns.length),
      trend: "neutral" as const,
      note: "campaigns total",
      icon: Megaphone,
      accent: "stat-card-violet",
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      href: "/dashboard/campaigns",
    },
    {
      title: "Sent This Month",
      value: sentThisMonth.toLocaleString(),
      change: "+8%",
      trend: "up" as const,
      note: "30-day window",
      icon: Mail,
      accent: "stat-card-emerald",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      href: "/dashboard/analytics",
    },
    {
      title: "Customer Value",
      value: totalRevenue >= 1000000 ? `$${(totalRevenue / 1000000).toFixed(1)}M` : `$${(totalRevenue / 1000).toFixed(0)}k`,
      change: "All-time",
      trend: "neutral" as const,
      note: "total spend",
      icon: TrendingUp,
      accent: "stat-card-amber",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      href: "/dashboard/analytics",
    },
  ];

  const agentTypeColors: Record<string, string> = {
    orchestrator: "chip chip-violet",
    data:         "chip chip-sky",
    targeting:    "chip chip-indigo",
    creative:     "chip chip-emerald",
    optimization: "chip chip-amber",
  };

  const segments = [
    { label: "VIP",     count: vipCount,      pct: totalCustomers ? vipCount / totalCustomers : 0,      color: "bg-amber-400" },
    { label: "Active",  count: customers.filter(c => c.lifecycle_stage === "active").length, pct: totalCustomers ? customers.filter(c => c.lifecycle_stage === "active").length / totalCustomers : 0, color: "bg-emerald-500" },
    { label: "At Risk", count: atRiskCount,    pct: totalCustomers ? atRiskCount / totalCustomers : 0,    color: "bg-orange-500" },
    { label: "Lapsed",  count: customers.filter(c => c.lifecycle_stage === "lapsed").length, pct: totalCustomers ? customers.filter(c => c.lifecycle_stage === "lapsed").length / totalCustomers : 0, color: "bg-red-400" },
  ];

  const campaignStatusStyle: Record<string, string> = {
    active:    "chip chip-emerald",
    draft:     "chip chip-slate",
    scheduled: "chip chip-sky",
    paused:    "chip chip-amber",
    completed: "chip chip-slate",
  };

  return (
    <>
      <Header title="Dashboard" subtitle="Your dealership at a glance" userEmail={user?.email} />

      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-[1400px]">

        {/* ── Setup prompt (shown until data is imported) ──────── */}
        {totalCustomers === 0 && (
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-slate-900">Complete your setup to activate AI agents</p>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">Import your customers and inventory so the agent swarm can start generating personalized campaigns.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { href: "/dashboard/onboard/wizard", icon: Database, label: "Import customers & inventory", desc: "Upload CSV from your DMS" },
                    { href: "/dashboard/integrations",   icon: Sparkles,  label: "Connect your DMS",            desc: "CDK, Reynolds, VinSolutions" },
                    { href: "/dashboard/onboard/wizard?step=2", icon: Bot, label: "Run a test campaign",        desc: "See AI in action in 60 seconds" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white border border-indigo-100 hover:border-indigo-300 hover:shadow-sm transition-all group"
                    >
                      <item.icon className="w-4 h-4 text-indigo-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-800 truncate">{item.label}</p>
                        <p className="text-[10px] text-slate-400">{item.desc}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Stat cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Link key={stat.title} href={stat.href} className="block group">
              <div className={`stat-card ${stat.accent} group-hover:shadow-card-hover`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.iconBg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
                <div className="metric-value">{stat.value}</div>
                <div className="metric-label">{stat.title}</div>
                <div className={`metric-change ${stat.trend === "up" ? "metric-change-up" : "metric-change-flat"}`}>
                  {stat.trend === "up" && <ArrowUp className="w-3 h-3" />}
                  {stat.trend === "down" && <ArrowDown className="w-3 h-3" />}
                  {stat.change} <span className="font-normal text-slate-400">{stat.note}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Main grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Recent campaigns — table style */}
          <div className="xl:col-span-2 inst-panel">
            <div className="inst-panel-header">
              <div>
                <div className="inst-panel-title">Recent Campaigns</div>
                <div className="inst-panel-subtitle">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} total</div>
              </div>
              <Link
                href="/dashboard/campaigns"
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {campaigns.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <Megaphone className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">No campaigns yet</p>
                <Link href="/dashboard/campaigns" className="text-xs text-indigo-600 hover:underline">
                  Create your first campaign →
                </Link>
              </div>
            ) : (
              <table className="inst-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Channel</th>
                    <th className="text-right">Sent</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <p className="font-medium text-slate-900 text-[13px] truncate max-w-[200px]">{c.name}</p>
                      </td>
                      <td>
                        <span className="text-xs text-slate-500 capitalize">{c.channel.replace("_", " ")}</span>
                      </td>
                      <td className="text-right tabular-nums font-semibold text-slate-900">
                        {(c.stats as { sent?: number })?.sent?.toLocaleString() ?? "0"}
                      </td>
                      <td>
                        <span className={campaignStatusStyle[c.status] ?? "chip chip-slate"}>
                          {c.status}
                        </span>
                      </td>
                      <td className="text-slate-400 text-xs">{formatRelativeDate(c.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">

            {/* Customer health */}
            <div className="inst-panel">
              <div className="inst-panel-header">
                <div className="inst-panel-title">Customer Health</div>
                <span className="text-xs text-slate-400 font-medium tabular-nums">{totalCustomers.toLocaleString()} total</span>
              </div>
              <div className="p-5 space-y-4">
                {segments.map((seg) => (
                  <div key={seg.label}>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-500 font-medium">{seg.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 tabular-nums">{seg.count.toLocaleString()}</span>
                        <span className="font-semibold text-slate-700 tabular-nums w-9 text-right">{totalCustomers ? Math.round(seg.pct * 100) : 0}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${seg.color}`}
                        style={{ width: `${Math.max(2, Math.round(seg.pct * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent activity */}
            <div className="inst-panel">
              <div className="inst-panel-header">
                <div className="inst-panel-title">Agent Activity</div>
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="p-3">
                {agentRuns.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bot className="w-7 h-7 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No agent runs yet.</p>
                  </div>
                ) : (
                  agentRuns.map((run) => (
                    <div key={run.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="mt-0.5 shrink-0">
                        {run.status === "completed" ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        ) : run.status === "running" ? (
                          <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full bg-red-200 mt-0.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`${agentTypeColors[run.agent_type] ?? "chip chip-slate"} capitalize`}>
                            {run.agent_type}
                          </span>
                          <span className="text-[11px] text-slate-400">{formatRelativeDate(run.created_at)}</span>
                        </div>
                        {run.output_summary && (
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{run.output_summary}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
