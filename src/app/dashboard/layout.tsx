import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { UsageBanner } from "@/components/layout/usage-banner";
import { getAllUserDealerships, getActiveDealershipId } from "@/lib/dealership";
import type { Dealership } from "@/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  // Load all dealerships the user belongs to (supports multi-rooftop)
  const [allDealerships, activeDealershipId] = await Promise.all([
    getAllUserDealerships(user.id),
    getActiveDealershipId(user.id),
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
      />
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        <UsageBanner dealershipId={activeDealershipId} />
        {children}
      </div>
    </div>
  );
}
