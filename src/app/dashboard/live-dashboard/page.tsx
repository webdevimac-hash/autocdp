import {
  Activity,
  DollarSign,
  CalendarDays,
  ChevronsRight,
  Clock,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { isDemoMode } from "@/lib/demo";
import {
  MetricGridCard,
  type MtdFooterStat,
} from "@/components/dashboard/metric-grid-card";

// Local helper — avoids calling a function from a "use client" module
// in server-component context, which can cause RSC serialization errors.
function dashIfZero(n: number): string | number {
  return n === 0 ? "—" : n;
}

export const metadata = { title: "Live Dashboard" };

// ----- Demo data ------------------------------------------------------------

const DEMO = {
  walkIns: {
    rows: [
      { label: "New", visits: 17, beBack: 1, delivered: 0 },
      { label: "Used", visits: 1, beBack: 0, delivered: 1 },
      { label: "Total", visits: 19, beBack: 1, delivered: 1 },
    ],
    mtd: {
      total: { value: 136, trend: "up", rank: "2nd / 6" },
      new: { value: 94, trend: "up", rank: "2nd / 6" },
      used: { value: 42, trend: "up", rank: "2nd / 6" },
    },
  },
  opportunities: {
    rows: [
      { label: "New", opps: 67, internet: 14, campaign: 42, chat: 0, phone: 10, showroom: 1 },
      { label: "Used", opps: 7, internet: 3, campaign: 0, chat: 0, phone: 4, showroom: 0 },
      { label: "None", opps: 24, internet: 7, campaign: 10, chat: 0, phone: 7, showroom: 0 },
      { label: "Total", opps: 98, internet: 24, campaign: 52, chat: 0, phone: 21, showroom: 1 },
    ],
    mtd: {
      total: { value: 1211, trend: "up", rank: "1st / 6" },
      new: { value: 688, trend: "up", rank: "1st / 6" },
      used: { value: 260, trend: "up", rank: "1st / 6" },
      none: { value: 263, trend: "up", rank: "1st / 6" },
    },
  },
  appointments: {
    rows: [
      { label: "New", appts: 39, confirmed: 29, notConfirmed: 10, upcoming: 16 },
      { label: "Used", appts: 7, confirmed: 2, notConfirmed: 5, upcoming: 3 },
      { label: "None", appts: 4, confirmed: 3, notConfirmed: 1, upcoming: 2 },
      { label: "Total", appts: 50, confirmed: 34, notConfirmed: 16, upcoming: 21 },
    ],
    mtd: {
      total: { value: 417, trend: "up", rank: "1st / 6" },
      new: { value: 301, trend: "up", rank: "1st / 6" },
      used: { value: 85, trend: "down", rank: "1st / 6" },
      none: { value: 31, trend: "down", rank: "3rd / 6" },
    },
  },
  pipeline: {
    rows: [
      { label: "Lead → Engaged", total: 74, converted: 47 },
      { label: "Engaged → Visit", total: 77, converted: 17 },
      { label: "Visit → Delivered", total: 18, converted: 1 },
    ],
    mtd: [
      { label: "Lead → Engaged", value: "65%", trend: "down" as const, rank: "1st / 6" },
      { label: "Engaged → Visit", value: "23%", trend: "down" as const, rank: "2nd / 6" },
      { label: "Visit → Delivered", value: "36%", trend: "up" as const, rank: "4th / 6" },
    ],
  },
  messages: {
    avgTime: "7 mins",
    rows: [
      { label: "0–15 min", unreplied: 6, ignored: 0, answered: "59%" },
      { label: "15–30 min", unreplied: 3, ignored: 0, answered: "6%" },
      { label: "30–60 min", unreplied: 3, ignored: 0, answered: "4%" },
      { label: "Fumble", unreplied: 39, ignored: 0, answered: "5%" },
    ],
    mtd: [
      { label: "0–15 min", value: "58%", trend: "down" as const, rank: "5th / 6" },
      { label: "15–30 min", value: "7%", trend: "down" as const, rank: "5th / 6" },
      { label: "30–60 min", value: "6%", trend: "up" as const, rank: "4th / 6" },
      { label: "Fumble", value: "30%", trend: "down" as const, rank: "2nd / 6" },
    ],
  },
  video: {
    rows: [
      { label: "Lead", opps: 74, personalized: 0, canned: 8, noVideo: 66 },
      { label: "Engaged", opps: 77, personalized: 0, canned: 1, noVideo: 76 },
      { label: "Appt", opps: 50, personalized: 0, canned: 2, noVideo: 48 },
      { label: "Visit (not sold)", opps: 14, personalized: 0, canned: 0, noVideo: 14 },
    ],
    mtd: [
      { label: "Lead", value: "1%", trend: "down" as const, rank: "5th / 6" },
      { label: "Engaged", value: "1%", trend: "down" as const, rank: "4th / 6" },
      { label: "Appt", value: "1%", trend: "down" as const, rank: "3rd / 6" },
      { label: "Visit (not sold)", value: "0%", trend: "down" as const, rank: "3rd / 6" },
    ],
  },
};

// ----- Page -----------------------------------------------------------------

export default async function LiveDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const demoMode = await isDemoMode();

  // Demo data is rich and visually correct. Real data ramps as the underlying
  // appointment / opportunity tables come online — wire those queries here.
  // TODO: Replace demo with live aggregates once /api/insights/live is built.
  const data = DEMO;
  void demoMode;

  return (
    <>
      <Header
        title="Live Dashboard"
        subtitle={`${formatNow()} — real-time pipeline, opportunities & messaging health`}
        userEmail={user?.email}
      />
      <main className="flex-1">
        <div className="p-4 sm:p-6 max-w-[1500px] space-y-5">
          {/* Active store badge (mirrors DriveCentric's filter chip) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              Active rooftop
            </span>
            <span className="text-xs text-slate-400">
              Updated continuously — values reflect the current business day.
            </span>
          </div>

          {/* Row 1: Walk-Ins / Opportunities / Appointments */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <MetricGridCard
              icon={Activity}
              iconTone="emerald"
              title="Walk-Ins"
              columns={["Visits", "Be-Back", "Delivered"]}
              rows={data.walkIns.rows.map((r) => ({
                label: r.label,
                emphasized: r.label === "Total",
                cells: [dashIfZero(r.visits), dashIfZero(r.beBack), dashIfZero(r.delivered)],
              }))}
              footer={[
                makeStat("Total", data.walkIns.mtd.total),
                makeStat("New", data.walkIns.mtd.new),
                makeStat("Used", data.walkIns.mtd.used),
              ]}
            />

            <MetricGridCard
              icon={DollarSign}
              iconTone="indigo"
              title="Opportunities"
              columns={["Opps", "Internet", "Campaign", "Chat", "Phone", "Showroom"]}
              rows={data.opportunities.rows.map((r) => ({
                label: r.label,
                emphasized: r.label === "Total",
                cells: [
                  dashIfZero(r.opps),
                  dashIfZero(r.internet),
                  dashIfZero(r.campaign),
                  dashIfZero(r.chat),
                  dashIfZero(r.phone),
                  dashIfZero(r.showroom),
                ],
              }))}
              footer={[
                makeStat("Total", data.opportunities.mtd.total),
                makeStat("New", data.opportunities.mtd.new),
                makeStat("Used", data.opportunities.mtd.used),
                makeStat("None", data.opportunities.mtd.none),
              ]}
            />

            <MetricGridCard
              icon={CalendarDays}
              iconTone="violet"
              title="Appointments"
              columns={["Appts", "Confirmed", "Not Conf.", "Upcoming"]}
              rows={data.appointments.rows.map((r) => ({
                label: r.label,
                emphasized: r.label === "Total",
                cells: [
                  dashIfZero(r.appts),
                  dashIfZero(r.confirmed),
                  dashIfZero(r.notConfirmed),
                  dashIfZero(r.upcoming),
                ],
              }))}
              footer={[
                makeStat("Total", data.appointments.mtd.total),
                makeStat("New", data.appointments.mtd.new),
                makeStat("Used", data.appointments.mtd.used),
                makeStat("None", data.appointments.mtd.none),
              ]}
            />
          </div>

          {/* Row 2: Pipeline Conversion / Message Responsiveness / Personalized Video */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <MetricGridCard
              icon={ChevronsRight}
              iconTone="emerald"
              title="Pipeline Conversion"
              columns={["Total Deals", "Converted Today"]}
              rows={data.pipeline.rows.map((r) => ({
                label: r.label,
                cells: [dashIfZero(r.total), dashIfZero(r.converted)],
              }))}
              footer={data.pipeline.mtd}
            />

            <MetricGridCard
              icon={Clock}
              iconTone="amber"
              title="Message Responsiveness"
              caption={
                <span className="flex items-center gap-2">
                  <span>Business Hours</span>
                  <span className="text-slate-300">·</span>
                  <span>
                    Avg Response Time{" "}
                    <span className="font-semibold text-slate-700">
                      {data.messages.avgTime}
                    </span>
                  </span>
                </span>
              }
              columns={["Unreplied", "Ignored", "Answered"]}
              rows={data.messages.rows.map((r) => ({
                label: r.label,
                cells: [dashIfZero(r.unreplied), dashIfZero(r.ignored), r.answered],
              }))}
              footer={data.messages.mtd}
            />

            <MetricGridCard
              icon={Video}
              iconTone="rose"
              title="Personalized Video"
              columns={["Opps", "Personalized", "Canned", "No Video"]}
              rows={data.video.rows.map((r) => ({
                label: r.label,
                cells: [
                  dashIfZero(r.opps),
                  dashIfZero(r.personalized),
                  dashIfZero(r.canned),
                  dashIfZero(r.noVideo),
                ],
              }))}
              footer={data.video.mtd}
            />
          </div>
        </div>
      </main>
    </>
  );
}

// ----- Helpers --------------------------------------------------------------

function makeStat(
  label: string,
  s: { value: number | string; trend: string; rank: string },
): MtdFooterStat {
  return {
    label,
    value: typeof s.value === "number" ? s.value.toLocaleString() : s.value,
    trend: (s.trend as "up" | "down" | "flat") ?? "flat",
    rank: s.rank,
  };
}

function formatNow() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
