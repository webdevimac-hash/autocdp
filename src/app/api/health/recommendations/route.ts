import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { runHealthAgent } from "@/lib/anthropic/agents/health-agent";
import type { HealthMetrics } from "@/lib/anthropic/agents/health-agent";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const svc = createServiceClient();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    dealerRes,
    customersRes,
    inventoryRes,
    mailRes,
    commsRes,
    visitsRes,
    agentRunsRes,
    insightsRes,
  ] = await Promise.all([
    svc.from("dealerships").select("name").eq("id", dealershipId).single(),

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

    (svc
      .from("dealership_insights")
      .select("insight_type, data")
      .eq("dealership_id", dealershipId)
      .in("insight_type", ["sentiment_patterns", "google_review_trends"])
      .eq("is_active", true)) as unknown as Promise<{
        data: Array<{ insight_type: string; data: Record<string, unknown> }> | null;
      }>,
  ]);

  // ── Customer metrics ─────────────────────────────────────────
  type CustRow = { lifecycle_stage: string | null; email: string | null; phone: string | null; last_visit_date: string | null };
  const customers = (customersRes.data ?? []) as CustRow[];
  const total = customers.length;
  const reachable = customers.filter((c) => c.email || c.phone).length;

  const lifecycle = { vip: 0, active: 0, at_risk: 0, lapsed: 0, prospect: 0 };
  let totalDaysSinceVisit = 0;
  let customersWithVisit = 0;

  for (const c of customers) {
    const stage = (c.lifecycle_stage ?? "prospect") as keyof typeof lifecycle;
    if (stage in lifecycle) lifecycle[stage]++;
    if (c.last_visit_date) {
      totalDaysSinceVisit += (now.getTime() - new Date(c.last_visit_date).getTime()) / 86_400_000;
      customersWithVisit++;
    }
  }

  const avgDaysSinceVisit = customersWithVisit > 0 ? Math.round(totalDaysSinceVisit / customersWithVisit) : 0;
  const atRiskPct = total > 0 ? Math.round((lifecycle.at_risk / total) * 100) : 0;
  const lapsedPct = total > 0 ? Math.round((lifecycle.lapsed / total) * 100) : 0;

  // ── Inventory metrics ────────────────────────────────────────
  type InvRow = { days_on_lot: number; status: string };
  const available = ((inventoryRes.data ?? []) as InvRow[]).filter((v) => v.status === "available");
  const invTotal = available.length;
  const avgDaysOnLot = invTotal > 0
    ? Math.round(available.reduce((s, v) => s + (v.days_on_lot ?? 0), 0) / invTotal)
    : 0;
  const buckets = { lt30: 0, d30to60: 0, d60to90: 0, gt90: 0 };
  for (const v of available) {
    const d = v.days_on_lot ?? 0;
    if (d < 30) buckets.lt30++;
    else if (d < 60) buckets.d30to60++;
    else if (d < 90) buckets.d60to90++;
    else buckets.gt90++;
  }
  const agedPct = invTotal > 0 ? Math.round(((buckets.d60to90 + buckets.gt90) / invTotal) * 100) : 0;

  // ── Campaign metrics ─────────────────────────────────────────
  type MailRow = { status: string; scanned_count: number | null };
  const mailPieces = (mailRes.data ?? []) as MailRow[];
  const mailSent = mailPieces.length;
  const mailDelivered = mailPieces.filter((m) =>
    ["delivered", "in_transit", "in_production"].includes(m.status)
  ).length;
  const mailScanned = mailPieces.filter((m) => (m.scanned_count ?? 0) > 0).length;
  const mailDeliveryRate = mailSent > 0 ? Math.round((mailDelivered / mailSent) * 100) : 0;
  const mailScanRate = mailSent > 0 ? parseFloat(((mailScanned / mailSent) * 100).toFixed(1)) : 0;

  type CommRow = { channel: string; status: string };
  const comms = (commsRes.data ?? []) as CommRow[];
  const smsMsgs = comms.filter((c) => c.channel === "sms");
  const emailMsgs = comms.filter((c) => c.channel === "email");
  const smsSent = smsMsgs.length;
  const smsClicked = smsMsgs.filter((m) => ["clicked", "converted"].includes(m.status)).length;
  const smsClickRate = smsSent > 0 ? parseFloat(((smsClicked / smsSent) * 100).toFixed(1)) : 0;
  const emailSent = emailMsgs.length;
  const emailOpened = emailMsgs.filter((m) => ["opened", "clicked", "converted"].includes(m.status)).length;
  const emailOpenRate = emailSent > 0 ? parseFloat(((emailOpened / emailSent) * 100).toFixed(1)) : 0;
  const agentRunsLast30d = agentRunsRes.count ?? 0;

  // ── Service metrics ──────────────────────────────────────────
  type VisitRow = { customer_id: string; total_amount: number | null };
  const visitRows = (visitsRes.data ?? []) as VisitRow[];
  const visitsLast90d = visitRows.length;
  const uniqueCustomersServiced = new Set(visitRows.map((v) => v.customer_id)).size;
  const visitAmounts = visitRows
    .filter((v) => v.total_amount != null)
    .map((v) => Number(v.total_amount));
  const avgROValueDollars = visitAmounts.length > 0
    ? Math.round(visitAmounts.reduce((s, a) => s + a, 0) / visitAmounts.length)
    : 0;
  const activeCount = lifecycle.active + lifecycle.vip;
  const retentionRate = activeCount > 0 ? Math.round((uniqueCustomersServiced / activeCount) * 100) : 0;

  // ── Insights ─────────────────────────────────────────────────
  type Theme = { theme: string; sentiment: string };
  const insightRows = insightsRes.data ?? [];
  const sentData = insightRows.find((i) => i.insight_type === "sentiment_patterns")?.data;
  const revData = insightRows.find((i) => i.insight_type === "google_review_trends")?.data;
  const sentimentThemes = (sentData?.themes as Theme[] | undefined) ?? [];
  const reviewThemes = (revData?.themes as Theme[] | undefined) ?? [];

  const healthMetrics: HealthMetrics = {
    dealerName: (dealerRes.data as { name: string } | null)?.name ?? "this dealership",
    customers: { total, reachable, lifecycle, avgDaysSinceVisit, atRiskPct, lapsedPct },
    inventory: { total: invTotal, avgDaysOnLot, buckets, agedPct },
    campaigns: { mailSent, mailDeliveryRate, mailScanRate, smsSent, smsClickRate, emailSent, emailOpenRate, agentRunsLast30d },
    service: { visitsLast90d, avgROValueDollars, uniqueCustomersServiced, retentionRate },
    insights: {
      sentimentPositive: sentimentThemes.filter((t) => t.sentiment === "positive").map((t) => t.theme),
      sentimentNegative: sentimentThemes.filter((t) => t.sentiment === "negative").map((t) => t.theme),
      reviewPositive: reviewThemes.filter((t) => t.sentiment === "positive").map((t) => t.theme),
      reviewNegative: reviewThemes.filter((t) => t.sentiment === "negative").map((t) => t.theme),
    },
  };

  // ── Run health agent ─────────────────────────────────────────
  const analysis = await runHealthAgent(healthMetrics);

  // ── Cache in dealership_insights ────────────────────────────
  const cacheNow = new Date().toISOString();
  await (svc.from("dealership_insights") as unknown as {
    upsert: (
      data: Record<string, unknown>,
      opts: { onConflict: string }
    ) => Promise<unknown>;
  }).upsert(
    {
      dealership_id: dealershipId,
      insight_type: "health_snapshot",
      title: "Dealership Health Report",
      summary: `Score: ${analysis.overall_score}/100 — ${analysis.score_label}. ${analysis.recommendations.length} recommendations generated.`,
      data: { ...analysis, metrics_snapshot: healthMetrics },
      refreshed_at: cacheNow,
      is_active: true,
      updated_at: cacheNow,
    },
    { onConflict: "dealership_id,insight_type" }
  );

  return NextResponse.json({ analysis, metrics: healthMetrics });
}
