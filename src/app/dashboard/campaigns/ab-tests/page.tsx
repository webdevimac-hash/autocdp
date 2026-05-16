/**
 * /dashboard/campaigns/ab-tests — Dynamic Creative A/B Testing
 *
 * Shows all paid-channel A/B tests: active, winner_declared, and completed.
 * Allows creating new tests with AI-generated creative variations.
 */

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AbTestsClient } from "./ab-tests-client";

export const dynamic  = "force-dynamic";
export const metadata = { title: "A/B Tests · AutoCDP" };

export default async function AbTestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id, dealerships(id,name)")
    .eq("user_id", user.id)
    .maybeSingle() as {
      data: { dealership_id: string; dealerships: { id: string; name: string } | null } | null;
    };

  if (!ud?.dealership_id) redirect("/login");
  const dealershipId = ud.dealership_id;

  const [testsRes, patternsRes, connectionsRes] = await Promise.all([
    // Tests + variants
    (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_tests" as never)
      .select("id,name,platform,status,primary_metric,hypothesis,min_impressions,confidence_threshold,auto_optimize,budget_scale_pct,winner_variant_id,started_at,ended_at,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("created_at" as never, { ascending: false })
      .limit(50) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,

    // Recent winning patterns (for context in the "create test" modal)
    (svc as ReturnType<typeof createServiceClient>)
      .from("dm_learning_patterns" as never)
      .select("id,title,description,confidence,platforms,pattern_type,created_at" as never)
      .eq("is_active" as never, true as never)
      .or(`dealership_id.eq.${dealershipId},dealership_id.is.null` as never)
      .in("pattern_type" as never, ["creative"] as never)
      .order("confidence" as never, { ascending: false })
      .limit(6) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,

    // Connected ad platforms
    (svc as ReturnType<typeof createServiceClient>)
      .from("dms_connections" as never)
      .select("provider,status,metadata" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .in("provider" as never, ["google_ads", "meta_ads", "tiktok_ads"] as never)
      .eq("status" as never, "active" as never) as unknown as Promise<{
        data: Array<{ provider: string; status: string; metadata: Record<string, unknown> }> | null;
      }>,
  ]);

  // Load variants for all tests
  const testIds = (testsRes.data ?? []).map((t) => (t as { id: string }).id);
  const { data: allVariants } = testIds.length
    ? await (svc as ReturnType<typeof createServiceClient>)
        .from("paid_ab_variants" as never)
        .select("id,test_id,name,is_control,platform_ad_id,impressions,clicks,conversions,spend_usd,ctr,cvr,cpa,roas,win_probability,status,creative,last_kpi_sync_at" as never)
        .in("test_id" as never, testIds as never) as unknown as { data: Array<Record<string, unknown>> | null }
    : { data: [] };

  // Group variants by test
  const variantsByTest = new Map<string, Array<Record<string, unknown>>>();
  for (const v of allVariants ?? []) {
    const tid = (v as { test_id: string }).test_id;
    if (!variantsByTest.has(tid)) variantsByTest.set(tid, []);
    variantsByTest.get(tid)!.push(v);
  }

  const tests = (testsRes.data ?? []).map((t) => ({
    ...t,
    variants: variantsByTest.get((t as { id: string }).id) ?? [],
  }));

  return (
    <AbTestsClient
      dealershipId={dealershipId}
      dealershipName={ud.dealerships?.name ?? "Your Dealership"}
      tests={tests}
      creativePatterns={patternsRes.data ?? []}
      connectedPlatforms={(connectionsRes.data ?? []).map((c) => c.provider)}
    />
  );
}
