import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { UsageBanner } from "@/components/layout/usage-banner";
import { DemoBanner } from "@/components/layout/demo-banner";
import { getAllUserDealerships, getActiveDealershipId } from "@/lib/dealership";
import { isDemoMode } from "@/lib/demo";
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        dealership={dealership}
        allDealerships={allDealerships}
        activeDealershipId={activeDealershipId}
        demoMode={demoMode}
      />
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {demoMode && <DemoBanner />}
        {!demoMode && <UsageBanner dealershipId={activeDealershipId} />}
        {children}
      </div>
    </div>
  );
}
