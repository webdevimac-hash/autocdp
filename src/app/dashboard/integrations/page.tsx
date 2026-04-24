import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IntegrationsClient } from "./integrations-client";

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

  const secretConfigured = !!(dealership.settings?.inbound_lead_secret as string | undefined);
  const secret = (dealership.settings?.inbound_lead_secret as string | undefined) ?? "";
  const webhookUrl = `${APP_URL}/api/leads/inbound?dealership=${dealership.slug}${secret ? `&secret=${secret}` : ""}`;

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
    />
  );
}
