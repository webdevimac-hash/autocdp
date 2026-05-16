"use client";

/**
 * Unified Analytics Client
 *
 * Displays cross-channel ROI, spend vs. revenue charts, attribution paths,
 * and per-channel funnel metrics. All charts are pure CSS/Tailwind — no
 * external charting library required.
 */

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import {
  TrendingUp,
  DollarSign,
  MousePointerClick,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  ChevronRight,
  Zap,
  BarChart2,
} from "lucide-react";
import type {
  UnifiedAnalyticsData,
  ChannelStat,
  AttributionModel,
  AnalyticsDays,
  AttributionPath,
} from "@/lib/analytics/unified-analytics";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  dealershipName: string;
  data: UnifiedAnalyticsData;
  currentDays:  AnalyticsDays;
  currentModel: AttributionModel;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${fmt(n)}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function roiLabel(roi: number | null): string {
  if (roi === null) return "—";
  const pct = (roi * 100).toFixed(1);
  return roi >= 0 ? `+${pct}%` : `${pct}%`;
}

function roiColor(roi: number | null): string {
  if (roi === null) return "text-slate-400";
  return roi >= 0 ? "text-emerald-600" : "text-rose-500";
}

const CHANNEL_LABEL: Record<string, string> = {
  google_ads:  "Google Ads",
  meta_ads:    "Meta Ads",
  tiktok_ads:  "TikTok Ads",
  direct_mail: "Direct Mail",
  sms:         "SMS",
  email:       "Email",
  organic:     "Organic",
  referral:    "Referral",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub: string;
  icon: React.ComponentType<{ className?: string }>; accent: string;
}) {
  return (
    <div className={`stat-card ${accent} card-lift`}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/60">
          <Icon className="w-4 h-4 text-slate-600" />
        </div>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <p className="text-[11px] text-slate-400 mt-1.5">{sub}</p>
    </div>
  );
}

function FilterBar({
  days, model, onDays, onModel,
}: {
  days: AnalyticsDays;
  model: AttributionModel;
  onDays: (d: AnalyticsDays) => void;
  onModel: (m: AttributionModel) => void;
}) {
  const dayOptions: AnalyticsDays[] = [30, 60, 90];
  const modelOptions: { value: AttributionModel; label: string }[] = [
    { value: "last_touch",  label: "Last Touch" },
    { value: "first_touch", label: "First Touch" },
    { value: "linear",      label: "Linear" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date range */}
      <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
        {dayOptions.map((d) => (
          <button
            key={d}
            onClick={() => onDays(d)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              days === d
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Attribution model */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
          Attribution:
        </span>
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
          {modelOptions.map((m) => (
            <button
              key={m.value}
              onClick={() => onModel(m.value)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                model === m.value
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Daily spend vs revenue chart — pure CSS bars */
function SpendRevenueChart({ series }: { series: UnifiedAnalyticsData["dailySeries"] }) {
  const maxVal = Math.max(...series.map((d) => Math.max(d.spend, d.revenue)), 1);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="p-4 sm:p-6">
      {/* Legend */}
      <div className="flex items-center gap-5 mb-5">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-300" />
          <span className="text-xs text-slate-500 font-medium">Spend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-400" />
          <span className="text-xs text-slate-500 font-medium">Attributed Revenue</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-end gap-px min-w-[400px]" style={{ height: "140px" }}>
          {series.map((d, i) => {
            const spendH  = (d.spend   / maxVal) * 100;
            const revH    = (d.revenue / maxVal) * 100;
            const isHov   = hovered === i;

            return (
              <div
                key={d.date}
                className="relative flex-1 flex items-end gap-px group cursor-default"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Tooltip */}
                {isHov && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 bg-slate-900 text-white text-[10px] font-medium rounded-md px-2 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
                    <div className="font-bold mb-0.5">{d.date.slice(5)}</div>
                    <div className="text-slate-300">Spend: {fmtUsd(d.spend)}</div>
                    <div className="text-emerald-300">Revenue: {fmtUsd(d.revenue)}</div>
                    {d.engagements > 0 && (
                      <div className="text-violet-300">{fmtNum(d.engagements)} engaged</div>
                    )}
                  </div>
                )}

                {/* Spend bar */}
                <div
                  className="flex-1 rounded-t-sm transition-opacity"
                  style={{
                    height: `${Math.max(spendH, d.spend > 0 ? 2 : 0)}%`,
                    minHeight: d.spend > 0 ? "3px" : "0",
                    background: isHov ? "#94A3B8" : "#CBD5E1",
                    opacity: isHov ? 1 : 0.85,
                  }}
                />

                {/* Revenue bar */}
                <div
                  className="flex-1 rounded-t-sm transition-opacity"
                  style={{
                    height: `${Math.max(revH, d.revenue > 0 ? 2 : 0)}%`,
                    minHeight: d.revenue > 0 ? "3px" : "0",
                    background: isHov
                      ? "linear-gradient(0deg,#059669,#34D399)"
                      : "linear-gradient(0deg,#10B981,#6EE7B7)",
                    opacity: isHov ? 1 : 0.85,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* X axis labels */}
      <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-medium">
        <span>{series[0]?.date.slice(5)}</span>
        <span>{series[Math.floor(series.length / 2)]?.date.slice(5)}</span>
        <span>{series[series.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

/** Channel ROI table row */
function ChannelRow({ ch, maxSpend }: { ch: ChannelStat; maxSpend: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-t border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Channel name */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: ch.colorHex }}
            />
            <span className="text-[13px] font-semibold text-slate-800">{ch.label}</span>
            {ch.revenueIsEstimate && (
              <span
                className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded px-1 uppercase tracking-wider"
                title="Revenue estimated from ROAS — link CRM to get actual attribution"
              >
                est.
              </span>
            )}
          </div>
        </td>

        {/* Spend */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(2, (ch.spend / maxSpend) * 100)}%`,
                  background: ch.gradientCss,
                }}
              />
            </div>
            <span className="text-[13px] font-semibold text-slate-900 tabular-nums">
              {fmtUsd(ch.spend)}
            </span>
          </div>
        </td>

        {/* Reach */}
        <td className="px-4 py-3 text-right hidden md:table-cell">
          <span className="text-[13px] text-slate-600 tabular-nums">{fmtNum(ch.reach)}</span>
        </td>

        {/* Engagements */}
        <td className="px-4 py-3 text-right hidden lg:table-cell">
          <span className="text-[13px] text-slate-600 tabular-nums">{fmtNum(ch.engagements)}</span>
          {ch.reach > 0 && (
            <div className="text-[10px] text-slate-400 tabular-nums">
              {ch.engagements > 0
                ? `${((ch.engagements / ch.reach) * 100).toFixed(1)}%`
                : "—"}
            </div>
          )}
        </td>

        {/* Attributed Revenue */}
        <td className="px-4 py-3 text-right">
          <span className={`text-[13px] font-semibold tabular-nums ${
            ch.revenueAttributed > 0 ? "text-emerald-700" : "text-slate-400"
          }`}>
            {ch.revenueAttributed > 0 ? fmtUsd(ch.revenueAttributed) : "—"}
          </span>
        </td>

        {/* ROI */}
        <td className="px-4 py-3 text-right">
          <div className={`flex items-center justify-end gap-1 text-[13px] font-bold tabular-nums ${roiColor(ch.roi)}`}>
            {ch.roi !== null && (
              ch.roi >= 0
                ? <ArrowUpRight className="w-3.5 h-3.5" />
                : <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {roiLabel(ch.roi)}
          </div>
        </td>

        <td className="px-3 py-3 text-slate-400">
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-slate-50/70">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cost / Engagement</div>
                <div className="text-sm font-semibold text-slate-800">
                  {ch.cpe != null ? fmtUsd(ch.cpe) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cost / Conversion</div>
                <div className="text-sm font-semibold text-slate-800">
                  {ch.cpa != null ? fmtUsd(ch.cpa) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Conversions</div>
                <div className="text-sm font-semibold text-slate-800">
                  {ch.conversions > 0 ? fmtNum(ch.conversions) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Revenue Type</div>
                <div className="text-sm font-semibold text-slate-800">
                  {ch.revenueIsEstimate ? "ROAS estimate" : "CRM attributed"}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Funnel bar chart — horizontal bars showing reach → engaged → converted */
function FunnelSection({ funnel }: { funnel: UnifiedAnalyticsData["funnel"] }) {
  if (funnel.length === 0) return null;
  const maxReach = Math.max(...funnel.map((f) => f.reach), 1);

  return (
    <div className="inst-panel">
      <div className="inst-panel-header">
        <div>
          <div className="inst-panel-title">Engagement Funnel by Channel</div>
          <div className="inst-panel-subtitle">Reach → Engaged → Converted</div>
        </div>
      </div>
      <div className="p-5 space-y-5">
        {funnel.map((f) => (
          <div key={f.channel}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: f.colorHex }}
                />
                {f.label}
              </span>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {fmtNum(f.reach)} reached
              </span>
            </div>

            {/* Reach bar */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(2, (f.reach / maxReach) * 100)}%`,
                  background: f.colorHex,
                  opacity: 0.25,
                }}
              />
            </div>

            {/* Engaged bar */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5 relative">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(2, (f.engagements / maxReach) * 100)}%`,
                  background: f.colorHex,
                  opacity: 0.65,
                }}
              />
              <span className="absolute right-0 top-0 text-[9px] text-slate-400 font-semibold -mt-4 pr-0.5">
                {f.engagementRate > 0 ? `${f.engagementRate}%` : ""}
              </span>
            </div>

            {/* Converted bar */}
            {f.conversions > 0 && (
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(2, (f.conversions / maxReach) * 100)}%`,
                    background: f.colorHex,
                  }}
                />
              </div>
            )}

            <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <span className="w-2 h-1 rounded inline-block" style={{ background: f.colorHex, opacity: 0.25 }} />
                Reach
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-1 rounded inline-block" style={{ background: f.colorHex, opacity: 0.65 }} />
                Engaged ({fmtNum(f.engagements)})
              </span>
              {f.conversions > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-1 rounded inline-block" style={{ background: f.colorHex }} />
                  Converted ({fmtNum(f.conversions)})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Attribution path viz — shows journey sequences that led to revenue */
function AttributionPathsSection({ paths }: { paths: AttributionPath[] }) {
  if (paths.length === 0) {
    return (
      <div className="inst-panel">
        <div className="inst-panel-header">
          <div>
            <div className="inst-panel-title">Attribution Paths</div>
            <div className="inst-panel-subtitle">Customer journey sequences leading to revenue</div>
          </div>
        </div>
        <div className="p-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3 border border-slate-100">
            <Zap className="w-5 h-5 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No paths yet</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Attribution paths appear once customers complete multi-touch journeys
            with recorded revenue events via CRM sync.
          </p>
        </div>
      </div>
    );
  }

  const maxRev = Math.max(...paths.map((p) => p.revenueTotal), 1);

  return (
    <div className="inst-panel">
      <div className="inst-panel-header">
        <div>
          <div className="inst-panel-title">Attribution Paths</div>
          <div className="inst-panel-subtitle">Top customer journey sequences by revenue</div>
        </div>
        <span className="chip chip-emerald">{paths.length} paths</span>
      </div>
      <div className="p-5 space-y-3">
        {paths.map((p, i) => (
          <div key={i} className="bg-white rounded-[var(--radius)] border border-slate-100 shadow-card p-4">
            {/* Path visualization */}
            <div className="flex items-center flex-wrap gap-1.5 mb-3">
              {p.channels.map((ch, ci) => (
                <span key={ci} className="flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ background: "#6366F1" }}>
                    {CHANNEL_LABEL[ch] ?? ch}
                  </span>
                  {ci < p.channels.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-slate-300" />
                  )}
                </span>
              ))}
              <span className="ml-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 border border-emerald-100">
                Sale
              </span>
            </div>

            {/* Revenue bar + stats */}
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(4, (p.revenueTotal / maxRev) * 100)}%`,
                  background: "linear-gradient(90deg,#10B981,#6EE7B7)",
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                <span className="font-semibold text-slate-700">{p.count}</span> customer
                {p.count !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-3">
                <span>Total: <span className="font-semibold text-slate-800">{fmtUsd(p.revenueTotal)}</span></span>
                <span>Avg: <span className="font-semibold text-emerald-700">{fmtUsd(p.avgRevenue)}</span></span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UnifiedAnalyticsClient({
  dealershipName,
  data,
  currentDays,
  currentModel,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const navigate = useCallback(
    (days: number, model: string) => {
      router.push(`${pathname}?days=${days}&model=${model}`);
    },
    [router, pathname]
  );

  const { totals, channels, dailySeries, attributionPaths, funnel } = data;

  const maxSpend = Math.max(...channels.map((c) => c.spend), 0.01);

  const roiFormatted = totals.roi !== null
    ? `${totals.roi >= 0 ? "+" : ""}${(totals.roi * 100).toFixed(1)}%`
    : "—";

  // Sort channels by ROI descending (null last)
  const sortedChannels = [...channels].sort((a, b) => {
    if (a.roi === null && b.roi === null) return 0;
    if (a.roi === null) return 1;
    if (b.roi === null) return -1;
    return b.roi - a.roi;
  });

  const hasAnyData = channels.length > 0;

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4 px-4 sm:px-6 pt-6 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-500" />
            Unified Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {dealershipName} · {data.since} to {data.until}
          </p>
        </div>

        <FilterBar
          days={currentDays}
          model={currentModel}
          onDays={(d) => navigate(d, currentModel)}
          onModel={(m) => navigate(currentDays, m)}
        />
      </div>

      <main className="flex-1 px-4 sm:px-6 pb-8 space-y-5 max-w-[1400px]">

        {/* ── Attribution model info banner ───────────────────────── */}
        {!totals.hasAttributedRevenue && hasAnyData && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-[var(--radius)] px-4 py-3">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Revenue shown is estimated</span> from ad platform ROAS data.
              For actual closed-loop attribution, connect a CRM (DealerTrack, VinSolutions, eLead) —
              AutoCDP will then tie every sale back to the marketing touches that drove it.
            </div>
          </div>
        )}

        {/* ── KPI banner ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Total Spend"
            value={fmtUsd(totals.spend)}
            sub={`${currentDays}-day marketing cost`}
            icon={DollarSign}
            accent="stat-card-indigo"
          />
          <KpiCard
            label="Attributed Revenue"
            value={totals.revenue > 0 ? fmtUsd(totals.revenue) : "—"}
            sub={totals.hasAttributedRevenue ? "CRM-verified" : "ROAS estimate"}
            icon={TrendingUp}
            accent="stat-card-emerald"
          />
          <KpiCard
            label="Blended ROI"
            value={roiFormatted}
            sub={totals.roi !== null
              ? totals.roi >= 0 ? "Positive return" : "Below breakeven"
              : "Link CRM to calculate"}
            icon={totals.roi !== null && totals.roi >= 0 ? ArrowUpRight : ArrowDownRight}
            accent={totals.roi !== null && totals.roi >= 0 ? "stat-card-emerald" : "stat-card-amber"}
          />
          <KpiCard
            label="Total Reach"
            value={fmtNum(totals.reach)}
            sub={`${fmtNum(totals.engagements)} engaged · ${fmtNum(totals.conversions)} converted`}
            icon={Eye}
            accent="stat-card-violet"
          />
        </div>

        {/* ── Spend vs Revenue chart ───────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div>
              <div className="inst-panel-title">Daily Spend vs Attributed Revenue</div>
              <div className="inst-panel-subtitle">
                All channels combined · {currentDays}-day window
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-bold text-slate-900">{fmtUsd(totals.spend)} spent</div>
              {totals.revenue > 0 && (
                <div className="text-[11px] text-emerald-600 font-semibold">
                  {fmtUsd(totals.revenue)} returned
                </div>
              )}
            </div>
          </div>
          <SpendRevenueChart series={dailySeries} />
        </div>

        {/* ── Channel ROI Table ────────────────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div>
              <div className="inst-panel-title">Channel ROI Breakdown</div>
              <div className="inst-panel-subtitle">
                Sorted by ROI · click a row for cost-per metrics
              </div>
            </div>
            <span className="chip chip-indigo">{channels.length} channels</span>
          </div>

          {!hasAnyData ? (
            <div className="p-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3 border border-slate-100">
                <MousePointerClick className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">No channel data yet</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Connect Google Ads, Meta Ads, or TikTok in Integrations, or run a direct mail
                or SMS/email campaign to see data here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Channel</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Spend</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right hidden md:table-cell">Reach</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right hidden lg:table-cell">Engaged</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Revenue</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">ROI</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sortedChannels.map((ch) => (
                    <ChannelRow key={ch.channel} ch={ch} maxSpend={maxSpend} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                    <td className="px-4 py-3 text-[12px] font-bold text-slate-900">All Channels</td>
                    <td className="px-4 py-3 text-right text-[12px] font-bold text-slate-900 tabular-nums">
                      {fmtUsd(totals.spend)}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] font-semibold text-slate-600 hidden md:table-cell tabular-nums">
                      {fmtNum(totals.reach)}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] font-semibold text-slate-600 hidden lg:table-cell tabular-nums">
                      {fmtNum(totals.engagements)}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] font-bold tabular-nums">
                      <span className={totals.revenue > 0 ? "text-emerald-700" : "text-slate-400"}>
                        {totals.revenue > 0 ? fmtUsd(totals.revenue) : "—"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right text-[13px] font-bold tabular-nums ${roiColor(totals.roi)}`}>
                      {roiLabel(totals.roi)}
                    </td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── Funnel + Attribution paths ───────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <FunnelSection funnel={funnel} />
          <AttributionPathsSection paths={attributionPaths} />
        </div>

        {/* ── Attribution model explainer ──────────────────────────── */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div className="inst-panel-title">About Attribution Models</div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                name:  "Last Touch",
                model: "last_touch" as AttributionModel,
                desc:  "100% of revenue credit goes to the final channel the customer interacted with before converting. Conservative — favours bottom-funnel channels like Google Search.",
                color: "border-indigo-200 bg-indigo-50/50",
                chip:  "chip-indigo",
              },
              {
                name:  "First Touch",
                model: "first_touch" as AttributionModel,
                desc:  "100% of credit goes to the first channel that introduced the customer. Highlights awareness channels like TikTok, Meta, and Direct Mail.",
                color: "border-violet-200 bg-violet-50/50",
                chip:  "chip-violet",
              },
              {
                name:  "Linear",
                model: "linear" as AttributionModel,
                desc:  "Credit split equally across every channel that touched the customer. Most balanced view — good for evaluating the full journey and channel mix ROI.",
                color: "border-emerald-200 bg-emerald-50/50",
                chip:  "chip-emerald",
              },
            ].map((m) => (
              <button
                key={m.model}
                onClick={() => navigate(currentDays, m.model)}
                className={`text-left p-4 rounded-[var(--radius)] border-2 transition-all ${
                  currentModel === m.model ? m.color : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-slate-800">{m.name}</span>
                  {currentModel === m.model && (
                    <span className={`chip ${m.chip} text-[9px]`}>Active</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}
