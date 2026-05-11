import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { SalesEngagementHub } from "@/components/pipeline/sales-engagement-hub";
import type { FunnelStage, ChannelTotal } from "@/components/pipeline/sales-engagement-hub";

export const metadata = { title: "Sales Hub" };

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // TODO: Replace stubs with real Supabase queries.
  // Suggested: aggregate campaigns.stats by stage, join to customers for counts.
  const stages: FunnelStage[] = [
    { id: "engaged", label: "Engaged", count: 0, warnings: 0, hot: 0 },
    { id: "visit", label: "Visit", count: 0, warnings: 0, hot: 0 },
    { id: "proposal", label: "Proposal", count: 0, warnings: 0, hot: 0 },
    { id: "sold", label: "Sold", count: 0 },
    { id: "delivered", label: "Delivered", count: 0, customers: 0 },
  ];

  const channels: ChannelTotal[] = [
    { id: "snooze", label: "Snooze", count: 0 },
    { id: "snaps", label: "Snaps", count: 0 },
    { id: "videos", label: "Videos", count: 0 },
    { id: "insite", label: "InSite", count: 0 },
  ];

  return (
    <>
      <Header title="Sales Hub" userEmail={user?.email} />
      <main className="flex-1">
        <SalesEngagementHub
          stages={stages}
          dropoffs={[0, 0, 0, 0]}
          channels={channels}
          overallEngaged={0}
        />
      </main>
    </>
  );
}
