"use client";

import { Star, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

// ----- Types ----------------------------------------------------------------

export interface ReputationData {
  total_reviews: number;
  comments: number;
  average_rating: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  sales: { value: string; period_label: string };
  services: { value: string; period_label: string };
  non_sold_visits: { value: string; period_label: string };
  reviews: ReviewEntry[];
}

export interface ReviewEntry {
  id: string;
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  date_label: string;
  source: string;
}

interface ReputationDashboardProps {
  data: ReputationData;
  rangeLabel?: string;
  onClearAll?: () => void;
}

// ----- Component ------------------------------------------------------------

export function ReputationDashboard({
  data,
  rangeLabel = "Last 30 Days",
  onClearAll,
}: ReputationDashboardProps) {
  return (
    <div className="flex h-full flex-col bg-slate-50">
      <PageHeader
        icon={<Star className="h-5 w-5 fill-white" />}
        iconBg="bg-amber-400"
        title="Reputation"
        subtitle="Reviews across every channel — sentiment scored in real time."
      />

      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <button className="rounded-md bg-indigo-500 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-600">
            {rangeLabel}
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
            <Plus className="h-3.5 w-3.5" />
            Add Filter
          </button>
        </div>
        <button
          onClick={onClearAll}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Clear All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 pb-8">
        {/* Top stats */}
        <div className="grid gap-6 lg:grid-cols-3">
          <StatBlock label="Total Reviews" value={data.total_reviews.toString()} />
          <StatBlock label="Comments" value={data.comments.toString()} />
          <RatingBlock avg={data.average_rating} distribution={data.distribution} />
        </div>

        {/* Channel cards */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <ChannelCard
            label="Sales"
            value={data.sales.value}
            periodLabel={data.sales.period_label}
          />
          <ChannelCard
            label="Services"
            value={data.services.value}
            periodLabel={data.services.period_label}
          />
          <ChannelCard
            label="Non-Sold Visits"
            value={data.non_sold_visits.value}
            periodLabel={data.non_sold_visits.period_label}
          />
        </div>

        {/* Reviews */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Reviews</h2>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View All
            </button>
          </div>
          {data.reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
              No reviews in this period.
            </div>
          ) : (
            <div className="space-y-2">
              {data.reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-4xl font-bold tabular-nums text-slate-800">
        {value}
      </div>
    </div>
  );
}

function RatingBlock({
  avg,
  distribution,
}: {
  avg: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}) {
  return (
    <div>
      <div className="text-sm text-slate-500">Average Rating</div>
      <div className="mt-1 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="text-4xl font-bold tabular-nums text-slate-800">
            {avg.toFixed(1)}
          </div>
          <div className="flex">
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
        </div>
        <div className="flex-1 space-y-1">
          {([5, 4, 3, 2, 1] as const).map((star) => (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-3 text-slate-500">{star}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${distribution[star]}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums text-slate-500">
                {distribution[star]}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChannelCard({
  label,
  value,
  periodLabel,
}: {
  label: string;
  value: string;
  periodLabel: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-800">{label}</div>
          <div className="text-xs text-slate-400">{periodLabel}</div>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {value}
        </span>
      </div>
      <div className="mt-4 h-24 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100" />
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewEntry }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-medium text-slate-800">{review.author}</div>
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={cn(
                  "h-3.5 w-3.5",
                  i <= review.rating
                    ? "fill-amber-400 text-amber-400"
                    : "fill-slate-100 text-slate-300",
                )}
              />
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-400">
          {review.source} · {review.date_label}
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{review.body}</p>
    </div>
  );
}
