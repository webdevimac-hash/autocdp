import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ReputationDashboard } from "@/components/reputation/reputation-dashboard";
import type { ReputationData } from "@/components/reputation/reputation-dashboard";

export const metadata = { title: "Reputation" };

export default async function ReputationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // TODO: Replace stub with real data.
  // Suggested: query a reviews table (or pull from Google/DealerRater webhook integration).
  const data: ReputationData = {
    total_reviews: 0,
    comments: 0,
    average_rating: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    sales: { value: "—", period_label: "Last 30 Days" },
    services: { value: "—", period_label: "Last 30 Days" },
    non_sold_visits: { value: "—", period_label: "Last 30 Days" },
    reviews: [],
  };

  return (
    <>
      <Header title="Reputation" userEmail={user?.email} />
      <main className="flex-1">
        <ReputationDashboard data={data} />
      </main>
    </>
  );
}
