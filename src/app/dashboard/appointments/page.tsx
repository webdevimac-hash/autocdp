import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { AppointmentsTable } from "@/components/appointments/appointments-table";
import type { AppointmentRow } from "@/components/appointments/appointments-table";
import { isDemoMode } from "@/lib/demo";

export const metadata = { title: "Appointments" };

// ─── Demo data ───────────────────────────────────────────────────────────

const DEMO_ROWS: AppointmentRow[] = [
  { id: "1",  customer_name: "Nicholas Shortal",     customer_initials: "NS", store: "Braman Miami", type: "Sales",    vehicle: "2026 BMW X5",         vehicle_tags: ["🏁"], date_label: "Tue, May 12, 2026", time_label: "9:00 AM",  confirmed: "Confirmed", status: "No Show",   assigned_to: { name: "Everlayn Borges",  initials: "EB" }, confirmed_by: { name: "Everlayn Borges",  initials: "EB" }, created_by: { name: "Everlayn Borges",  initials: "EB" } },
  { id: "2",  customer_name: "Emilio Vazquez R.",    customer_initials: "EV", store: "Braman Miami", type: "Sales",    vehicle: "2026 BMW 4 Series",    vehicle_tags: ["🏁"], date_label: "Tue, May 12, 2026", time_label: "9:30 AM",  confirmed: "Confirmed", status: "Show",      assigned_to: { name: "Omar Cruz",        initials: "OC" }, confirmed_by: { name: "Omar Cruz",        initials: "OC" }, created_by: { name: "Omar Cruz",        initials: "OC" } },
  { id: "3",  customer_name: "Michael Elliott",      customer_initials: "ME", store: "Braman Miami", type: "Sales",    vehicle: "2026 MINI Hardtop 4 Door", date_label: "Tue, May 12, 2026", time_label: "9:30 AM",  confirmed: "Confirmed", status: "Show",      assigned_to: { name: "Alexander Chiriboga", initials: "AC", has_avatar: true }, confirmed_by: { name: "Selena Reyes",    initials: "SR" }, created_by: { name: "Alexander Chiriboga", initials: "AC" } },
  { id: "4",  customer_name: "Jason Angrist",        customer_initials: "JA", store: "Braman Miami", type: "Sales",    vehicle: "2027 BMW X6",          date_label: "Tue, May 12, 2026", time_label: "10:00 AM", confirmed: "Pending",   status: "No Show",   assigned_to: { name: "Christian Erazo",  initials: "CE" }, confirmed_by: null,                                          created_by: { name: "Christian Erazo",  initials: "CE" } },
  { id: "5",  customer_name: "Eddie Molieri",        customer_initials: "EM", store: "Braman Miami", type: "Sales",    vehicle: "2023 BMW X7",          date_label: "Tue, May 12, 2026", time_label: "10:00 AM", confirmed: "Pending",   status: "No Show",   assigned_to: { name: "Luke Richman",     initials: "LR" }, confirmed_by: null,                                          created_by: { name: "Luke Richman",     initials: "LR" } },
  { id: "6",  customer_name: "Jeancarlos Caballero", customer_initials: "JC", store: "Braman Miami", type: "Sales",    vehicle: "2027 BMW 5 Series",    date_label: "Tue, May 12, 2026", time_label: "11:00 AM", confirmed: "Confirmed", status: "Show",      assigned_to: { name: "Marsell Brito",    initials: "MB" }, confirmed_by: { name: "Selena Reyes",    initials: "SR" }, created_by: { name: "Marsell Brito",    initials: "MB" } },
  { id: "7",  customer_name: "Larisa Zhiveleva",     customer_initials: "LZ", store: "Braman Miami", type: "Sales",    vehicle: "2026 BMW X2",          date_label: "Tue, May 12, 2026", time_label: "11:00 AM", confirmed: "Pending",   status: "No Show",   assigned_to: { name: "Hector Arencibia", initials: "HA" }, confirmed_by: null,                                          created_by: { name: "Hector Arencibia", initials: "HA" } },
  { id: "8",  customer_name: "Dale Parrish",         customer_initials: "DP", store: "Braman Miami", type: "Sales",    vehicle: "2026 BMW 4 Series",    vehicle_tags: ["🏁"], date_label: "Tue, May 12, 2026", time_label: "11:00 AM", confirmed: "Confirmed", status: "No Show",   assigned_to: { name: "Andro Gonzalez",   initials: "AG" }, confirmed_by: { name: "Andro Gonzalez",   initials: "AG" }, created_by: { name: "Andro Gonzalez",   initials: "AG" } },
  { id: "9",  customer_name: "Ian Lawrence",         customer_initials: "IL", store: "Braman Miami", type: "Sales",    vehicle: "2026 BMW iX",          vehicle_tags: ["🏁"], date_label: "Tue, May 12, 2026", time_label: "11:00 AM", confirmed: "Confirmed", status: "Show",      assigned_to: { name: "Emely Figueredo",  initials: "EF", has_avatar: true }, confirmed_by: { name: "Selena Reyes",    initials: "SR" }, created_by: { name: "Emely Figueredo",  initials: "EF" } },
  { id: "10", customer_name: "Byron Leguisamo",      customer_initials: "BL", store: "Braman Miami", type: "Sales",    vehicle: "2026 BMW M4",          date_label: "Tue, May 12, 2026", time_label: "11:00 AM", confirmed: "Confirmed", status: "Show",      assigned_to: { name: "Michael Huet",     initials: "MH" }, confirmed_by: { name: "Michael Espinoza", initials: "ME" }, created_by: { name: "Michael Huet",     initials: "MH" } },
  { id: "11", customer_name: "Ana Martinez",         customer_initials: "AM", store: "Braman Miami", type: "Sales",    vehicle: "2026 MINI Hardtop 2 Door", date_label: "Tue, May 12, 2026", time_label: "11:30 AM", confirmed: "Confirmed", status: "Show",      assigned_to: { name: "Ryan Hernandez",   initials: "RH" }, confirmed_by: { name: "Selena Reyes",    initials: "SR" }, created_by: { name: "Ryan Hernandez",   initials: "RH" } },
  { id: "12", customer_name: "Gustavo Mancera",      customer_initials: "GM", store: "Braman Miami", type: "Sales",    vehicle: "2026 BMW X5",          date_label: "Tue, May 12, 2026", time_label: "11:30 AM", confirmed: "Pending",   status: "No Show",   assigned_to: { name: "Mariangela Perozo", initials: "MP" }, confirmed_by: null,                                          created_by: { name: "Mariangela Perozo", initials: "MP" } },
  { id: "13", customer_name: "Moises Cooper",        customer_initials: "MC", store: "Braman Miami", type: "Sales",    vehicle: "2026 BMW 3 Series",    date_label: "Tue, May 12, 2026", time_label: "11:30 AM", confirmed: "Confirmed", status: "No Show",   assigned_to: { name: "Cristian Laverde", initials: "CL", has_avatar: true }, confirmed_by: { name: "Cristian Laverde", initials: "CL", has_avatar: true }, created_by: { name: "Cristian Laverde", initials: "CL", has_avatar: true } },
  { id: "14", customer_name: "Armando Colimodio",    customer_initials: "AC", store: "Braman Miami", type: "Sales",    vehicle: "2026 BMW M3",          vehicle_tags: ["🏁"], date_label: "Tue, May 12, 2026", time_label: "12:00 PM", confirmed: "Confirmed", status: "Show",      assigned_to: { name: "Jacob Plager",     initials: "JP", has_avatar: true }, confirmed_by: { name: "Jacob Plager",     initials: "JP", has_avatar: true }, created_by: { name: "Jacob Plager",     initials: "JP", has_avatar: true } },
  { id: "15", customer_name: "Frances Donoff",       customer_initials: "FD", store: "Braman Miami", type: "Sales",    vehicle: "2026 BMW i4",          vehicle_tags: ["🏁"], date_label: "Tue, May 12, 2026", time_label: "12:30 PM", confirmed: "Confirmed", status: "Show",      assigned_to: { name: "Marc Martinez",    initials: "MM" }, confirmed_by: { name: "Selena Reyes",    initials: "SR" }, created_by: { name: "Marc Martinez",    initials: "MM" } },
];

// ─── Page ────────────────────────────────────────────────────────────────

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const demoMode = await isDemoMode();

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let rows: AppointmentRow[] = [];

  if (demoMode) {
    rows = DEMO_ROWS;
  } else {
    // Resolve the active dealership and pull communications scheduled for
    // today (proxy for appointments until a dedicated table exists).
    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id, dealerships(name)")
      .eq("user_id", user!.id)
      .single();

    const dealershipId = (ud as any)?.dealership_id;
    const storeName = (ud as any)?.dealerships?.name ?? "Main store";

    if (dealershipId) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      // TODO: Replace with a dedicated `appointments` table when available.
      // For now derive from `communications` rows so the page shows real
      // numbers without breaking when no schema exists yet.
      const { data: comms } = await supabase
        .from("communications")
        .select("id, status, channel, content, created_at, customer_id, customers(first_name, last_name)")
        .eq("dealership_id", dealershipId)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: true })
        .limit(60);

      rows = (comms ?? []).map((c: any, idx: number) => {
        const first = c.customers?.first_name ?? "Guest";
        const last = c.customers?.last_name ?? `#${idx + 1}`;
        return {
          id: c.id,
          customer_name: `${first} ${last}`,
          customer_initials: `${first[0] ?? "?"}${last[0] ?? "?"}`.toUpperCase(),
          store: storeName,
          type: "Sales",
          vehicle: "—",
          date_label: today,
          time_label: new Date(c.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          confirmed: c.status === "delivered" ? "Confirmed" : c.status === "replied" ? "Confirmed" : "Pending",
          status: c.status === "delivered" ? "Show" : "Scheduled",
          assigned_to:  { name: "Unassigned", initials: "??" },
          confirmed_by: null,
          created_by:   { name: "Unassigned", initials: "??" },
        };
      });
    }

    // If the DB has nothing yet, fall back to demo data so the page renders.
    if (rows.length === 0) rows = DEMO_ROWS;
  }

  return (
    <>
      <Header
        title="Appointments"
        subtitle={`${rows.length} for today — ${today}`}
        userEmail={user?.email}
      />
      <main className="flex-1">
        <AppointmentsTable rows={rows} dateLabel={today} />
      </main>
    </>
  );
}
