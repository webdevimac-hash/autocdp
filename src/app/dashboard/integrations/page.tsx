import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IntegrationsClient } from "./integrations-client";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: dealership } = await svc
    .from("dealerships")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();

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

  // Aggregate latest sync counts per provider
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

  const params = await searchParams;

  return (
    <IntegrationsClient
      connections={connections ?? []}
      latestCounts={latestCounts}
      successParam={params.success}
      errorParam={params.error}
    />
  );
}
