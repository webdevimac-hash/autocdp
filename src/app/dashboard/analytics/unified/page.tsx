/**
 * /dashboard/analytics/unified — Cross-Channel ROI & Attribution
 *
 * Server component: reads ?days=30&model=last_touch from URL,
 * fetches all analytics data in parallel, renders the client shell.
 */

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUnifiedAnalytics, type AnalyticsDays, type AttributionModel } from "@/lib/analytics/unified-analytics";
import { UnifiedAnalyticsClient } from "./unified-client";

export const dynamic  = "force-dynamic";
export const metadata = { title: "Unified Analytics · AutoCDP" };

export default async function UnifiedAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; model?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id, dealerships(id,name)")
    .eq("user_id", user.id)
    .maybeSingle() as {
      data: { dealership_id: string; dealerships: { id: string; name: string } | null } | null
    };

  if (!ud?.dealership_id) redirect("/login");

  const params   = await searchParams;
  const rawDays  = parseInt(params.days ?? "30");
  const days     = ([30, 60, 90].includes(rawDays) ? rawDays : 30) as AnalyticsDays;
  const rawModel = params.model ?? "last_touch";
  const model    = (["last_touch", "first_touch", "linear"].includes(rawModel)
    ? rawModel : "last_touch") as AttributionModel;

  const analytics = await getUnifiedAnalytics(ud.dealership_id, days, model);

  return (
    <UnifiedAnalyticsClient
      dealershipName={ud.dealerships?.name ?? "Your Dealership"}
      data={analytics}
      currentDays={days}
      currentModel={model}
    />
  );
}
