import { createClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { getDailyUsage, DAILY_LIMITS } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Bot, Mail, Activity, Zap, Database,
} from "lucide-react";

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (!ok) return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (warn) return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
}

function pct(used: number, limit: number) {
  return Math.round((used / limit) * 100);
}

function formatTs(ts: string | null) {
  if (!ts) return "Never";
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function HealthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) redirect("/onboarding");

  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const [usage, agentRows, recentErrors, lastSync, customerCount, inventoryCount] = await Promise.all([
    getDailyUsage(dealershipId).catch(() => null),

    (supabase
      .from("billing_events" as any)
      .select("metadata")
      .eq("dealership_id", dealershipId)
      .eq("event_type", "agent_run")
      .gte("created_at", todayUtc.toISOString())
      .order("created_at", { ascending: false })
      .limit(50) as any).then((r: any) => r.data ?? []),

    (supabase
      .from("billing_events" as any)
      .select("created_at, metadata, event_type")
      .eq("dealership_id", dealershipId)
      .eq("event_type", "error")
      .order("created_at", { ascending: false })
      .limit(25) as any).then((r: any) => r.data ?? []),

    (supabase
      .from("billing_events" as any)
      .select("created_at, metadata")
      .eq("dealership_id", dealershipId)
      .eq("event_type", "import")
      .order("created_at", { ascending: false })
      .limit(1) as any).then((r: any) => r.data?.[0] ?? null),

    (supabase
      .from("customers" as any)
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealershipId) as any).then((r: any) => r.count ?? 0),

    (supabase
      .from("inventory" as any)
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealershipId) as any).then((r: any) => r.count ?? 0),
  ]);

  const totalAgentRuns = agentRows.length;
  const successfulRuns = agentRows.filter((r: any) => r.metadata?.success !== false).length;
  const successRate = totalAgentRuns > 0 ? Math.round((successfulRuns / totalAgentRuns) * 100) : null;

  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;
  const postgridConfigured = !!process.env.POSTGRID_API_KEY;

  const mailPct = usage && DAILY_LIMITS.mail_piece_sent
    ? pct(usage.mail_piece_sent, DAILY_LIMITS.mail_piece_sent) : 0;
  const agentPct = usage && DAILY_LIMITS.agent_run
    ? pct(usage.agent_run, DAILY_LIMITS.agent_run) : 0;
  const smsPct = usage && DAILY_LIMITS.sms_sent
    ? pct(usage.sms_sent, DAILY_LIMITS.sms_sent) : 0;

  return (
    <>
      <Header title="System Health" subtitle="Real-time status of your AutoCDP instance" userEmail={user?.email} />

      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-5">

        {/* ── Service Status ─────────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-slate-400" />
              <div className="inst-panel-title">Services</div>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              {
                label: "Claude AI (Anthropic)",
                ok: anthropicConfigured,
                detail: anthropicConfigured ? "API key configured" : "ANTHROPIC_API_KEY missing",
              },
              {
                label: "PostGrid (Direct Mail)",
                ok: postgridConfigured,
                detail: postgridConfigured ? "API key configured" : "POSTGRID_API_KEY missing — dry run only",
              },
              {
                label: "Supabase Database",
                ok: true,
                detail: `${(customerCount as number).toLocaleString()} customers · ${(inventoryCount as number).toLocaleString()} inventory units`,
              },
            ].map(({ label, ok, detail }) => (
              <div key={label} className="flex items-center gap-3 px-6 py-4">
                <StatusDot ok={ok} />
                <span className="text-[13px] font-medium text-slate-800 flex-1">{label}</span>
                <span className="text-xs text-slate-400">{detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Daily Usage ─────────────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <div>
                <div className="inst-panel-title">Daily Usage</div>
                <div className="inst-panel-subtitle">Resets midnight UTC</div>
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: "Mail Pieces", used: usage?.mail_piece_sent ?? 0, limit: DAILY_LIMITS.mail_piece_sent ?? 0, pctVal: mailPct, icon: Mail },
              { label: "AI Agent Runs", used: usage?.agent_run ?? 0, limit: DAILY_LIMITS.agent_run ?? 0, pctVal: agentPct, icon: Bot },
              { label: "SMS Sent", used: usage?.sms_sent ?? 0, limit: DAILY_LIMITS.sms_sent ?? 0, pctVal: smsPct, icon: Zap },
            ].map(({ label, used, limit, pctVal, icon: Icon }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />{label}
                  </span>
                  <span className={`text-xs font-semibold tabular-nums ${pctVal >= 100 ? "text-red-600" : pctVal >= 80 ? "text-amber-600" : "text-slate-500"}`}>
                    {pctVal}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pctVal >= 100 ? "bg-red-500" : pctVal >= 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(pctVal, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 tabular-nums">{used.toLocaleString()} / {limit.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Agent Performance ────────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-slate-400" />
              <div className="inst-panel-title">Agent Performance (today)</div>
            </div>
          </div>
          <div className="px-6 py-5 grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalAgentRuns}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5 uppercase tracking-wide">Runs today</p>
            </div>
            <div>
              <p className={`text-2xl font-bold tabular-nums ${successRate === null ? "text-slate-300" : successRate >= 90 ? "text-emerald-600" : successRate >= 70 ? "text-amber-600" : "text-red-600"}`}>
                {successRate === null ? "—" : `${successRate}%`}
              </p>
              <p className="text-xs text-slate-400 font-medium mt-0.5 uppercase tracking-wide">Success rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {lastSync ? formatTs((lastSync as any).created_at) : "—"}
              </p>
              <p className="text-xs text-slate-400 font-medium mt-0.5 uppercase tracking-wide">Last import</p>
            </div>
          </div>
        </div>

        {/* ── DMS Sync ─────────────────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-400" />
              <div className="inst-panel-title">Data Sources</div>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { label: "CDK Drive (DMS)", key: "cdk" },
              { label: "Reynolds & Reynolds", key: "reynolds" },
              { label: "CSV Import", key: "csv" },
            ].map(({ label, key }) => {
              const syncEvent = lastSync && (lastSync as any).metadata?.source === key ? lastSync : null;
              return (
                <div key={key} className="flex items-center gap-3 px-6 py-4">
                  <Clock className="w-4 h-4 text-slate-300 shrink-0" />
                  <span className="text-[13px] font-medium text-slate-800 flex-1">{label}</span>
                  <span className="text-xs text-slate-400">
                    {syncEvent ? formatTs((syncEvent as any).created_at) : "No sync recorded"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Recent Errors ────────────────────────────────────── */}
        {(recentErrors as any[]).length > 0 && (
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <div className="inst-panel-title">Recent Errors</div>
              </div>
              <span className="chip chip-red">{(recentErrors as any[]).length}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {(recentErrors as any[]).slice(0, 10).map((err: any, i: number) => (
                <div key={i} className="px-6 py-3.5 flex items-start gap-3">
                  <span className="text-xs text-slate-400 shrink-0 pt-0.5 font-mono tabular-nums">
                    {new Date(err.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-xs text-slate-700 flex-1">
                    {err.metadata?.message ?? err.metadata?.error ?? "Unknown error"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(recentErrors as any[]).length === 0 && (
          <div className="flex items-center gap-2.5 text-[13px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-[var(--radius)] px-5 py-3.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            No errors recorded recently — all systems operating normally.
          </div>
        )}
      </main>
    </>
  );
}
