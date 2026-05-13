import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpRight } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

export interface StatCardPremiumProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  note?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Color rail + glow tone. */
  tone: "indigo" | "violet" | "emerald" | "amber" | "sky" | "rose";
  href?: string;
  /** Optional sparkline (7 bars). */
  spark?: number[];
  /** Optional progress percentage (0-100). */
  progress?: { value: number; label?: string };
}

// ─── Component ────────────────────────────────────────────────────────────

const TONE: Record<
  StatCardPremiumProps["tone"],
  { fg: string; bg: string; ring: string; rail: string; glow: string; spark: string }
> = {
  indigo:  { fg: "text-indigo-600",  bg: "bg-indigo-50",  ring: "ring-indigo-100",  rail: "from-indigo-300 to-indigo-600",   glow: "rgba(99,102,241,0.18)",  spark: "#6366F1" },
  violet:  { fg: "text-violet-600",  bg: "bg-violet-50",  ring: "ring-violet-100",  rail: "from-violet-300 to-violet-600",   glow: "rgba(139,92,246,0.18)", spark: "#8B5CF6" },
  emerald: { fg: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-100", rail: "from-emerald-300 to-emerald-600", glow: "rgba(16,185,129,0.18)", spark: "#10B981" },
  amber:   { fg: "text-amber-600",   bg: "bg-amber-50",   ring: "ring-amber-100",   rail: "from-amber-300 to-amber-600",     glow: "rgba(245,158,11,0.18)", spark: "#F59E0B" },
  sky:     { fg: "text-sky-600",     bg: "bg-sky-50",     ring: "ring-sky-100",     rail: "from-sky-300 to-sky-600",         glow: "rgba(14,165,233,0.18)", spark: "#0EA5E9" },
  rose:    { fg: "text-rose-600",    bg: "bg-rose-50",    ring: "ring-rose-100",    rail: "from-rose-300 to-rose-600",       glow: "rgba(244,63,94,0.18)",  spark: "#F43F5E" },
};

export function StatCardPremium(props: StatCardPremiumProps) {
  const t = TONE[props.tone];
  const Icon = props.icon;

  const body = (
    <div
      className="group relative h-full rounded-2xl bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
      style={{
        border: "1px solid rgba(15,23,42,0.07)",
        boxShadow:
          "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -16px rgba(15,23,42,0.08)",
      }}
    >
      {/* Left color rail */}
      <span
        className={cn(
          "absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-gradient-to-b",
          t.rail,
        )}
      />

      {/* Soft hover glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: t.glow }}
      />

      {/* Header: icon + open hint */}
      <div className="relative flex items-start justify-between mb-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl ring-1",
            t.bg,
            t.ring,
          )}
        >
          <Icon className={cn("h-4 w-4", t.fg)} />
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>

      {/* Big value */}
      <div className="relative">
        <div className="text-[30px] font-black tabular-nums tracking-tight text-slate-900 leading-none">
          {props.value}
        </div>
        <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {props.title}
        </div>
      </div>

      {/* Change + note */}
      {props.change && (
        <div
          className={cn(
            "relative mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold",
            props.trend === "up"
              ? "text-emerald-600"
              : props.trend === "down"
                ? "text-rose-600"
                : "text-slate-500",
          )}
        >
          {props.trend === "up" && <ArrowUp className="h-3 w-3" />}
          {props.trend === "down" && <ArrowDown className="h-3 w-3" />}
          <span>{props.change}</span>
          {props.note && (
            <span className="font-normal text-slate-400 ml-0.5">
              {props.note}
            </span>
          )}
        </div>
      )}

      {/* Optional progress bar */}
      {props.progress && (
        <div className="relative mt-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            {props.progress.label && (
              <span className="text-slate-400 font-medium">
                {props.progress.label}
              </span>
            )}
            <span className="ml-auto font-bold tabular-nums text-slate-700">
              {props.progress.value}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={cn("h-full rounded-full bg-gradient-to-r", t.rail)}
              style={{ width: `${Math.max(2, Math.min(100, props.progress.value))}%` }}
            />
          </div>
        </div>
      )}

      {/* Sparkline */}
      {props.spark && (
        <div className="relative mt-3 flex h-7 items-end gap-1" aria-hidden>
          {props.spark.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-300"
              style={{
                height: `${Math.max(8, Math.min(100, h))}%`,
                background: t.spark,
                opacity: 0.25 + (i / (props.spark!.length - 1)) * 0.65,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (props.href) {
    return (
      <Link href={props.href} className="block h-full">
        {body}
      </Link>
    );
  }
  return body;
}
