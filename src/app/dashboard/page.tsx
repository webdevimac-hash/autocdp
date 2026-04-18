import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import {
  Users, Megaphone, Mail, TrendingUp, ArrowUpRight,
  Bot, Clock, CheckCircle, Sparkles,
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
    supabase.from("campaigns").select("id, name, status, stats, channel, updated_at").eq("dealership_id", dealershipId ?? "").order("updated_at", { ascending: false }).limit(5),
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
      change: "+12% vs last month",
      icon: Users,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      trend: "up",
    },
    {
      title: "Active Campaigns",
      value: activeCampaigns,
      change: `${campaigns.length} total`,
      icon: Megaphone,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      trend: "neutral",
    },
    {
      title: "Sent This Month",
      value: sentThisMonth.toLocaleString(),
      change: "30-day window",
      icon: Mail,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      trend: "up",
    },
    {
      title: "Customer Value",
      value: `$${(totalRevenue / 1000).toFixed(0)}k`,
      change: "All-time total spend",
      icon: TrendingUp,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      trend: "up",
    },
  ];

  const agentTypeColors: Record<string, string> = {
    orchestrator: "bg-violet-100 text-violet-700",
    data: "bg-sky-100 text-sky-700",
    targeting: "bg-indigo-100 text-indigo-700",
    creative: "bg-emerald-100 text-emerald-700",
    optimization: "bg-amber-100 text-amber-700",
  };

  const segments = [
    { label: "VIP", count: vipCount, color: "bg-amber-500", pct: totalCustomers ? vipCount / totalCustomers : 0 },
    { label: "Active", count: customers.filter((c) => c.lifecycle_stage === "active").length, color: "bg-emerald-500", pct: totalCustomers ? customers.filter((c) => c.lifecycle_stage === "active").length / totalCustomers : 0 },
    { label: "At Risk", count: atRiskCount, color: "bg-orange-500", pct: totalCustomers ? atRiskCount / totalCustomers : 0 },
    { label: "Lapsed", count: customers.filter((c) => c.lifecycle_stage === "lapsed").length, color: "bg-red-400", pct: totalCustomers ? customers.filter((c) => c.lifecycle_stage === "lapsed").length / totalCustomers : 0 },
  ];

  return (
    <>
      <Header title="Dashboard" subtitle="Your dealership at a glance" userEmail={user?.email} />

      <main className="flex-1 p-6 space-y-6 max-w-[1400px]">

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.title} className="bg-white rounded-xl border border-slate-200 p-5 shadow-card hover:shadow-card-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.iconBg}`}>
                  <stat.icon className={`w-4.5 h-4.5 ${stat.iconColor}`} />
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.title}</p>
                <p className="text-xs text-slate-400 pt-1">{stat.change}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Recent campaigns */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent Campaigns</h2>
              <Link
                href="/dashboard/campaigns"
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {campaigns.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Megaphone className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No campaigns yet.</p>
                <Link href="/dashboard/campaigns" className="text-xs text-indigo-600 hover:underline mt-1 inline-block">
                  Create your first campaign →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {campaigns.map((c) => (
                  <div key={c.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400 capitalize mt-0.5">
                        {c.channel.replace("_", " ")} · {formatRelativeDate(c.updated_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {(c.stats as { sent?: number })?.sent?.toLocaleString() ?? 0}
                        <span className="text-xs font-normal text-slate-400 ml-1">sent</span>
                      </p>
                      <Badge
                        variant={c.status === "active" ? "success" : c.status === "draft" ? "secondary" : "outline"}
                        className="text-[10px] mt-1"
                      >
                        {c.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Customer health */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Customer Health</h2>
              <div className="space-y-3.5">
                {segments.map((seg) => (
                  <div key={seg.label}>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-500 font-medium">{seg.label}</span>
                      <span className="font-semibold text-slate-700 tabular-nums">{seg.count.toLocaleString()}</span>
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
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Agent Activity</h2>
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
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${agentTypeColors[run.agent_type] ?? "bg-slate-100 text-slate-600"}`}>
                            {run.agent_type}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatRelativeDate(run.created_at)}</span>
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
