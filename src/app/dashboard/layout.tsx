import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, type SidebarCounts } from "@/components/layout/sidebar";
import { UsageBanner } from "@/components/layout/usage-banner";
import { DemoBanner } from "@/components/layout/demo-banner";
import { getAllUserDealerships, getActiveDealershipId } from "@/lib/dealership";
import { isDemoMode } from "@/lib/demo";
import { isSuperAdmin } from "@/lib/admin";
import type { Dealership } from "@/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  // Load all dealerships the user belongs to (supports multi-rooftop)
  const [allDealerships, activeDealershipId, demoMode] = await Promise.all([
    getAllUserDealerships(user.id),
    getActiveDealershipId(user.id),
    isDemoMode(),
  ]);

  if (!activeDealershipId) redirect("/onboarding");

  const { data: dealershipData } = await supabase
    .from("dealerships")
    .select("*")
    .eq("id", activeDealershipId)
    .single();

  const dealership = dealershipData as Dealership | null;
  if (!dealership) redirect("/onboarding");

  // ─── Sidebar counts (cheap aggregate queries) ────────────────────────
  // Wrapped in a single Promise.all so total latency = max(one query).
  const sinceISO = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [customersR, campaignsR, inventoryR, unreadCommsR, agentsR] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("dealership_id", activeDealershipId),
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("dealership_id", activeDealershipId)
        .eq("status", "active"),
      supabase
        .from("inventory")
        .select("id", { count: "exact", head: true })
        .eq("dealership_id", activeDealershipId)
        .eq("status", "available"),
      supabase
        .from("communications")
        .select("id", { count: "exact", head: true })
        .eq("dealership_id", activeDealershipId)
        .gte("created_at", sinceISO),
      supabase
        .from("agent_runs")
        .select("id", { count: "exact", head: true })
        .eq("dealership_id", activeDealershipId)
        .eq("status", "running"),
    ]);

  const counts: SidebarCounts = {
    customers:    customersR.count   ?? 0,
    campaigns:    campaignsR.count   ?? 0,
    inventory:    inventoryR.count   ?? 0,
    communications: unreadCommsR.count ?? 0,
    agents:       agentsR.count      ?? 0,
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        dealership={dealership}
        allDealerships={allDealerships}
        activeDealershipId={activeDealershipId}
        demoMode={demoMode}
        isSuperAdmin={isSuperAdmin(user.email)}
        counts={counts}
      />
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {demoMode && <DemoBanner />}
        {!demoMode && <UsageBanner dealershipId={activeDealershipId} />}
        {children}
      </div>
    </div>
  );
}
