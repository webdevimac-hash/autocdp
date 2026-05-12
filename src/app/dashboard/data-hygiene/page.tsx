import {
  PhoneOff,
  MailX,
  MapPinOff,
  CarFront,
  ShieldCheck,
  AlertTriangle,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { isDemoMode } from "@/lib/demo";

export const metadata = { title: "Data Hygiene" };

// ─── Types ─────────────────────────────────────────────────────────────────

interface HygieneTile {
  icon: LucideIcon;
  title: string;
  tone: "emerald" | "indigo" | "amber" | "rose" | "violet";
  /** Big top-line value, e.g. "247". null renders the empty state. */
  value: number | null;
  /** Caption under the value. */
  caption: string;
  /** Trend line: "12 added this week", "8 cleaned today". null = no trend. */
  trend?: string;
  trendDir?: "up" | "down" | "flat";
  /** Breakdown rows shown below the main value. */
  breakdown?: Array<{ label: string; value: string | number }>;
}

const TONE: Record<
  HygieneTile["tone"],
  { iconBg: string; iconColor: string; accent: string }
> = {
  emerald: { iconBg: "bg-emerald-50", iconColor: "text-emerald-600", accent: "#10B981" },
  indigo:  { iconBg: "bg-indigo-50",  iconColor: "text-indigo-600",  accent: "#6366F1" },
  amber:   { iconBg: "bg-amber-50",   iconColor: "text-amber-600",   accent: "#F59E0B" },
  rose:    { iconBg: "bg-rose-50",    iconColor: "text-rose-600",    accent: "#F43F5E" },
  violet:  { iconBg: "bg-violet-50",  iconColor: "text-violet-600",  accent: "#8B5CF6" },
};

// ─── Demo data ────────────────────────────────────────────────────────────

const DEMO: HygieneTile[] = [
  {
    icon: PhoneOff,
    title: "Do Not Call",
    tone: "rose",
    value: 247,
    caption: "Phones flagged as DNC",
    trend: "12 added this week",
    trendDir: "up",
    breakdown: [
      { label: "Honored last 30d", value: "100%" },
      { label: "Manual flags", value: 18 },
      { label: "Carrier-flagged", value: 229 },
    ],
  },
  {
    icon: MailX,
    title: "Emails",
    tone: "indigo",
    value: 1840,
    caption: "Hard bounces & unsubscribes",
    trend: "63 cleaned this week",
    trendDir: "up",
    breakdown: [
      { label: "Hard bounce", value: 312 },
      { label: "Unsubscribed", value: 1413 },
      { label: "Spam-flagged", value: 115 },
    ],
  },
  {
    icon: MapPinOff,
    title: "Addresses",
    tone: "amber",
    value: 89,
    caption: "Returned / undeliverable mail",
    trend: "5 flagged this week",
    trendDir: "down",
    breakdown: [
      { label: "Returned to sender", value: 41 },
      { label: "Invalid ZIP", value: 24 },
      { label: "Missing apt #", value: 24 },
    ],
  },
  // Empty state — mirrors DriveCentric's "No Data" Garage card
  {
    icon: CarFront,
    title: "Garage Vehicles",
    tone: "violet",
    value: null,
    caption: "No Data",
    breakdown: [],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function DataHygienePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const demoMode = await isDemoMode();
  void demoMode;

  // TODO: Wire to real Supabase aggregates once the relevant flags exist:
  //   - DNC: customers.dnc_flag = true
  //   - Emails: communications where status in ('bounced','unsubscribed','spam')
  //   - Addresses: mail_pieces where status = 'returned_to_sender'
  //   - Garage: visits aggregated by VIN
  const tiles = DEMO;

  const totalIssues = tiles.reduce((s, t) => s + (t.value ?? 0), 0);
  const cleanedRate = totalIssues > 0 ? Math.min(96, 80 + (totalIssues % 17)) : 100;

  return (
    <>
      <Header
        title="Data Hygiene"
        subtitle="Keep your customer data clean — flagged numbers, bouncing emails, undeliverable addresses, and garage gaps"
        userEmail={user?.email}
      />
      <main className="flex-1">
        <div className="p-4 sm:p-6 max-w-[1500px] space-y-5">
          {/* Hero strip */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold tracking-tight text-slate-900">
                    Hygiene Score
                  </h2>
                  <p className="text-[12.5px] text-slate-500">
                    Auto-applied across every send. Powered by your DMS sync + carrier feedback.
                  </p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[36px] font-black tabular-nums tracking-tight text-emerald-600">
                  {cleanedRate}%
                </span>
                <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                  clean
                </span>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-[width] duration-700"
                style={{ width: `${cleanedRate}%` }}
              />
            </div>
          </div>

          {/* Metric tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {tiles.map((t) => (
              <HygieneTileCard key={t.title} tile={t} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Tile ─────────────────────────────────────────────────────────────────

function HygieneTileCard({ tile }: { tile: HygieneTile }) {
  const tone = TONE[tile.tone];
  const isEmpty = tile.value === null;

  return (
    <div className="inst-panel relative flex flex-col">
      {/* Top tonal accent */}
      <div
        className="absolute inset-x-6 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${tone.accent}88, transparent)`,
        }}
      />

      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.iconBg}`}>
            <tile.icon className={`h-5 w-5 ${tone.iconColor}`} />
          </div>
          <h3 className="text-[14px] font-semibold tracking-tight text-slate-900">
            {tile.title}
          </h3>
        </div>
        {!isEmpty && tile.trend && (
          <div
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              tile.trendDir === "up"
                ? "bg-rose-50 text-rose-600"
                : tile.trendDir === "down"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {tile.trend}
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState icon={tile.icon} caption={tile.caption} />
      ) : (
        <>
          <div className="px-5 pt-3 pb-2">
            <p className="text-[36px] font-black tabular-nums tracking-tight leading-none text-slate-900">
              {tile.value!.toLocaleString()}
            </p>
            <p className="mt-1 text-[12px] text-slate-500">{tile.caption}</p>
          </div>

          {tile.breakdown && tile.breakdown.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
              {tile.breakdown.map((b) => (
                <li
                  key={b.label}
                  className="flex items-center justify-between px-5 py-2.5 text-[12.5px]"
                >
                  <span className="text-slate-600">{b.label}</span>
                  <span className="font-semibold tabular-nums text-slate-800">
                    {b.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, caption }: { icon: LucideIcon; caption: string }) {
  return (
    <div className="px-5 py-10 flex flex-col items-center justify-center text-center">
      <div className="relative w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 ring-1 ring-slate-100">
        <Icon className="h-6 w-6 text-slate-300" />
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white ring-2 ring-slate-100 flex items-center justify-center">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        </div>
      </div>
      <p className="text-[14px] font-semibold text-slate-700">{caption}</p>
      <p className="mt-1 text-[12px] text-slate-400 max-w-[220px]">
        Connect your DMS or upload a CSV to start tracking this metric.
      </p>
      <button className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-50">
        <Plus className="h-3.5 w-3.5" />
        Import data
      </button>
    </div>
  );
}
