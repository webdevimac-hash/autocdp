import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { MiningKPIGrid } from "@/components/mining/mining-kpi-grid";
import type { MiningKPI } from "@/components/mining/mining-kpi-grid";

export const metadata = { title: "Mining" };

export default async function MiningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id, dealerships(name)")
    .eq("user_id", user!.id)
    .single();

  const dealershipName = (ud?.dealerships as any)?.name ?? "Your Store";

  // TODO: Replace stubs with real Supabase queries.
  // Suggested: query customers and inventory tables and aggregate into saved-query buckets.
  const kpis: MiningKPI[] = [
    { id: "lease-end", label: "Lease End 60 Days", count: 0, entity: "vehicle" },
    { id: "service-due", label: "Service Due", count: 0, entity: "customer" },
    { id: "aged-inventory", label: "Aged Inventory 60+", count: 0, entity: "vehicle", shared: true },
    { id: "lapsed-30", label: "Lapsed 30 Days", count: 0, entity: "customer" },
    { id: "high-ltv", label: "High LTV Customers", count: 0, entity: "customer" },
    { id: "conquest", label: "Conquest Leads", count: 0, entity: "customer" },
  ];

  const now = new Date();
  const lastUpdated = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <Header title="Mining" userEmail={user?.email} />
      <main className="flex-1">
        <MiningKPIGrid
          storeName={dealershipName}
          lastUpdated={lastUpdated}
          kpis={kpis}
        />
      </main>
    </>
  );
}
