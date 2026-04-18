import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import type { Dealership } from "@/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  // Load the user's dealership
  const { data: userDealership } = await supabase
    .from("user_dealerships")
    .select("dealership_id, role")
    .eq("user_id", user.id)
    .single();

  let dealership: Dealership | null = null;
  if (userDealership?.dealership_id) {
    const { data } = await supabase
      .from("dealerships")
      .select("*")
      .eq("id", userDealership.dealership_id)
      .single();
    dealership = data;
  }

  // New users without a dealership → onboarding
  if (!dealership) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar dealership={dealership} />
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
