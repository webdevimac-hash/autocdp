import {
  Activity,
  DollarSign,
  CalendarDays,
  Clock,
  ChevronsRight,
  Video,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import {
  LineChart,
  Donut,
  HBars,
  type LineSeries,
} from "@/components/dashboard/mini-chart";

export const metadata = { title: "Health Dashboard" };

// ─── Demo data ─────────────────────────────────────────────────────────────

const XLABELS = ["FEB", "MAR", "APR"];

const WALKINS_SERIES: LineSeries[] = [
  { label: "Total", color: "#4F46E5", values: [450, 510, 470] },
  { label: "New",   color: "#10B981", values: [280, 340, 320] },
  { label: "Used",  color: "#0EA5E9", values: [210, 220, 195] },
];

const OPPS_SERIES: LineSeries[] = [
  { label: "Total", color: "#4F46E5", values: [3800, 4900, 3600] },
  { label: "New",   color: "#10B981", values: [2600, 3400, 2400] },
  { label: "Used",  color: "#0EA5E9", values: [750, 800, 720] },
  { label: "None",  color: "#94A3B8", values: [620, 690, 600] },
];

const APPTS_SERIES: LineSeries[] = [
  { label: "Total", color: "#4F46E5", values: [1500, 1700, 1500] },
  { label: "New",   color: "#10B981", values: [950, 1180, 1050] },
  { label: "Used",  color: "#0EA5E9", values: [310, 350, 320] },
  { label: "None",  color: "#94A3B8", values: [170, 165, 155] },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function HealthDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <Header
        title="Health Dashboard"
        subtitle="3-month operating averages across walk-ins, opportunities, appointments, and messaging"
        userEmail={user?.email}
      />
      <main className="flex-1">
        <div className="p-4 sm:p-6 max-w-[1500px] space-y-5">
          {/* Filter strip */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              Active rooftop
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              Last 3 Months
            </span>
            <button className="ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              Reset
            </button>
          </div>

          {/* Row 1: line-chart trio */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <ChartPanel
              icon={Activity}
              title="Walk-Ins"
              series={WALKINS_SERIES}
              footer={[
                { label: "Total avg", value: "493", trend: "down", rank: "2nd / 6" },
                { label: "New avg",   value: "313", trend: "down", rank: "3rd / 6" },
                { label: "Used avg",  value: "181", trend: "down", rank: "2nd / 6" },
              ]}
            />
            <ChartPanel
              icon={DollarSign}
              title="Opportunities"
              series={OPPS_SERIES}
              footer={[
                { label: "Total avg", value: "4.1k", trend: "up",   rank: "1st / 6" },
                { label: "New avg",   value: "2.5k", trend: "up",   rank: "1st / 6" },
                { label: "Used avg",  value: "804", trend: "down", rank: "2nd / 6" },
                { label: "Other avg", value: "740", trend: "down", rank: "2nd / 6" },
              ]}
            />
            <ChartPanel
              icon={CalendarDays}
              title="Appointments"
              series={APPTS_SERIES}
              footer={[
                { label: "Total avg", value: "1.6k", trend: "up",   rank: "1st / 6" },
                { label: "New avg",   value: "1.1k", trend: "up",   rank: "1st / 6" },
                { label: "Used avg",  value: "326", trend: "up",   rank: "1st / 6" },
                { label: "Other avg", value: "169", trend: "up",   rank: "1st / 6" },
              ]}
            />
          </div>

          {/* Row 2: donut + bars + bars */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Message Responsiveness — donut */}
            <div className="inst-panel">
              <div className="flex items-center gap-2.5 px-6 pt-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">
                    Message Responsiveness
                  </h3>
                  <p className="text-[11px] text-slate-500">Business Hours</p>
                </div>
              </div>
              <div className="px-6 py-6 flex flex-col items-center">
                <Donut
                  size={170}
                  segments={[
                    { label: "0-15 min",  value: 61, color: "#10B981" },
                    { label: "15-30 min", value: 7,  color: "#FBBF24" },
                    { label: "30-60 min", value: 5,  color: "#F59E0B" },
                    { label: "Fumble",    value: 26, color: "#0F172A" },
                  ]}
                  centerLabel="8 min"
                  centerSubLabel="Avg time"
                />
                <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  {[
                    { dot: "#10B981", label: "0-15 min",  v: "61%" },
                    { dot: "#FBBF24", label: "15-30 min", v: "7%" },
                    { dot: "#F59E0B", label: "30-60 min", v: "5%" },
                    { dot: "#0F172A", label: "Fumble",    v: "26%" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: row.dot }}
                      />
                      <span className="text-slate-500 flex-1">{row.label}</span>
                      <span className="font-semibold tabular-nums text-slate-800">
                        {row.v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <FooterStrip
                items={[
                  { label: "0-15 min",  value: "61%", trend: "down", rank: "1st / 6" },
                  { label: "15-30 min", value: "7%",  trend: "down", rank: "2nd / 6" },
                  { label: "30-60 min", value: "5%",  trend: "down", rank: "2nd / 6" },
                  { label: "Fumble",    value: "26%", trend: "down", rank: "1st / 6" },
                ]}
              />
            </div>

            {/* Pipeline Conversion — bars */}
            <div className="inst-panel">
              <div className="flex items-center gap-2.5 px-6 pt-5 pb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <ChevronsRight className="h-4 w-4" />
                </div>
                <h3 className="text-[15px] font-semibold text-slate-900">
                  Pipeline Conversion
                </h3>
              </div>
              <div className="px-6 pb-4">
                <HBars
                  bars={[
                    { label: "Lead → Engaged",   value: 72, display: "72%", color: "#10B981" },
                    { label: "Engaged → Visit",  value: 27, display: "27%", color: "#0EA5E9" },
                    { label: "Visit → Delivered", value: 43, display: "43%", color: "#4F46E5" },
                  ]}
                />
              </div>
              <FooterStrip
                items={[
                  { label: "Lead – Engaged",    value: "72%", trend: "up",   rank: "1st / 6" },
                  { label: "Engaged – Visit",   value: "27%", trend: "down", rank: "2nd / 6" },
                  { label: "Visit – Delivered", value: "43%", trend: "up",   rank: "4th / 6" },
                ]}
              />
            </div>

            {/* Personalized Video — bars */}
            <div className="inst-panel">
              <div className="flex items-center gap-2.5 px-6 pt-5 pb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <Video className="h-4 w-4" />
                </div>
                <h3 className="text-[15px] font-semibold text-slate-900">
                  Personalized Video
                </h3>
              </div>
              <div className="px-6 pb-4">
                <HBars
                  bars={[
                    { label: "Lead",            value: 2, max: 100, display: "2%", color: "#F43F5E" },
                    { label: "Engaged",         value: 1, max: 100, display: "1%", color: "#F43F5E" },
                    { label: "Appt",            value: 1, max: 100, display: "1%", color: "#F43F5E" },
                    { label: "Visit not sold",  value: 0, max: 100, display: "—",  color: "#F43F5E" },
                  ]}
                />
              </div>
              <FooterStrip
                items={[
                  { label: "Lead",           value: "2%", trend: "down", rank: "2nd / 6" },
                  { label: "Engaged",        value: "1%", trend: "down", rank: "2nd / 6" },
                  { label: "Appt",           value: "1%", trend: "down", rank: "2nd / 6" },
                  { label: "Visit not sold", value: "—",  trend: "flat", rank: "—" },
                ]}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function ChartPanel({
  icon: Icon,
  title,
  series,
  footer,
}: {
  icon: typeof Activity;
  title: string;
  series: LineSeries[];
  footer: Array<{ label: string; value: string; trend: "up" | "down" | "flat"; rank: string }>;
}) {
  return (
    <div className="inst-panel flex flex-col">
      <div className="flex items-center gap-2.5 px-6 pt-5 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="px-4 pb-3">
        <LineChart series={series} xLabels={XLABELS} height={170} />
      </div>
      <div className="px-6 pb-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-slate-500">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}
          </div>
        ))}
      </div>
      <FooterStrip
        title="3 Month Average"
        items={footer}
      />
    </div>
  );
}

function FooterStrip({
  title = "Month to Date Totals",
  items,
}: {
  title?: string;
  items: Array<{ label: string; value: string; trend: "up" | "down" | "flat"; rank: string }>;
}) {
  return (
    <div className="mt-auto border-t border-slate-100 px-6 py-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((s) => (
          <div key={s.label}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {s.label}
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">
                {s.value}
              </span>
              {s.trend === "up" && <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />}
              {s.trend === "down" && <ArrowDown className="h-3.5 w-3.5 text-rose-500" />}
            </div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              {s.rank}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
