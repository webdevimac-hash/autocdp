import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BarChart2, TrendingUp, Mail, MessageSquare, Send, ScanLine, Sparkles } from "lucide-react";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) redirect("/login");

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user!.id)
    .single();

  const dealershipId = ud?.dealership_id ?? "";

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    mailPiecesRes,
    scansRes,
    commsRes,
    agentRunsRes,
    globalLearningsRes,
    recentOutcomesRes,
    billingRes,
  ] = await Promise.all([
    supabase.from("mail_pieces").select("id, status, scanned_count, cost_cents, created_at, is_test").eq("dealership_id", dealershipId).gte("created_at", ninetyDaysAgo),
    supabase.from("mail_scans").select("id, scanned_at").eq("dealership_id", dealershipId).gte("scanned_at", thirtyDaysAgo),
    supabase.from("communications").select("id, channel, status, created_at").eq("dealership_id", dealershipId).gte("created_at", ninetyDaysAgo),
    supabase.from("agent_runs").select("id, agent_type, status, duration_ms, created_at").eq("dealership_id", dealershipId).gte("created_at", thirtyDaysAgo),
    supabase.from("global_learnings").select("pattern_type, description, confidence, sample_size").order("confidence", { ascending: false }).limit(6),
    supabase.from("learning_outcomes").select("outcome_type, result, created_at").eq("dealership_id", dealershipId).order("created_at", { ascending: false }).limit(10),
    supabase.from("billing_events").select("event_type, unit_cost_cents, quantity, created_at").eq("dealership_id", dealershipId).gte("created_at", thirtyDaysAgo),
  ]);

  const mailPieces = mailPiecesRes.data ?? [];
  const scans = scansRes.data ?? [];
  const comms = commsRes.data ?? [];
  const agentRuns = agentRunsRes.data ?? [];
  const globalLearnings = globalLearningsRes.data ?? [];
  const recentOutcomes = recentOutcomesRes.data ?? [];
  const billingEvents = billingRes.data ?? [];

  const liveMail = mailPieces.filter((m) => !m.is_test);
  const deliveredMail = liveMail.filter((m) => m.status === "delivered");
  const scannedMail = liveMail.filter((m) => m.scanned_count > 0);
  const mailScanRate = liveMail.length > 0 ? (scannedMail.length / liveMail.length) * 100 : 0;
  const mailDeliveryRate = liveMail.length > 0 ? (deliveredMail.length / liveMail.length) * 100 : 0;

  const smsSent = comms.filter((c) => c.channel === "sms" && c.status === "sent");
  const emailSent = comms.filter((c) => c.channel === "email" && c.status === "sent");

  const totalMailSpend = liveMail.reduce((s, m) => s + (m.cost_cents ?? 0), 0);
  const totalAiSpend = billingEvents.filter((e) => e.event_type === "agent_run").reduce((s, e) => s + (e.unit_cost_cents ?? 0) * (e.quantity ?? 1), 0);
  const avgAgentDuration = agentRuns.length ? Math.round(agentRuns.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / agentRuns.length / 1000) : 0;

  const scansByDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    scansByDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const s of scans) {
    const day = s.scanned_at?.slice(0, 10);
    if (day && day in scansByDay) scansByDay[day]++;
  }
  const scanChartData = Object.entries(scansByDay).map(([date, count]) => ({ date, count }));
  const maxScans = Math.max(...scanChartData.map((d) => d.count), 1);

  const keyMetrics = [
    {
      label: "Mail Pieces Sent",
      value: liveMail.length,
      sub: `${mailDeliveryRate.toFixed(0)}% delivered`,
      icon: Mail,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      accent: "stat-card-indigo",
    },
    {
      label: "QR Scan Rate",
      value: `${mailScanRate.toFixed(1)}%`,
      sub: `${scans.length} scans this month`,
      icon: ScanLine,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      accent: "stat-card-emerald",
    },
    {
      label: "SMS Sent",
      value: smsSent.length,
      sub: `${emailSent.length} emails`,
      icon: MessageSquare,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      accent: "stat-card-violet",
    },
    {
      label: "Agent Runs",
      value: agentRuns.length,
      sub: `avg ${avgAgentDuration}s per run`,
      icon: Send,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      accent: "stat-card-amber",
    },
  ];

  const channelData = [
    { channel: "Direct Mail", sent: liveMail.length, color: "bg-indigo-500", rate: mailScanRate, rateLabel: "scan rate", total: Math.max(liveMail.length, smsSent.length, emailSent.length, 1) },
    { channel: "SMS", sent: smsSent.length, color: "bg-violet-500", rate: smsSent.length > 0 ? 98 : 0, rateLabel: "open rate (est.)", total: Math.max(liveMail.length, smsSent.length, emailSent.length, 1) },
    { channel: "Email", sent: emailSent.length, color: "bg-sky-500", rate: emailSent.length > 0 ? 22 : 0, rateLabel: "open rate (est.)", total: Math.max(liveMail.length, smsSent.length, emailSent.length, 1) },
  ];

  const spendData = [
    { label: "Direct Mail", amount: totalMailSpend / 100, icon: Mail, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
    { label: "AI Tokens", amount: totalAiSpend / 100, icon: Send, iconBg: "bg-violet-50", iconColor: "text-violet-500" },
    { label: "SMS", amount: smsSent.length * 0.02, icon: MessageSquare, iconBg: "bg-sky-50", iconColor: "text-sky-500" },
    { label: "Email", amount: 0, icon: BarChart2, iconBg: "bg-emerald-50", iconColor: "text-emerald-500" },
  ];
  const totalSpend = (totalMailSpend + totalAiSpend) / 100 + smsSent.length * 0.02;

  return (
    <>
      <Header title="Analytics" subtitle="Real-time performance across all channels" userEmail={user?.email} />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">

        {/* ── Key metrics ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {keyMetrics.map((m) => (
            <div key={m.label} className={`stat-card ${m.accent} card-lift`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.iconBg}`}>
                  <m.icon className={`w-4 h-4 ${m.iconColor}`} />
                </div>
              </div>
              <div className="metric-value">{m.value}</div>
              <div className="metric-label">{m.label}</div>
              <p className="text-[11px] text-slate-400 mt-1.5">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* ── QR Scan chart ────────────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div>
              <div className="inst-panel-title">QR Scans — Last 30 Days</div>
              <div className="inst-panel-subtitle">Daily scan counts from live mail pieces</div>
            </div>
            <span className="chip chip-indigo">{scans.length} total</span>
          </div>
          <div className="p-4 sm:p-6">
            {scans.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <ScanLine className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">No QR scans yet</p>
                <p className="text-xs text-slate-400">Scans appear after customers receive and scan mail pieces.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-0.5 h-28 min-w-[280px]">
                    {scanChartData.map((d) => (
                      <div
                        key={d.date}
                        title={`${d.date}: ${d.count} scans`}
                        className="flex-1 bg-indigo-500 rounded-sm hover:bg-indigo-400 transition-colors"
                        style={{ height: `${(d.count / maxScans) * 100}%`, minHeight: d.count > 0 ? "3px" : "1px" }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-medium">
                  <span>30 days ago</span>
                  <span>Today</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Channel breakdown + spend ─────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div>
                <div className="inst-panel-title">Channel Breakdown</div>
                <div className="inst-panel-subtitle">90-day send volume by channel</div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {channelData.map((ch) => (
                <div key={ch.channel}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${ch.color}`} />
                      <span className="text-[13px] font-medium text-slate-700">{ch.channel}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 tabular-nums block">{ch.sent.toLocaleString()} sent</span>
                      {ch.sent > 0 && (
                        <span className="text-[11px] text-emerald-600 font-semibold block">
                          {ch.rate.toFixed(1)}% {ch.rateLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${ch.color} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(2, (ch.sent / ch.total) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="inst-panel">
            <div className="inst-panel-header">
              <div>
                <div className="inst-panel-title">Spend Breakdown</div>
                <div className="inst-panel-subtitle">30-day cost by channel</div>
              </div>
              <span className="text-[13px] font-bold text-slate-900 tabular-nums">${totalSpend.toFixed(2)}</span>
            </div>
            <div className="p-6 space-y-1">
              {spendData.map((s) => (
                <div key={s.label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                      <s.icon className={`w-3.5 h-3.5 ${s.iconColor}`} />
                    </div>
                    <span className="text-[13px] text-slate-700">{s.label}</span>
                  </div>
                  <span className="text-[13px] font-semibold text-slate-900 tabular-nums">${s.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-900">Total (30d)</span>
                <span className="text-[15px] font-bold text-slate-900 tabular-nums">${totalSpend.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Network learnings + outcomes ─────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div>
                <div className="inst-panel-title">Cross-Dealer Learnings</div>
                <div className="inst-panel-subtitle">Anonymized patterns — no PII shared</div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100">
                <Sparkles className="w-3 h-3 text-violet-500" />
                <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Network</span>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {globalLearnings.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">No learnings yet</p>
                  <p className="text-xs text-slate-400">Global learnings accumulate as campaigns run.</p>
                </div>
              ) : (
                globalLearnings.map((l, i) => (
                  <div key={i} className="feature-card feature-card-violet bg-white rounded-[var(--radius)] border border-violet-100 shadow-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-violet-800 uppercase tracking-wide capitalize">
                        {l.pattern_type.replace(/_/g, " ")}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 bg-violet-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.round(l.confidence * 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-violet-600 tabular-nums">{Math.round(l.confidence * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{l.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">n={l.sample_size}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="inst-panel">
            <div className="inst-panel-header">
              <div>
                <div className="inst-panel-title">Your Learning Outcomes</div>
                <div className="inst-panel-subtitle">What the Optimization Agent learned from your campaigns</div>
              </div>
            </div>
            <div className="p-5">
              {recentOutcomes.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                    <BarChart2 className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">No outcomes yet</p>
                  <p className="text-xs text-slate-400">Outcomes appear after campaigns complete.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentOutcomes.map((o, i) => (
                    <div key={i} className="p-4 border border-slate-100 rounded-[var(--radius)] bg-slate-50/60">
                      <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide capitalize">
                        {o.outcome_type.replace(/_/g, " ")}
                      </span>
                      <pre className="text-slate-400 mt-2 text-[10px] whitespace-pre-wrap font-mono leading-relaxed">
                        {JSON.stringify(o.result, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
    </>
  );
}
