import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { DeskLogClient, type DeskLogData } from "@/components/dashboard/desk-log-client";
import { isDemoMode } from "@/lib/demo";

export const metadata = { title: "Desk Log" };

const DEMO_DATA: DeskLogData = {
  appointments: [
    { label: "Appointments", value: 51 },
    { label: "Not Confirmed", value: 16 },
    { label: "Show", value: 15 },
    { label: "No Show", value: 15, tone: "rose" },
    { label: "Later Today", value: 19, tone: "indigo" },
  ],
  roadToSale: [
    { label: "Visits", value: 20 },
    { label: "In Store", value: 12, tone: "emerald" },
    { label: "Left Showroom", value: 7 },
    { label: "Proposal", value: 14 },
    { label: "Demo", value: 0 },
    { label: "T.O.", value: 0 },
  ],
  performance: [
    { label: "Sold", value: 4, tone: "emerald" },
    { label: "Delivered", value: 1, tone: "emerald" },
    { label: "New", value: 0 },
    { label: "Used", value: 1 },
    { label: "Total Delivered", value: 1, tone: "emerald" },
  ],
};

export default async function DeskLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const demoMode = await isDemoMode();

  // Resolve active dealership for real-data queries.
  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user!.id)
    .single();
  const dealershipId = ud?.dealership_id;

  let data: DeskLogData;

  if (demoMode || !dealershipId) {
    data = DEMO_DATA;
  } else {
    // Pull a today window from communications + customers as a first pass.
    // TODO: When a dedicated appointments table exists, switch to that.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const [commsRes, soldRes] = await Promise.all([
      supabase
        .from("communications")
        .select("id, status, channel, created_at", { count: "exact" })
        .eq("dealership_id", dealershipId)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString()),
      supabase
        .from("customers")
        .select("id, lifecycle_stage", { count: "exact" })
        .eq("dealership_id", dealershipId)
        .eq("lifecycle_stage", "sold"),
    ]);

    const todayComms = commsRes.data ?? [];
    const replied = todayComms.filter((c) => c.status === "replied").length;
    const delivered = todayComms.filter((c) => c.status === "delivered").length;
    const total = commsRes.count ?? 0;

    data = {
      appointments: [
        { label: "Appointments", value: total },
        { label: "Not Confirmed", value: total - replied },
        { label: "Show", value: replied },
        { label: "No Show", value: 0, tone: "rose" },
        { label: "Later Today", value: total - replied - delivered, tone: "indigo" },
      ],
      roadToSale: [
        { label: "Visits", value: delivered },
        { label: "In Store", value: 0, tone: "emerald" },
        { label: "Left Showroom", value: 0 },
        { label: "Proposal", value: 0 },
        { label: "Demo", value: 0 },
        { label: "T.O.", value: 0 },
      ],
      performance: [
        { label: "Sold", value: soldRes.count ?? 0, tone: "emerald" },
        { label: "Delivered", value: 0, tone: "emerald" },
        { label: "New", value: 0 },
        { label: "Used", value: 0 },
        { label: "Total Delivered", value: 0, tone: "emerald" },
      ],
    };
  }

  return (
    <>
      <Header
        title="Desk Log"
        subtitle="Today's appointments, road-to-sale, and performance at a glance"
        userEmail={user?.email}
      />
      <main className="flex-1">
        <DeskLogClient initial={data} />
      </main>
    </>
  );
}
