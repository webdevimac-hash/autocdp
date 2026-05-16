/**
 * /dashboard/analytics/budget — AI Budget Allocator
 *
 * Server component — loads allocation history + rules + perf summary,
 * passes to client for interactive budget management.
 */

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BudgetClient } from "./budget-client";

export const dynamic  = "force-dynamic";
export const metadata = { title: "Budget Allocator · AutoCDP" };

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id, dealerships(id,name)")
    .eq("user_id", user.id)
    .maybeSingle() as unknown as {
      data: { dealership_id: string; dealerships: { id: string; name: string } | null } | null;
    };

  if (!ud?.dealership_id) redirect("/login");
  const dealershipId   = ud.dealership_id;
  const dealershipName = ud.dealerships?.name ?? "Your Dealership";

  const svc = createServiceClient();

  const [allocationsRes, rulesRes, perfRes, connectionsRes] = await Promise.all([
    // Last 30 allocations
    (svc as ReturnType<typeof createServiceClient>)
      .from("budget_allocations" as never)
      .select("id,allocation_date,total_budget_usd,allocations,swarm_reasoning,summary,status,pushed_at,push_errors,actual_spend_usd,actual_roas,prediction_error_pct,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("allocation_date" as never, { ascending: false })
      .limit(30) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,

    // Budget rules
    (svc as ReturnType<typeof createServiceClient>)
      .from("budget_rules" as never)
      .select("*" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .maybeSingle() as unknown as Promise<{ data: Record<string, unknown> | null }>,

    // 30d ads performance summary per channel
    (svc as ReturnType<typeof createServiceClient>)
      .from("ads_performance" as never)
      .select("platform,date_start,impressions,clicks,conversions,spend_usd,roas" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .gte("date_start" as never, new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10) as never)
      .order("date_start" as never, { ascending: false })
      .limit(2000) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,

    // Connected ad platforms
    (svc as ReturnType<typeof createServiceClient>)
      .from("dms_connections" as never)
      .select("provider,status,last_sync_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .in("provider" as never, ["google_ads", "meta_ads", "tiktok_ads"] as never) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,
  ]);

  const allocations  = allocationsRes.data  ?? [];
  const rules        = rulesRes.data;
  const perfRows     = perfRes.data         ?? [];
  const connections  = connectionsRes.data  ?? [];

  // Aggregate perf by channel for stats bar
  const channelStats: Record<string, { spend: number; roas: number; roasWeight: number; impressions: number }> = {};
  for (const r of perfRows) {
    const ch = r.platform as string;
    if (!channelStats[ch]) channelStats[ch] = { spend: 0, roas: 0, roasWeight: 0, impressions: 0 };
    channelStats[ch].spend      += Number(r.spend_usd ?? 0);
    channelStats[ch].impressions += Number(r.impressions ?? 0);
    if (r.roas != null && Number(r.spend_usd ?? 0) > 0) {
      channelStats[ch].roas       += Number(r.roas) * Number(r.spend_usd);
      channelStats[ch].roasWeight += Number(r.spend_usd);
    }
  }

  const channelSummary = Object.entries(channelStats).map(([ch, s]) => ({
    channel:     ch,
    spend30d:    +s.spend.toFixed(2),
    roas:        s.roasWeight > 0 ? +(s.roas / s.roasWeight).toFixed(2) : null,
    impressions: s.impressions,
    dailyAvg:    +(s.spend / 30).toFixed(2),
  }));

  const latestAllocation = allocations[0] ?? null;

  return (
    <BudgetClient
      dealershipId={dealershipId}
      dealershipName={dealershipName}
      allocations={allocations}
      rules={rules}
      channelSummary={channelSummary}
      connections={connections as Array<{ provider: string; status: string; last_sync_at: string | null }>}
      latestAllocation={latestAllocation}
      userEmail={user.email ?? ""}
    />
  );
}
