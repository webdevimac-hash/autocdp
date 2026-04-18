import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Megaphone, Mail, TrendingUp, ArrowUpRight,
  Bot, Clock, CheckCircle,
} from "lucide-react";
import { formatRelativeDate, formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Load dealership
  const { data: userDealership } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user!.id)
    .single();

  const dealershipId = userDealership?.dealership_id;

  // Parallel data fetches
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

  // Quick stats
  const vipCount = customers.filter((c) => c.lifecycle_stage === "vip").length;
  const atRiskCount = customers.filter((c) => c.lifecycle_stage === "at_risk").length;
  const totalRevenue = customers.reduce((s, c) => s + (c.total_spend ?? 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const sentThisMonth = comms.filter((c) => c.status === "sent" || c.status === "delivered").length;

  const stats = [
    { title: "Total Customers", value: totalCustomers.toLocaleString(), icon: Users, change: "+12%", color: "text-blue-600 bg-blue-50" },
    { title: "Active Campaigns", value: activeCampaigns, icon: Megaphone, change: "+2 this week", color: "text-purple-600 bg-purple-50" },
    { title: "Sent This Month", value: sentThisMonth.toLocaleString(), icon: Mail, change: "30-day window", color: "text-green-600 bg-green-50" },
    { title: "Total Customer Value", value: `$${(totalRevenue / 1000).toFixed(0)}k`, icon: TrendingUp, change: "All time", color: "text-amber-600 bg-amber-50" },
  ];

  const agentTypeColors: Record<string, string> = {
    orchestrator: "bg-purple-100 text-purple-700",
    data: "bg-blue-100 text-blue-700",
    targeting: "bg-indigo-100 text-indigo-700",
    creative: "bg-green-100 text-green-700",
    optimization: "bg-amber-100 text-amber-700",
  };

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Welcome back — here's what's happening"
        userEmail={user?.email}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.change}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Recent campaigns */}
          <div className="xl:col-span-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">Recent Campaigns</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/campaigns">View all <ArrowUpRight className="ml-1 w-3.5 h-3.5" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {campaigns.length === 0 ? (
                  <div className="px-6 py-10 text-center text-muted-foreground text-sm">
                    No campaigns yet. <Link href="/dashboard/campaigns" className="text-primary hover:underline">Create your first</Link>.
                  </div>
                ) : (
                  <div className="divide-y">
                    {campaigns.map((c) => (
                      <div key={c.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{c.channel.replace("_", " ")} · Updated {formatRelativeDate(c.updated_at)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{(c.stats as { sent?: number })?.sent?.toLocaleString() ?? 0} sent</p>
                          <Badge
                            variant={c.status === "active" ? "success" : c.status === "draft" ? "secondary" : "outline"}
                            className="text-[10px] mt-0.5"
                          >
                            {c.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Customer health */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Customer Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "VIP", count: vipCount, color: "bg-amber-500", pct: totalCustomers ? vipCount / totalCustomers : 0 },
                  { label: "Active", count: customers.filter((c) => c.lifecycle_stage === "active").length, color: "bg-green-500", pct: totalCustomers ? customers.filter((c) => c.lifecycle_stage === "active").length / totalCustomers : 0 },
                  { label: "At Risk", count: atRiskCount, color: "bg-orange-500", pct: totalCustomers ? atRiskCount / totalCustomers : 0 },
                  { label: "Lapsed", count: customers.filter((c) => c.lifecycle_stage === "lapsed").length, color: "bg-red-500", pct: totalCustomers ? customers.filter((c) => c.lifecycle_stage === "lapsed").length / totalCustomers : 0 },
                ].map((seg) => (
                  <div key={seg.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{seg.label}</span>
                      <span className="font-medium">{seg.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${seg.color} rounded-full`} style={{ width: `${Math.round(seg.pct * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent agent activity */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">Agent Activity</CardTitle>
                <Bot className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {agentRuns.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No agent runs yet.</p>
                ) : (
                  agentRuns.map((run) => (
                    <div key={run.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50">
                      <div className="mt-0.5 shrink-0">
                        {run.status === "completed" ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : run.status === "running" ? (
                          <Clock className="w-4 h-4 text-blue-500 animate-pulse-slow" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-red-200" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${agentTypeColors[run.agent_type] ?? "bg-gray-100 text-gray-600"}`}>
                            {run.agent_type}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{formatRelativeDate(run.created_at)}</span>
                        </div>
                        {run.output_summary && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{run.output_summary}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
