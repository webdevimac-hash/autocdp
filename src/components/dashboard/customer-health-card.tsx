"use client";

import { Users, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

export interface HealthSegment {
  label: string;
  count: number;
  pct: number; // 0-1
  /** Tailwind background colour class for the bar fill. */
  bgClass: string;
  /** Tailwind text colour class for the legend dot. */
  dotClass: string;
}

interface CustomerHealthCardProps {
  totalCustomers: number;
  segments: HealthSegment[];
}

// ─── Component ────────────────────────────────────────────────────────────

export function CustomerHealthCard({
  totalCustomers,
  segments,
}: CustomerHealthCardProps) {
  // Build the donut from the four segments.
  const total = segments.reduce((s, x) => s + x.count, 0) || 1;
  const radius = 40;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  // Map dotClass → hex for the donut stroke colour.
  const STROKE_HEX: Record<string, string> = {
    "bg-amber-400":    "#FBBF24",
    "bg-emerald-500":  "#10B981",
    "bg-orange-500":   "#F97316",
    "bg-red-400":      "#F87171",
  };

  return (
    <div className="inst-panel overflow-hidden">
      {/* Header */}
      <div className="inst-panel-header">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 ring-1 ring-rose-100">
            <Heart className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div>
            <div className="inst-panel-title">Customer Health</div>
            <div className="inst-panel-subtitle">
              Lifecycle mix across the active rooftop
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Users className="h-3 w-3" />
          {totalCustomers.toLocaleString()}
        </div>
      </div>

      {totalCustomers === 0 ? (
        <EmptyHealthState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-5 p-5">
          {/* Donut */}
          <div className="flex items-center justify-center">
            <div className="relative h-[140px] w-[140px]">
              <svg viewBox="0 0 100 100" className="-rotate-90 h-full w-full">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="rgba(15,23,42,0.06)"
                  strokeWidth={stroke}
                />
                {segments.map((seg, i) => {
                  const len = (seg.count / total) * circumference;
                  const dash = `${len} ${circumference - len}`;
                  const offset = -accumulated;
                  accumulated += len;
                  return (
                    <circle
                      key={i}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke={STROKE_HEX[seg.bgClass] ?? "#94A3B8"}
                      strokeWidth={stroke}
                      strokeDasharray={dash}
                      strokeDashoffset={offset}
                      strokeLinecap="butt"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-black tabular-nums leading-none tracking-tight text-slate-900">
                  {totalCustomers.toLocaleString()}
                </span>
                <span className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Customers
                </span>
              </div>
            </div>
          </div>

          {/* Segment bars */}
          <div className="space-y-3">
            {segments.map((seg) => {
              const pctNumber = Math.round(seg.pct * 100);
              return (
                <div key={seg.label}>
                  <div className="flex items-center justify-between gap-2 text-[11.5px] mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", seg.bgClass)} />
                      <span className="font-semibold text-slate-700">
                        {seg.label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 tabular-nums">
                      <span className="text-slate-400">
                        {seg.count.toLocaleString()}
                      </span>
                      <span className="font-bold text-slate-700 w-10 text-right">
                        {pctNumber}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-700",
                        seg.bgClass,
                      )}
                      style={{ width: `${Math.max(2, pctNumber)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────

function EmptyHealthState() {
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
        <Users className="h-5 w-5 text-slate-300" />
      </div>
      <p className="text-[13px] font-semibold text-slate-700">
        No customers yet
      </p>
      <p className="mt-1 text-[11.5px] text-slate-400 max-w-[260px] mx-auto">
        Import your DMS or upload a CSV to see your lifecycle mix here.
      </p>
    </div>
  );
}
