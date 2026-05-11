import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { WorkplanPage } from "@/components/workplan/workplan-page";
import type { WorkplanTaskGroup } from "@/components/workplan/workplan-page";

export const metadata = { title: "Workplan" };

export default async function WorkplanRoutePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // TODO: Replace stub with real Supabase query.
  // Suggested: query a tasks/follow_ups table grouped by date, joined to customers.
  // Count by type (call/text/email/video/task) for each group.
  const groups: WorkplanTaskGroup[] = [];

  return (
    <>
      <Header title="Workplan" userEmail={user?.email} />
      <main className="flex-1">
        <WorkplanPage groups={groups} allComplete={groups.length === 0} />
      </main>
    </>
  );
}
