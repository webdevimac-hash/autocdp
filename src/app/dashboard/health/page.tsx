import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { HealthClient } from "@/components/health/health-client";
import type { HealthAnalysis } from "@/lib/anthropic/agents/health-agent";
import {
  Users, AlertTriangle, Car, Activity,
  Mail, MessageSquare, AtSign, CheckCircle2,
  Zap, Bot, Database, Clock, XCircle,
} from "lucide-react";
import { getDailyUsage, DAILY_LIMITS } from "@/lib/rate-limit";

export const metadata = { title: "Dealership Health" };

// ─── helpers ─────────────────────────────────────────────────────────────────

function pct(used: number, limit: number) {
  return Math.round((used / limit) * 100);
}

function formatTs(ts: string | null) {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function lifecycleBar(count: number, total: number, colorClass: string, label: string) {
  const pctVal = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-slate-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pctVal}%` }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-slate-700 w-8 text-right">{count}</span>
    </div>
  );
}

function agingBar(count: number, total: number, colorClass: string, label: string) {
  const pctVal = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-slate-700">{count}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pctVal}%` }} />
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DealershipHealthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) redirect("/onboarding");

  const svc = createServiceClient();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const todayUtc = new Date(); todayUtc.setUTCHours(0, 0, 0, 0);

  // ── Parallel data fetch ──────────────────────────────────────
  const [
    customersRes,
    inventoryRes,
    mailRes,
    commsRes,
    visitsRes,
    agentRunsRes,
    cachedHealthRes,
    // System health queries
    usage,
    agentRows,
    failedRuns,
    lastImport,
    customerCount,
    inventoryCount,
  ] = await Promise.all([
    svc.from("customers")
      .select("lifecycle_stage, email, phone, last_visit_date")
      .eq("dealership_id", dealershipId)
      .limit(20000),

    svc.from("inventory")
      .select("days_on_lot, status")
      .eq("dealership_id", dealershipId)
      .limit(2000),

    svc.from("mail_pieces")
      .select("status, scanned_count")
      .eq("dealership_id", dealershipId)
      .gte("created_at", ninetyDaysAgo)
      .limit(10000),

    svc.from("communications")
      .select("channel, status")
      .eq("dealership_id", dealershipId)
      .gte("created_at", ninetyDaysAgo)
      .limit(10000),

    svc.from("visits")
      .select("customer_id, total_amount")
      .eq("dealership_id", dealershipId)
      .gte("visit_date", ninetyDaysAgo)
      .limit(5000),

    svc.from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealershipId)
      .gte("created_at", thirtyDaysAgo),

    (svc.from("dealership_insights")
      .select("data, refreshed_at")
      .eq("dealership_id", dealershipId)
      .eq("insight_type", "health_snapshot")
      .eq("is_active", true)
      .single()) as unknown as Promise<{
        data: { data: Record<string, unknown>; refreshed_at: string } | null;
        error: unknown;
      }>,

    // System health
    getDailyUsage(dealershipId).catch(() => null),

    svc.from("agent_runs")
      .select("id, status, agent_type, created_at")
      .eq("dealership_id", dealershipId)
      .gte("created_at", todayUtc.toISOString())
      .order("created_at", { ascending: false })
      .limit(100)
      .then((r) => r.data ?? []),

    svc.from("agent_runs")
      .select("id, agent_type, status, created_at, output_summary")
      .eq("dealership_id", dealershipId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(10)
      .then((r) => r.data ?? []),

    svc.from("agent_runs")
      .select("created_at, agent_type")
      .eq("dealership_id", dealershipId)
      .eq("agent_type", "data")
      .order("created_at", { ascending: false })
      .limit(1)
      .then((r) => r.data?.[0] ?? null),

    svc.from("customers")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealershipId)
      .then((r) => r.count ?? 0),

    svc.from("inventory")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealershipId)
      .then((r) => r.count ?? 0),
  ]);

  // ── Customer computations ────────────────────────────────────
  type CustRow = { lifecycle_stage: string | null; email: string | null; phone: string | null; last_visit_date: string | null };
  const customers = (customersRes.data ?? []) as CustRow[];
  const custTotal = customers.length;

  const lifecycle = { vip: 0, active: 0, at_risk: 0, lapsed: 0, prospect: 0 };
  for (const c of customers) {
    const s = (c.lifecycle_stage ?? "prospect") as keyof typeof lifecycle;
    if (s in lifecycle) lifecycle[s]++;
  }
  const atRiskCount = lifecycle.at_risk;
  const atRiskPct = custTotal > 0 ? Math.round((atRiskCount / custTotal) * 100) : 0;

  // ── Inventory computations ───────────────────────────────────
  type InvRow = { days_on_lot: number; status: string };
  const available = ((inventoryRes.data ?? []) as InvRow[]).filter((v) => v.status === "available");
  const invTotal = available.length;
  const avgDaysOnLot = invTotal > 0
    ? Math.round(available.reduce((s, v) => s + (v.days_on_lot ?? 0), 0) / invTotal)
    : 0;
  const invBuckets = { lt30: 0, d30to60: 0, d60to90: 0, gt90: 0 };
  for (const v of available) {
    const d = v.days_on_lot ?? 0;
    if (d < 30) invBuckets.lt30++;
    else if (d < 60) invBuckets.d30to60++;
    else if (d < 90) invBuckets.d60to90++;
    else invBuckets.gt90++;
  }
  const agedCount = invBuckets.d60to90 + invBuckets.gt90;
  const agedPct = invTotal > 0 ? Math.round((agedCount / invTotal) * 100) : 0;

  // ── Campaign computations ────────────────────────────────────
  type MailRow = { status: string; scanned_count: number | null };
  const mailPieces = (mailRes.data ?? []) as MailRow[];
  const mailSent = mailPieces.length;
  const mailScanned = mailPieces.filter((m) => (m.scanned_count ?? 0) > 0).length;
  const mailScanRate = mailSent > 0 ? ((mailScanned / mailSent) * 100).toFixed(1) : "0";

  type CommRow = { channel: string; status: string };
  const comms = (commsRes.data ?? []) as CommRow[];
  const smsMsgs = comms.filter((c) => c.channel === "sms");
  const emailMsgs = comms.filter((c) => c.channel === "email");
  const smsSent = smsMsgs.length;
  const emailSent = emailMsgs.length;
  const emailOpened = emailMsgs.filter((m) => ["opened", "clicked", "converted"].includes(m.status)).length;
  const emailOpenRate = emailSent > 0 ? ((emailOpened / emailSent) * 100).toFixed(1) : "0";

  // ── Service computations ─────────────────────────────────────
  type VisitRow = { customer_id: string; total_amount: number | null };
  const visitRows = (visitsRes.data ?? []) as VisitRow[];
  const visitsLast90d = visitRows.length;
  const uniqueServiced = new Set(visitRows.map((v) => v.customer_id)).size;

  // ── Cached health analysis ───────────────────────────────────
  const cachedHealth = cachedHealthRes.data;
  const cachedAnalysis: HealthAnalysis | null = cachedHealth?.data
    ? (() => {
        const d = { ...cachedHealth.data } as unknown as Record<string, unknown>;
        delete d.metrics_snapshot;
        return d as unknown as HealthAnalysis;
      })()
    : null;
  const cachedAt = cachedHealth?.refreshed_at ?? null;

  // ── System health ────────────────────────────────────────────
  const agentRowsArr = agentRows as { status: string }[];
  const totalRuns = agentRowsArr.length;
  const successRate = totalRuns > 0
    ? Math.round((agentRowsArr.filter((r) => r.status === "completed").length / totalRuns) * 100)
    : null;

  const anthropicOk = !!process.env.ANTHROPIC_API_KEY;
  const postgridOk = !!process.env.POSTGRID_API_KEY;

  const mailPct = usage && DAILY_LIMITS.mail_piece_sent
    ? pct(usage.mail_piece_sent, DAILY_LIMITS.mail_piece_sent) : 0;
  const agentPct = usage && DAILY_LIMITS.agent_run
    ? pct(usage.agent_run, DAILY_LIMITS.agent_run) : 0;
  const smsPct = usage && DAILY_LIMITS.sms_sent
    ? pct(usage.sms_sent, DAILY_LIMITS.sms_sent) : 0;

  const agentRunsLast30d = agentRunsRes.count ?? 0;

  return (
    <>
      <Header
        title="Dealership Health"
        subtitle="Live metrics, trends, and AI-powered recommendations"
        userEmail={user?.email}
      />

      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-5">

        {/* ── 4 Stat Cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span className="stat-card-label">Total Customers</span>
            </div>
            <p className="metric-value">{custTotal.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {(lifecycle.active + lifecycle.vip).toLocaleString()} active / VIP
            </p>
          </div>

          <div className={`stat-card ${atRiskPct >= 25 ? "border-amber-200 bg-amber-50/50" : ""}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-4 h-4 ${atRiskPct >= 25 ? "text-amber-500" : "text-slate-400"}`} />
              <span className="stat-card-label">At-Risk</span>
            </div>
            <p className={`metric-value ${atRiskPct >= 25 ? "text-amber-700" : ""}`}>
              {atRiskCount.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{atRiskPct}% of customers</p>
          </div>

          <div className={`stat-card ${agedPct >= 30 ? "border-amber-200 bg-amber-50/50" : ""}`}>
            <div className="flex items-center gap-2 mb-2">
              <Car className={`w-4 h-4 ${agedPct >= 30 ? "text-amber-500" : "text-slate-400"}`} />
              <span className="stat-card-label">Avg Days on Lot</span>
            </div>
            <p className={`metric-value ${agedPct >= 30 ? "text-amber-700" : ""}`}>{avgDaysOnLot}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{agedPct}% aged 60+ days</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="stat-card-label">Service Visits</span>
            </div>
            <p className="metric-value">{visitsLast90d.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{uniqueServiced.toLocaleString()} unique customers · 90d</p>
          </div>
        </div>

        {/* ── Customer Lifecycle ───────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <div className="inst-panel-title">Customer Lifecycle</div>
            </div>
            <span className="text-xs text-slate-400 tabular-nums font-medium">{custTotal.toLocaleString()} total</span>
          </div>
          <div className="px-6 py-5 space-y-2.5">
            {lifecycleBar(lifecycle.vip, custTotal, "bg-yellow-400", "VIP")}
            {lifecycleBar(lifecycle.active, custTotal, "bg-emerald-500", "Active")}
            {lifecycleBar(lifecycle.at_risk, custTotal, "bg-amber-400", "At-Risk")}
            {lifecycleBar(lifecycle.lapsed, custTotal, "bg-red-400", "Lapsed")}
            {lifecycleBar(lifecycle.prospect, custTotal, "bg-slate-300", "Prospect")}
          </div>
          {(atRiskPct >= 25 || lifecycle.lapsed > 0) && (
            <div className="px-6 pb-4">
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {atRiskPct >= 25
                  ? `${atRiskPct}% of customers are at-risk — consider a win-back campaign.`
                  : `${lifecycle.lapsed.toLocaleString()} lapsed customers may benefit from a reactivation campaign.`}
              </p>
            </div>
          )}
        </div>

        {/* ── Inventory Aging ──────────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-slate-400" />
              <div className="inst-panel-title">Inventory Aging</div>
            </div>
            <span className="text-xs text-slate-400 tabular-nums font-medium">{invTotal.toLocaleString()} available</span>
          </div>
          <div className="px-6 py-5 space-y-3">
            {agingBar(invBuckets.lt30, invTotal, "bg-emerald-500", "< 30 days")}
            {agingBar(invBuckets.d30to60, invTotal, "bg-indigo-400", "30–60 days")}
            {agingBar(invBuckets.d60to90, invTotal, "bg-amber-400", "60–90 days")}
            {agingBar(invBuckets.gt90, invTotal, "bg-red-500", "90+ days")}
          </div>
          {agedPct >= 30 && (
            <div className="px-6 pb-4">
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {agedPct}% of inventory ({agedCount} vehicles) has been on the lot 60+ days — aged inventory campaigns can accelerate turnover.
              </p>
            </div>
          )}
        </div>

        {/* ── Campaign Performance ─────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <div className="inst-panel-title">Campaign Performance</div>
            </div>
            <span className="text-xs text-slate-400 font-medium">Last 90 days</span>
          </div>
          <div className="px-6 py-5 grid grid-cols-3 gap-6">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">Direct Mail</span>
              </div>
              <p className="text-xl font-bold tabular-nums text-slate-900">{mailSent.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400">pieces sent</p>
              <p className="text-xs font-semibold text-indigo-600 mt-1">{mailScanRate}% scan rate</p>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">SMS</span>
              </div>
              <p className="text-xl font-bold tabular-nums text-slate-900">{smsSent.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400">messages sent</p>
              <p className="text-xs font-semibold text-indigo-600 mt-1">{agentRunsLast30d} agent runs (30d)</p>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 mb-2">
                <AtSign className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">Email</span>
              </div>
              <p className="text-xl font-bold tabular-nums text-slate-900">{emailSent.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400">emails sent</p>
              <p className="text-xs font-semibold text-indigo-600 mt-1">{emailOpenRate}% open rate</p>
            </div>
          </div>
        </div>

        {/* ── AI Health Analysis ───────────────────────────────── */}
        <HealthClient cachedAnalysis={cachedAnalysis} cachedAt={cachedAt} />

        {/* ── System Status (collapsed) ────────────────────────── */}
        <details className="inst-panel group">
          <summary className="inst-panel-header cursor-pointer list-none select-none">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-slate-400" />
              <div className="inst-panel-title">System Status</div>
            </div>
            <span className="text-xs text-slate-400 group-open:hidden">Show</span>
            <span className="text-xs text-slate-400 hidden group-open:inline">Hide</span>
          </summary>

          <div className="divide-y divide-slate-50">
            {/* Services */}
            <div className="px-6 py-3 space-y-2">
              {[
                { label: "Claude AI (Anthropic)", ok: anthropicOk, detail: anthropicOk ? "API key configured" : "ANTHROPIC_API_KEY missing" },
                { label: "PostGrid (Direct Mail)", ok: postgridOk, detail: postgridOk ? "API key configured" : "POSTGRID_API_KEY missing" },
                { label: "Supabase Database", ok: true, detail: `${(customerCount as number).toLocaleString()} customers · ${(inventoryCount as number).toLocaleString()} inventory units` },
              ].map(({ label, ok, detail }) => (
                <div key={label} className="flex items-center gap-3 py-1">
                  {ok
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                  <span className="text-[13px] font-medium text-slate-800 flex-1">{label}</span>
                  <span className="text-xs text-slate-400">{detail}</span>
                </div>
              ))}
            </div>

            {/* Daily usage */}
            <div className="px-6 py-4 grid grid-cols-3 gap-5">
              {[
                { label: "Mail Pieces", used: usage?.mail_piece_sent ?? 0, limit: DAILY_LIMITS.mail_piece_sent ?? 0, p: mailPct, icon: Mail },
                { label: "Agent Runs", used: usage?.agent_run ?? 0, limit: DAILY_LIMITS.agent_run ?? 0, p: agentPct, icon: Bot },
                { label: "SMS Sent", used: usage?.sms_sent ?? 0, limit: DAILY_LIMITS.sms_sent ?? 0, p: smsPct, icon: Zap },
              ].map(({ label, used, limit, p, icon: Icon }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <Icon className="w-3 h-3 text-slate-400" />{label}
                    </span>
                    <span className={`text-[11px] font-bold tabular-nums ${p >= 100 ? "text-red-600" : p >= 80 ? "text-amber-600" : "text-slate-500"}`}>{p}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p >= 100 ? "bg-red-500" : p >= 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(p, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 tabular-nums">{used.toLocaleString()} / {limit.toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* Agent performance today */}
            <div className="px-6 py-4 flex items-center gap-6">
              <div className="text-center">
                <p className="text-xl font-bold tabular-nums text-slate-900">{totalRuns}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Runs today</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-bold tabular-nums ${successRate === null ? "text-slate-300" : successRate >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                  {successRate === null ? "—" : `${successRate}%`}
                </p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Success rate</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold tabular-nums text-slate-900">
                  {lastImport ? formatTs((lastImport as { created_at: string }).created_at) : "—"}
                </p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Last import</p>
              </div>
            </div>

            {/* Recent errors */}
            {(failedRuns as unknown[]).length > 0 && (
              <div className="px-6 py-3 space-y-1">
                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-2">Recent Errors</p>
                {(failedRuns as { created_at: string; agent_type: string; output_summary?: string }[]).map((err, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0 pt-0.5">
                      {new Date(err.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium text-slate-600 capitalize">{err.agent_type} agent</span>
                      {err.output_summary && (
                        <p className="text-[10px] text-slate-400 truncate">{err.output_summary}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(failedRuns as unknown[]).length === 0 && (
              <div className="px-6 py-3 flex items-center gap-2 text-[12px] text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                No errors recorded today
              </div>
            )}

            {/* Data sources */}
            <div className="px-6 py-3 space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Data Sources</p>
              {[
                { label: "CDK Drive (DMS)" },
                { label: "Reynolds & Reynolds" },
                { label: "CSV / Manual Import" },
              ].map(({ label }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-[12px] font-medium text-slate-700 flex-1">{label}</span>
                  <span className="text-[10px] text-slate-400">
                    {lastImport ? formatTs((lastImport as { created_at: string }).created_at) : "No sync recorded"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </details>

        <p className="text-center text-[10px] text-slate-400 pb-4">
          Metrics computed live from your dealership data · AI analysis cached until refreshed
        </p>
      </main>
    </>
  );
}
