"use client";

import {
  Star,
  Plus,
  ArrowUp,
  ArrowDown,
  Building2,
  MessageSquare,
  Wrench,
  Footprints,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

export interface ReputationData {
  total_reviews: number;
  comments: number;
  average_rating: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  sales: { value: string; period_label: string; trend?: "up" | "down" | "flat" };
  services: { value: string; period_label: string; trend?: "up" | "down" | "flat" };
  non_sold_visits: { value: string; period_label: string; trend?: "up" | "down" | "flat" };
  reviews: ReviewEntry[];
}

export interface ReviewEntry {
  id: string;
  author: string;
  initials?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  date_label: string;
  source: string;
  /** Optional accent tone for the row's source pill. */
  source_tone?: "google" | "dealerrater" | "yelp" | "internal";
}

interface ReputationDashboardProps {
  data: ReputationData;
  rangeLabel?: string;
  onClearAll?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export function ReputationDashboard({
  data,
  rangeLabel = "Last 30 Days",
  onClearAll,
}: ReputationDashboardProps) {
  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Filter strip */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-full bg-violet-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            {rangeLabel}
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
            <Plus className="h-3 w-3" />
            Add filter
          </button>
        </div>
        <button
          onClick={onClearAll}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Clear All
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 pb-10 space-y-5 max-w-[1500px]">
        {/* Headline row: Comments / Average Rating / Distribution */}
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryStat
            icon={MessageSquare}
            iconTone="indigo"
            label="Comments"
            value={data.comments.toLocaleString()}
            sublabel={`${data.total_reviews.toLocaleString()} total reviews`}
          />
          <AverageRatingCard avg={data.average_rating} />
          <DistributionCard distribution={data.distribution} />
        </div>

        {/* Channel cards: Sales / Services / Non-Sold Visits */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ChannelCard
            icon={Building2}
            iconTone="emerald"
            label="Sales"
            value={data.sales.value}
            periodLabel={data.sales.period_label}
            trend={data.sales.trend}
          />
          <ChannelCard
            icon={Wrench}
            iconTone="indigo"
            label="Services"
            value={data.services.value}
            periodLabel={data.services.period_label}
            trend={data.services.trend}
          />
          <ChannelCard
            icon={Footprints}
            iconTone="amber"
            label="Non-Sold Visits"
            value={data.non_sold_visits.value}
            periodLabel={data.non_sold_visits.period_label}
            trend={data.non_sold_visits.trend}
          />
        </div>

        {/* Reviews */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div>
              <div className="inst-panel-title">Recent Reviews</div>
              <div className="inst-panel-subtitle">
                Latest sentiment across Google, DealerRater, Yelp, and internal surveys
              </div>
            </div>
            <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              View all →
            </button>
          </div>
          <div className="p-4 sm:p-5">
            {data.reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 py-14 text-center text-sm text-slate-400">
                <Star className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                No reviews in this period.
              </div>
            ) : (
              <div className="space-y-3">
                {data.reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

type Tone = "emerald" | "indigo" | "amber" | "rose" | "slate";

const TONE_MAP: Record<Tone, { bg: string; fg: string; ring: string }> = {
  emerald: { bg: "bg-emerald-50", fg: "text-emerald-600", ring: "ring-emerald-100" },
  indigo:  { bg: "bg-indigo-50",  fg: "text-indigo-600",  ring: "ring-indigo-100" },
  amber:   { bg: "bg-amber-50",   fg: "text-amber-600",   ring: "ring-amber-100" },
  rose:    { bg: "bg-rose-50",    fg: "text-rose-600",    ring: "ring-rose-100" },
  slate:   { bg: "bg-slate-50",   fg: "text-slate-600",   ring: "ring-slate-100" },
};

function SummaryStat({
  icon: Icon,
  iconTone,
  label,
  value,
  sublabel,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconTone: Tone;
  label: string;
  value: string;
  sublabel?: string;
}) {
  const tone = TONE_MAP[iconTone];
  return (
    <div className="inst-panel p-5 flex items-start gap-4">
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl ring-1", tone.bg, tone.ring)}>
        <Icon className={cn("h-5 w-5", tone.fg)} />
      </div>
      <div className="flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="mt-1 text-[34px] font-black tabular-nums tracking-tight text-slate-900 leading-none">
          {value}
        </div>
        {sublabel && (
          <div className="mt-1.5 text-[12px] text-slate-500">{sublabel}</div>
        )}
      </div>
    </div>
  );
}

function AverageRatingCard({ avg }: { avg: number }) {
  const rounded = Math.round(avg * 10) / 10;
  return (
    <div className="inst-panel p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Average Rating
      </div>
      <div className="mt-2 flex items-center gap-4">
        <div className="text-[44px] font-black tabular-nums leading-none tracking-tight text-slate-900">
          {rounded.toFixed(1)}
        </div>
        <div className="flex flex-col items-start">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={cn(
                  "h-5 w-5",
                  i <= Math.round(avg)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-slate-100 text-slate-300",
                )}
              />
            ))}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500">
            out of 5.0
          </div>
        </div>
      </div>
    </div>
  );
}

function DistributionCard({
  distribution,
}: {
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}) {
  return (
    <div className="inst-panel p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Rating Distribution
      </div>
      <div className="space-y-1.5">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const pct = distribution[star] ?? 0;
          return (
            <div key={star} className="flex items-center gap-2 text-[11px]">
              <span className="flex w-9 items-center gap-1 text-slate-700 font-medium">
                {star}
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700",
                    star >= 4
                      ? "bg-emerald-500"
                      : star === 3
                        ? "bg-amber-400"
                        : "bg-rose-400",
                  )}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
              <span className="w-9 text-right font-semibold tabular-nums text-slate-700">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChannelCard({
  icon: Icon,
  iconTone,
  label,
  value,
  periodLabel,
  trend,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconTone: Tone;
  label: string;
  value: string;
  periodLabel: string;
  trend?: "up" | "down" | "flat";
}) {
  const tone = TONE_MAP[iconTone];
  return (
    <div className="inst-panel p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl ring-1", tone.bg, tone.ring)}>
          <Icon className={cn("h-5 w-5", tone.fg)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold tracking-tight text-slate-900 truncate">
            {label}
          </div>
          <div className="text-[11px] text-slate-500">{periodLabel}</div>
        </div>
        {trend && trend !== "flat" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              trend === "up"
                ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
                : "bg-rose-50 text-rose-600 ring-1 ring-rose-100",
            )}
          >
            {trend === "up" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {trend === "up" ? "Up" : "Down"}
          </span>
        )}
      </div>

      {/* Big value + spark area */}
      <div className="flex items-end justify-between gap-3">
        <div className="text-[36px] font-black tabular-nums leading-none tracking-tight text-slate-900">
          {value}
        </div>
        {/* Synthetic sparkline so the panel doesn't feel empty */}
        <MiniSpark tone={iconTone} />
      </div>
    </div>
  );
}

function MiniSpark({ tone }: { tone: Tone }) {
  const heights = [42, 55, 48, 64, 58, 70, 66, 78, 72, 86];
  const fg =
    tone === "emerald"
      ? "#10B981"
      : tone === "indigo"
        ? "#6366F1"
        : tone === "amber"
          ? "#F59E0B"
          : tone === "rose"
            ? "#F43F5E"
            : "#64748B";
  return (
    <div className="flex h-10 items-end gap-1" aria-hidden>
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm"
          style={{
            height: `${h}%`,
            background: fg,
            opacity: 0.25 + (i / (heights.length - 1)) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewEntry }) {
  const initials =
    review.initials ??
    review.author
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  const sourceStyle = sourceToneClass(review.source_tone);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[11px] font-bold text-slate-700">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900 text-[13.5px]">
              {review.author}
            </span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-3 w-3",
                    i <= review.rating
                      ? "fill-amber-400 text-amber-400"
                      : "fill-slate-100 text-slate-300",
                  )}
                />
              ))}
            </div>
            <span
              className={cn(
                "ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                sourceStyle,
              )}
            >
              {review.source}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
            {review.body}
          </p>
          <div className="mt-1.5 text-[10.5px] font-medium uppercase tracking-wider text-slate-400">
            {review.date_label}
          </div>
        </div>
      </div>
    </div>
  );
}

function sourceToneClass(tone?: ReviewEntry["source_tone"]) {
  switch (tone) {
    case "google":      return "bg-sky-50 text-sky-700 ring-1 ring-sky-100";
    case "dealerrater": return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
    case "yelp":        return "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
    case "internal":    return "bg-violet-50 text-violet-700 ring-1 ring-violet-100";
    default:            return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}
