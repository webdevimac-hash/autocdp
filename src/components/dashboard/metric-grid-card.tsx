"use client";

import { ArrowDown, ArrowUp, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ----- Types ----------------------------------------------------------------

export interface MtdFooterStat {
  /** Column label, e.g. "TOTAL", "NEW", "USED", "NONE" */
  label: string;
  /** Big numeric value, formatted */
  value: string | number;
  /** "1st / 6" rank label */
  rank?: string;
  /** Direction arrow on the value */
  trend?: "up" | "down" | "flat";
}

export interface MetricGridCardProps {
  /** Header icon (Lucide). */
  icon: LucideIcon;
  /** Icon color tokens — emerald is the AutoCDP house default. */
  iconTone?: "emerald" | "indigo" | "violet" | "amber" | "sky" | "rose" | "slate";
  title: string;
  /** Optional caption rendered next to the title (e.g. "Business Hours · Avg 7 mins") */
  caption?: React.ReactNode;
  /** Column headers across the grid. The first column is reserved for row labels. */
  columns: string[];
  /** Row label + value cells, in column order (must match columns minus 1). */
  rows: Array<{
    label: string;
    cells: Array<React.ReactNode>;
    /** Visually emphasises the row (used for "Total" footer rows). */
    emphasized?: boolean;
  }>;
  /** Footer stats — "Month to Date Totals" strip with rank labels. */
  footer?: MtdFooterStat[];
  /** Render in the top-right corner — typically an Info hint button. */
  trailing?: React.ReactNode;
}

// ----- Component ------------------------------------------------------------

const TONE_MAP: Record<NonNullable<MetricGridCardProps["iconTone"]>, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  indigo: "bg-indigo-50 text-indigo-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

export function MetricGridCard({
  icon: Icon,
  iconTone = "emerald",
  title,
  caption,
  columns,
  rows,
  footer,
  trailing,
}: MetricGridCardProps) {
  const cols = columns.length;

  return (
    <div className="inst-panel flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              TONE_MAP[iconTone],
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-slate-900">{title}</div>
            {caption && (
              <div className="mt-0.5 text-[11px] text-slate-500">{caption}</div>
            )}
          </div>
        </div>
        <div className="text-slate-300">
          {trailing ?? <Info className="h-3.5 w-3.5" />}
        </div>
      </div>

      {/* Grid table */}
      <div className="flex-1 px-2">
        <div className="overflow-hidden rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="w-[110px]" />
                {columns.map((c) => (
                  <th
                    key={c}
                    className="px-2 pb-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={row.label}
                  className={cn(
                    "border-t border-slate-100",
                    ri === 0 && "border-t-0",
                    row.emphasized && "bg-slate-50/50",
                  )}
                >
                  <td className="py-2.5 pl-4 pr-2 text-[13px] font-medium text-slate-600">
                    {row.label}
                  </td>
                  {row.cells.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "px-2 py-2.5 text-right tabular-nums",
                        row.emphasized
                          ? "text-[14px] font-semibold text-slate-900"
                          : "text-[14px] font-medium text-slate-800",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MTD footer */}
      {footer && footer.length > 0 && (
        <div className="mt-2 border-t border-slate-100 px-6 py-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Month to Date Totals
          </div>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${footer.length}, minmax(0, 1fr))` }}
          >
            {footer.map((f) => (
              <FooterStat key={f.label} stat={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Helpers --------------------------------------------------------------

function FooterStat({ stat }: { stat: MtdFooterStat }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {stat.label}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">
          {stat.value}
        </span>
        {stat.trend === "up" && (
          <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />
        )}
        {stat.trend === "down" && (
          <ArrowDown className="h-3.5 w-3.5 text-rose-500" />
        )}
      </div>
      {stat.rank && (
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {stat.rank}
        </div>
      )}
    </div>
  );
}

// ----- Reusable cell helpers ------------------------------------------------

/** Render an empty/zero cell as a muted dash to mimic DriveCentric's empty state. */
export function dashIfZero(n: number): React.ReactNode {
  if (n === 0) return <span className="text-slate-300">—</span>;
  return n;
}
