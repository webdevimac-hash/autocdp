import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import {
  Users,
  Megaphone,
  Mail,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Bot,
  Database,
  Zap,
  ChevronRight,
} from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import Link from "next/link";
import { isDemoMode } from "@/lib/demo";
import {
  DEMO_CUSTOMERS_DATA,
  DEMO_CUSTOMERS_COUNT,
  DEMO_CAMPAIGNS,
  DEMO_COMMS,
  DEMO_AGENT_RUNS,
} from "@/lib/demo-data";
import { DmsRoiPanel } from "@/components/dashboard/dms-roi-panel";
import { CadencePanel } from "@/components/dashboard/cadence-panel";
import { StatCardPremium } from "@/components/dashboard/stat-card-premium";
import { CustomerHealthCard } from "@/components/dashboard/customer-health-card";
import { AgentActivityCard } from "@/components/dashboard/agent-activity-card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const demoMode = await isDemoMode();

  const { data: userDealership } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  const dealershipId = userDealership?.dealership_id;

  let customers: { id: string; lifecycle_stage: string; total_spend: number }[];
  let totalCustomers: number;
  let campaigns: { id: string; name: string; status: string; stats: unknown; channel: string; updated_at: string }[];
  let comms: { id: string; status: string; channel: string; created_at: string }[];
  let agentRuns: { id: string; agent_type: string; status: string; created_at: string; output_summary: string | null }[];

  if (demoMode) {
    customers      = DEMO_CUSTOMERS_DATA;
    totalCustomers = DEMO_CUSTOMERS_COUNT;
    campaigns      = DEMO_CAMPAIGNS as typeof campaigns;
    comms          = DEMO_COMMS;
    agentRuns      = DEMO_AGENT_RUNS as typeof agentRuns;
  } else {
    const [customersRes, campaignsRes, commsRes, agentRunsRes] = await Promise.all([
      supabase.from("customers").select("id, lifecycle_stage, total_spend", { count: "exact" }).eq("dealership_id", dealershipId ?? ""),
      supabase.from("campaigns").select("id, name, status, stats, channel, updated_at").eq("dealership_id", dealershipId ?? "").order("updated_at", { ascending: false }).limit(6),
      supabase.from("communications").select("id, status, channel, created_at").eq("dealership_id", dealershipId ?? "").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("agent_runs").select("id, agent_type, status, created_at, output_summary").eq("dealership_id", dealershipId ?? "").order("created_at", { ascending: false }).limit(6),
    ]);
    customers      = customersRes.data ?? [];
    totalCustomers = customersRes.count ?? 0;
    campaigns      = campaignsRes.data ?? [];
    comms          = commsRes.data ?? [];
    agentRuns      = agentRunsRes.data ?? [];
  }

  // ── Derived ─────────────────────────────────────────────────────
  const vipCount     = customers.filter((c) => c.lifecycle_stage === "vip").length;
  const activeCount  = customers.filter((c) => c.lifecycle_stage === "active").length;
  const atRiskCount  = customers.filter((c) => c.lifecycle_stage === "at_risk").length;
  const lapsedCount  = customers.filter((c) => c.lifecycle_stage === "lapsed").length;
  const totalRevenue = customers.reduce((s, c) => s + (Number(c.total_spend) || 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const sentThisMonth   = comms.filter((c) => c.status === "sent" || c.status === "delivered").length;

  const isSent = (c: { status: string }) => c.status === "sent" || c.status === "delivered";
  const directMailSentCount = comms.filter((c) => c.channel === "direct_mail" && isSent(c)).length;
  const smsSentCount        = comms.filter((c) => c.channel === "sms"          && isSent(c)).length;
  const emailSentCount      = comms.filter((c) => c.channel === "email"        && isSent(c)).length;

  // 7-day per-day send count -> sparkline for "Sent This Month" card.
  const sendSpark = buildSendSpark(comms);

  // Customer Health segments
  const segments = [
    { label: "VIP",     count: vipCount,    pct: totalCustomers ? vipCount    / totalCustomers : 0, bgClass: "bg-amber-400",  dotClass: "text-amber-500" },
    { label: "Active",  count: activeCount, pct: totalCustomers ? activeCount / totalCustomers : 0, bgClass: "bg-emerald-500", dotClass: "text-emerald-500" },
    { label: "At Risk", count: atRiskCount, pct: totalCustomers ? atRiskCount / totalCustomers : 0, bgClass: "bg-orange-500",  dotClass: "text-orange-500" },
    { label: "Lapsed",  count: lapsedCount, pct: totalCustomers ? lapsedCount / totalCustomers : 0, bgClass: "bg-red-400",     dotClass: "text-red-400" },
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
      <Header
        title="Dashboard"
        subtitle="Your dealership at a glance — refreshed every sync"
        userEmail={user?.email}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-[1500px]">

        {/* ── Setup prompt — institutional empty state ─────────── */}
        {totalCustomers === 0 && <SetupPrompt />}

        {/* ── Premium stat cards ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCardPremium
            title="Total Customers"
            value={totalCustomers.toLocaleString()}
            change="+12%"
            trend="up"
            note="vs. last month"
            icon={Users}
            tone="indigo"
            href="/dashboard/customers"
            progress={{ value: totalCustomers > 0 ? Math.round((activeCount / totalCustomers) * 100) : 0, label: "Active share" }}
          />
          <StatCardPremium
            title="Active Campaigns"
            value={activeCampaigns.toLocaleString()}
            change={`${campaigns.length} total`}
            trend="neutral"
            icon={Megaphone}
            tone="violet"
            href="/dashboard/campaigns"
            spark={buildCampaignSpark(campaigns.length, activeCampaigns)}
          />
          <StatCardPremium
            title="Sent This Month"
            value={sentThisMonth.toLocaleString()}
            change="+8%"
            trend="up"
            note="30-day window"
            icon={Mail}
            tone="emerald"
            href="/dashboard/analytics"
            spark={sendSpark}
          />
          <StatCardPremium
            title="Customer Value"
            value={
              totalRevenue >= 1_000_000
                ? `$${(totalRevenue / 1_000_000).toFixed(1)}M`
                : `$${(totalRevenue / 1000).toFixed(0)}k`
            }
            change="All-time"
            trend="neutral"
            note="total spend"
            icon={TrendingUp}
            tone="amber"
            href="/dashboard/analytics"
          />
        </div>

        {/* ── DMS ROI Dashboard ───────────────────────────────── */}
        <DmsRoiPanel
          directMailSent={directMailSentCount}
          smsSent={smsSentCount}
          emailSent={emailSentCount}
          campaignCount={campaigns.length}
        />

        {/* ── Contact Cadence ──────────────────────────────────── */}
        {!demoMode && dealershipId && <CadencePanel dealershipId={dealershipId} />}

        {/* ── Main grid: Recent Campaigns (2/3) + Health + Agents (1/3) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Recent Campaigns table */}
          <div className="xl:col-span-2 inst-panel overflow-hidden">
            <div className="inst-panel-header">
              <div>
                <div className="inst-panel-title">Recent Campaigns</div>
                <div className="inst-panel-subtitle">
                  {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} total · across {channelCount(campaigns)} channels
                </div>
              </div>
              <Link
                href="/dashboard/campaigns"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {campaigns.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                  <Megaphone className="h-5 w-5 text-slate-300" />
                </div>
                <p className="text-[13px] font-semibold text-slate-700">
                  No campaigns yet
                </p>
                <p className="mt-1 text-[11.5px] text-slate-400">
                  Launch your first AI swarm campaign to populate this table.
                </p>
                <Link
                  href="/dashboard/campaigns"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  Create campaign →
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
                    <tr key={c.id} className="cursor-pointer">
                      <td>
                        <p className="font-semibold text-slate-900 text-[13px] truncate max-w-[260px]">
                          {c.name}
                        </p>
                      </td>
                      <td>
                        <ChannelChip channel={c.channel} />
                      </td>
                      <td className="text-right tabular-nums font-semibold text-slate-900">
                        {(c.stats as { sent?: number })?.sent?.toLocaleString() ?? "0"}
                      </td>
                      <td>
                        <span className={campaignStatusStyle[c.status] ?? "chip chip-slate"}>
                          {c.status}
                        </span>
                      </td>
                      <td className="text-slate-400 text-xs">
                        {formatRelativeDate(c.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <CustomerHealthCard
              totalCustomers={totalCustomers}
              segments={segments}
            />
            <AgentActivityCard
              runs={agentRuns}
            />
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildSendSpark(comms: { created_at: string; status: string }[]): number[] {
  // 7 buckets of one day each, oldest → newest.
  const now = Date.now();
  const buckets = new Array(7).fill(0) as number[];
  for (const c of comms) {
    const ts = new Date(c.created_at).getTime();
    const ageDays = Math.floor((now - ts) / 86400_000);
    if (ageDays >= 0 && ageDays < 7) {
      buckets[6 - ageDays] += 1;
    }
  }
  const max = Math.max(1, ...buckets);
  return buckets.map((n) => Math.round((n / max) * 100));
}

function buildCampaignSpark(total: number, active: number): number[] {
  // Synthetic gentle uptick — emphasises active vs total ratio.
  const ratio = total > 0 ? active / total : 0.4;
  const base = [40, 55, 50, 62, 70, 78, 88];
  return base.map((b) => Math.min(100, Math.round(b * (0.6 + ratio * 0.6))));
}

function channelCount(campaigns: { channel: string }[]): number {
  return new Set(campaigns.map((c) => c.channel)).size || 0;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function ChannelChip({ channel }: { channel: string }) {
  const map: Record<
    string,
    { label: string; chipClass: string }
  > = {
    sms:         { label: "SMS",   chipClass: "chip chip-violet" },
    email:       { label: "Email", chipClass: "chip chip-sky" },
    direct_mail: { label: "Mail",  chipClass: "chip chip-indigo" },
  };
  const cfg = map[channel] ?? {
    label: channel.replace("_", " "),
    chipClass: "chip chip-slate",
  };
  return <span className={cfg.chipClass}>{cfg.label}</span>;
}

function SetupPrompt() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
      style={{
        background:
          "linear-gradient(135deg, #EEF2FF 0%, #FAF5FF 50%, #ECFDF5 100%)",
        border: "1px solid rgba(99,102,241,0.18)",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 20px 40px -20px rgba(99,102,241,0.20)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: "rgba(99,102,241,0.18)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: "rgba(16,185,129,0.14)" }}
      />

      <div className="relative flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #4F46E5 0%, #10B981 100%)",
            boxShadow: "0 6px 18px -4px rgba(79,70,229,0.45)",
          }}
        >
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold tracking-tight text-slate-900">
            Complete your setup to activate the AI swarm
          </p>
          <p className="text-[12.5px] text-slate-500 mt-0.5 mb-4">
            Import your customers and inventory so the agent swarm can start generating personalized campaigns.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { href: "/dashboard/onboard/wizard",        icon: Database, label: "Import customers & inventory", desc: "Upload CSV from your DMS",       tone: "indigo" },
              { href: "/dashboard/integrations",          icon: Sparkles, label: "Connect your DMS",            desc: "CDK, Reynolds, VinSolutions",   tone: "violet" },
              { href: "/dashboard/onboard/wizard?step=2", icon: Bot,      label: "Run a test campaign",         desc: "See AI in action in 60 seconds", tone: "emerald" },
            ].map((item) => {
              const toneClasses =
                item.tone === "indigo"  ? "from-indigo-50 to-indigo-100 ring-indigo-200 text-indigo-600" :
                item.tone === "violet"  ? "from-violet-50 to-violet-100 ring-violet-200 text-violet-600" :
                                          "from-emerald-50 to-emerald-100 ring-emerald-200 text-emerald-600";
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl bg-white/85 backdrop-blur-sm p-3 border border-white ring-1 ring-slate-100 hover:ring-slate-300 hover:shadow-md transition-all"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${toneClasses} ring-1`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-slate-800 truncate">
                      {item.label}
                    </p>
                    <p className="text-[10.5px] text-slate-500 truncate">
                      {item.desc}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
