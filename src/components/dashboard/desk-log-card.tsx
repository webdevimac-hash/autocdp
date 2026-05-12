"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ----- Types ----------------------------------------------------------------

export interface DeskLogRow {
  label: string;
  value: number | string;
  /** Optional tone override for the value pill. */
  tone?: "default" | "emerald" | "amber" | "rose" | "slate" | "indigo";
}

export interface DeskLogCardProps {
  icon: LucideIcon;
  /** Tailwind background colour for the icon tile. */
  iconBg: string;
  title: string;
  rows: DeskLogRow[];
}

// ----- Component ------------------------------------------------------------

const TONE_MAP: Record<NonNullable<DeskLogRow["tone"]>, string> = {
  default: "text-slate-900",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  rose: "text-rose-600",
  slate: "text-slate-400",
  indigo: "text-indigo-600",
};

export function DeskLogCard({ icon: Icon, iconBg, title, rows }: DeskLogCardProps) {
  return (
    <div className="inst-panel flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm",
            iconBg,
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
      </div>

      <ul className="flex-1 divide-y divide-slate-100">
        {rows.map((r) => {
          const tone = r.tone ?? "default";
          const isZero = r.value === 0 || r.value === "0";
          return (
            <li
              key={r.label}
              className="flex items-center justify-between gap-3 px-5 py-3.5"
            >
              <span className="text-[13px] font-medium text-slate-600">
                {r.label}
              </span>
              <span
                className={cn(
                  "text-[16px] font-semibold tabular-nums",
                  isZero ? "text-slate-300" : TONE_MAP[tone],
                )}
              >
                {r.value}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
