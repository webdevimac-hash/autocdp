import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IntegrationsClient } from "./integrations-client";
import { getQueueStats, getWritebackSummary } from "@/lib/dms/writeback-queue";
import { getAdsPerfSummary } from "@/lib/ads/ads-sync";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id, dealerships(id, name, slug, settings)")
    .eq("user_id", user.id)
    .maybeSingle() as {
      data: {
        dealership_id: string;
        dealerships: { id: string; name: string; slug: string; settings: Record<string, unknown> } | null;
      } | null;
    };

  const dealership = ud?.dealerships ?? null;
  if (!dealership) redirect("/login");

  // Load DMS connections
  const { data: connections } = await svc
    .from("dms_connections")
    .select("id, provider, status, last_sync_at, last_error, metadata")
    .eq("dealership_id", dealership.id);

  // Load recent sync job counts
  const { data: syncJobs } = await svc
    .from("sync_jobs")
    .select("provider, status, records_synced, completed_at")
    .eq("dealership_id", dealership.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(10);

  const latestCounts: Record<string, { customers: number; visits: number; inventory: number }> = {};
  for (const job of syncJobs ?? []) {
    if (!latestCounts[job.provider as string]) {
      const rc = job.records_synced as { customers?: number; visits?: number; inventory?: number } | null;
      latestCounts[job.provider as string] = {
        customers: rc?.customers ?? 0,
        visits: rc?.visits ?? 0,
        inventory: rc?.inventory ?? 0,
      };
    }
  }

  // vAuto inventory insights (only computed when connection exists)
  const hasVAuto = (connections ?? []).some((c) => c.provider === "vauto" && c.status === "active");
  let inventoryInsights: {
    totalVehicles: number; agedCount: number; avgDaysOnLot: number;
    agingBuckets: Record<string, number>; conditionBreakdown: Record<string, number>;
    avgPriceToMarket: number | null; totalInventoryValue: number;
  } | null = null;

  if (hasVAuto) {
    const { data: inv } = await svc
      .from("inventory")
      .select("condition, price, days_on_lot, metadata")
      .eq("dealership_id", dealership.id)
      .eq("status", "available");

    if (inv && inv.length > 0) {
      let totalDays = 0, totalValue = 0, ptmSum = 0, ptmCount = 0;
      const buckets: Record<string, number> = { "<30": 0, "30-60": 0, "60-90": 0, "90+": 0 };
      const conds: Record<string, number> = {};
      for (const v of inv) {
        const d = v.days_on_lot ?? 0;
        const p = Number(v.price ?? 0);
        const m = v.metadata as Record<string, unknown> | null;
        totalDays += d; totalValue += p;
        if (d < 30) buckets["<30"]++; else if (d < 60) buckets["30-60"]++; else if (d < 90) buckets["60-90"]++; else buckets["90+"]++;
        const c = v.condition ?? "used"; conds[c] = (conds[c] ?? 0) + 1;
        const ptm = m?.price_to_market as number | null;
        if (ptm != null) { ptmSum += ptm; ptmCount++; }
      }
      inventoryInsights = {
        totalVehicles: inv.length,
        agedCount: buckets["60-90"] + buckets["90+"],
        avgDaysOnLot: Math.round(totalDays / inv.length),
        agingBuckets: buckets,
        conditionBreakdown: conds,
        avgPriceToMarket: ptmCount > 0 ? Math.round(ptmSum / ptmCount * 10) / 10 : null,
        totalInventoryValue: Math.round(totalValue),
      };
    }
  }

  // DealerFunnel stats
  const [{ count: dfTotal }, { count: dfOptedOut }] = await Promise.all([
    svc
      .from("conquest_leads")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealership.id)
      .eq("source", "dealerfunnel") as unknown as Promise<{ count: number | null }>,
    svc
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealership.id)
      .contains("tags", ["tcpa_optout"]) as unknown as Promise<{ count: number | null }>,
  ]);

  // CRM write-back queue stats (only relevant if a CRM with Plugin Mode is active)
  const hasCrmPlugin = (connections ?? []).some(
    (c) => ["vinsolutions", "dealertrack", "elead"].includes(c.provider as string) && c.status === "active"
  );
  const queueStats = hasCrmPlugin
    ? await getQueueStats(dealership.id).catch(() => null)
    : null;

  const writebackSummary = hasCrmPlugin
    ? await getWritebackSummary(dealership.id).catch(() => [])
    : [];

  // Ads performance summary
  const adsPerfSummary = await getAdsPerfSummary(dealership.id).catch(() => []);

  const secretConfigured = !!(dealership.settings?.inbound_lead_secret as string | undefined);
  const secret = (dealership.settings?.inbound_lead_secret as string | undefined) ?? "";
  const webhookUrl = `${APP_URL}/api/leads/inbound?dealership=${dealership.slug}${secret ? `&secret=${secret}` : ""}`;
  const xtimeUrl = (dealership.settings?.xtime_url as string | undefined) ?? null;

  const params = await searchParams;

  return (
    <IntegrationsClient
      connections={connections ?? []}
      latestCounts={latestCounts}
      successParam={params.success}
      errorParam={params.error}
      dealerFunnelStats={{
        total: dfTotal ?? 0,
        optedOut: dfOptedOut ?? 0,
        webhookUrl,
        secretConfigured,
      }}
      xtimeUrl={xtimeUrl}
      inventoryInsights={inventoryInsights}
      queueStats={queueStats}
      writebackSummary={writebackSummary}
      adsPerfSummary={adsPerfSummary}
      appUrl={APP_URL}
    />
  );
}
