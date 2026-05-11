import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { AppointmentsTable } from "@/components/appointments/appointments-table";
import type { AppointmentRow } from "@/components/appointments/appointments-table";

export const metadata = { title: "Appointments" };

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // TODO: Replace stub with real Supabase query.
  // Suggested: query an appointments table (or derive from campaigns/visits)
  // filtered to today's date, ordered by time.
  const rows: AppointmentRow[] = [];

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <Header title="Appointments" userEmail={user?.email} />
      <main className="flex-1">
        <AppointmentsTable rows={rows} dateLabel={today} />
      </main>
    </>
  );
}
