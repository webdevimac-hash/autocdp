import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart2, TrendingUp, Mail, MessageSquare, Send, ScanLine } from "lucide-react";

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
    supabase
      .from("mail_pieces")
      .select("id, status, scanned_count, cost_cents, created_at, is_test")
      .eq("dealership_id", dealershipId)
      .gte("created_at", ninetyDaysAgo),
    supabase
      .from("mail_scans")
      .select("id, scanned_at")
      .eq("dealership_id", dealershipId)
      .gte("scanned_at", thirtyDaysAgo),
    supabase
      .from("communications")
      .select("id, channel, status, created_at")
      .eq("dealership_id", dealershipId)
      .gte("created_at", ninetyDaysAgo),
    supabase
      .from("agent_runs")
      .select("id, agent_type, status, duration_ms, created_at")
      .eq("dealership_id", dealershipId)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("global_learnings")
      .select("pattern_type, description, confidence, sample_size")
      .order("confidence", { ascending: false })
      .limit(6),
    supabase
      .from("learning_outcomes")
      .select("outcome_type, result, created_at")
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("billing_events")
      .select("event_type, unit_cost_cents, quantity, created_at")
      .eq("dealership_id", dealershipId)
      .gte("created_at", thirtyDaysAgo),
  ]);

  const mailPieces = mailPiecesRes.data ?? [];
  const scans = scansRes.data ?? [];
  const comms = commsRes.data ?? [];
  const agentRuns = agentRunsRes.data ?? [];
  const globalLearnings = globalLearningsRes.data ?? [];
  const recentOutcomes = recentOutcomesRes.data ?? [];
  const billingEvents = billingRes.data ?? [];

  // ── Compute real stats ─────────────────────────────────────
  const liveMail = mailPieces.filter((m) => !m.is_test);
  const deliveredMail = liveMail.filter((m) => m.status === "delivered");
  const scannedMail = liveMail.filter((m) => m.scanned_count > 0);
  const mailScanRate = liveMail.length > 0 ? (scannedMail.length / liveMail.length) * 100 : 0;
  const mailDeliveryRate = liveMail.length > 0 ? (deliveredMail.length / liveMail.length) * 100 : 0;

  const smsSent = comms.filter((c) => c.channel === "sms" && c.status === "sent");
  const emailSent = comms.filter((c) => c.channel === "email" && c.status === "sent");

  const totalMailSpend = liveMail.reduce((s, m) => s + (m.cost_cents ?? 0), 0);
  const totalAiSpend = billingEvents
    .filter((e) => e.event_type === "agent_run")
    .reduce((s, e) => s + (e.unit_cost_cents ?? 0) * (e.quantity ?? 1), 0);

  const avgAgentDuration = agentRuns.length
    ? Math.round(agentRuns.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / agentRuns.length / 1000)
    : 0;

  // Build per-day scan chart data (last 30 days)
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

  return (
    <>
      <Header title="Analytics" subtitle="Real-time performance across all channels" userEmail={user?.email} />

      <main className="flex-1 p-6 space-y-6">

        {/* Key metrics — real data */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Mail Pieces Sent (90d)", value: liveMail.length, sub: `${mailDeliveryRate.toFixed(0)}% delivered`, icon: Mail, color: "text-blue-600 bg-blue-50" },
            { label: "QR Scan Rate", value: `${mailScanRate.toFixed(1)}%`, sub: `${scans.length} scans this month`, icon: ScanLine, color: "text-green-600 bg-green-50" },
            { label: "SMS Sent (90d)", value: smsSent.length, sub: `${emailSent.length} emails`, icon: MessageSquare, color: "text-purple-600 bg-purple-50" },
            { label: "Agent Runs (30d)", value: agentRuns.length, sub: `avg ${avgAgentDuration}s`, icon: Send, color: "text-amber-600 bg-amber-50" },
          ].map((m) => (
            <Card key={m.label} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${m.color}`}>
                    <m.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* QR Scan trend chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">QR Scans — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {scans.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <ScanLine className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No QR scans yet. Scans appear after customers receive and scan mail pieces.</p>
              </div>
            ) : (
              <div className="flex items-end gap-0.5 h-24">
                {scanChartData.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.count} scans`}
                    className="flex-1 bg-brand-500 rounded-sm hover:bg-brand-600 transition-colors"
                    style={{ height: `${(d.count / maxScans) * 100}%`, minHeight: d.count > 0 ? "3px" : "1px" }}
                  />
                ))}
              </div>
            )}
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </CardContent>
        </Card>

        {/* Channel breakdown + spend */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Channel Breakdown (90d)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { channel: "Direct Mail", sent: liveMail.length, color: "bg-blue-500", rate: mailScanRate, rateLabel: "scan rate" },
                { channel: "SMS", sent: smsSent.length, color: "bg-purple-500", rate: smsSent.length > 0 ? 98 : 0, rateLabel: "open rate (est.)" },
                { channel: "Email", sent: emailSent.length, color: "bg-green-500", rate: emailSent.length > 0 ? 22 : 0, rateLabel: "open rate (est.)" },
              ].map((ch) => {
                const maxSent = Math.max(liveMail.length, smsSent.length, emailSent.length, 1);
                return (
                  <div key={ch.channel} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${ch.color}`} />
                        <span className="font-medium">{ch.channel}</span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {ch.sent} sent
                        {ch.sent > 0 && <span className="ml-2 text-green-600 font-medium">{ch.rate.toFixed(1)}% {ch.rateLabel}</span>}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${ch.color} rounded-full transition-all`}
                        style={{ width: `${(ch.sent / maxSent) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Spend Breakdown (30d)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Direct Mail", amount: totalMailSpend / 100, icon: Mail },
                { label: "AI Tokens", amount: totalAiSpend / 100, icon: Send },
                { label: "SMS", amount: smsSent.length * 0.02, icon: MessageSquare },
                { label: "Email", amount: 0, icon: BarChart2 },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{s.label}</span>
                  </div>
                  <span className="font-medium">${s.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-2 border-t flex items-center justify-between text-sm font-semibold">
                <span>Total</span>
                <span>${((totalMailSpend + totalAiSpend) / 100 + smsSent.length * 0.02).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Network learnings + outcomes */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Cross-Dealer Learnings</CardTitle>
                <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700">
                  Network Intelligence
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Anonymized patterns from the AutoCDP dealership network. No PII shared.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {globalLearnings.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Global learnings accumulate as campaigns run across the network.</p>
                </div>
              ) : (
                globalLearnings.map((l, i) => (
                  <div key={i} className="p-3 bg-purple-50/60 border border-purple-100 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-purple-800 capitalize">
                        {l.pattern_type.replace(/_/g, " ")}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 bg-purple-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.round(l.confidence * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-purple-600">{Math.round(l.confidence * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-purple-700">{l.description}</p>
                    <p className="text-[10px] text-purple-400 mt-1">n={l.sample_size}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Learning Outcomes</CardTitle>
              <p className="text-xs text-muted-foreground">What the Optimization Agent has learned from your campaigns.</p>
            </CardHeader>
            <CardContent>
              {recentOutcomes.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Outcomes appear after campaigns complete.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentOutcomes.map((o, i) => (
                    <div key={i} className="p-3 border rounded-lg text-xs">
                      <span className="font-medium capitalize">{o.outcome_type.replace(/_/g, " ")}</span>
                      <pre className="text-muted-foreground mt-1 text-[10px] whitespace-pre-wrap">
                        {JSON.stringify(o.result, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </main>
    </>
  );
}
