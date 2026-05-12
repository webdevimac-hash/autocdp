"use client";

import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// LINE CHART
// ═══════════════════════════════════════════════════════════════════════════

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
}

interface LineChartProps {
  /** Each series shares the same x-axis (typically months). */
  series: LineSeries[];
  /** X-axis labels (e.g. "FEB", "MAR", "APR"). */
  xLabels: string[];
  /** Pixel height for the SVG. Default 180. */
  height?: number;
  className?: string;
}

export function LineChart({ series, xLabels, height = 180, className }: LineChartProps) {
  if (series.length === 0 || xLabels.length === 0) return null;

  // Determine y-range (auto, with 10% headroom)
  const allValues = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  const max = Math.max(...allValues, 1);
  const min = 0;
  const range = max - min || 1;
  const headroom = range * 0.12;
  const yMax = max + headroom;

  const width = 100; // viewBox width — scales via preserveAspectRatio="none"
  const padX = 6;
  const padY = 10;

  function pointsFor(values: number[]) {
    const step = (width - padX * 2) / Math.max(values.length - 1, 1);
    return values
      .map((v, i) => {
        const x = padX + i * step;
        const y = padY + (1 - (v - min) / yMax) * (height - padY * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        aria-hidden
      >
        {/* horizontal gridlines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={padY + t * (height - padY * 2)}
            y2={padY + t * (height - padY * 2)}
            stroke="rgba(15,23,42,0.06)"
            strokeWidth={0.4}
          />
        ))}

        {/* series fills */}
        {series.map((s, i) => {
          const pts = pointsFor(s.values);
          const last = s.values.length - 1;
          const stepX = (width - padX * 2) / Math.max(s.values.length - 1, 1);
          const areaPath = `M${padX},${height - padY} L${pts.replace(/\s/g, " L")} L${padX + last * stepX},${height - padY} Z`;
          return (
            <path
              key={`area-${i}`}
              d={areaPath}
              fill={s.color}
              opacity={0.10}
            />
          );
        })}

        {/* series lines + points */}
        {series.map((s, i) => (
          <g key={`line-${i}`}>
            <polyline
              points={pointsFor(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={0.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {s.values.map((v, idx) => {
              const stepX = (width - padX * 2) / Math.max(s.values.length - 1, 1);
              const x = padX + idx * stepX;
              const y = padY + (1 - (v - min) / yMax) * (height - padY * 2);
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r={0.8}
                  fill={s.color}
                  stroke="white"
                  strokeWidth={0.3}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        ))}
      </svg>

      {/* X-axis labels */}
      <div className="mt-2 flex justify-between px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {xLabels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DONUT
// ═══════════════════════════════════════════════════════════════════════════

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  /** Big center text, e.g. "8 min". */
  centerLabel: string;
  /** Smaller text below the center label. */
  centerSubLabel?: string;
  /** Diameter in px. Default 160. */
  size?: number;
}

export function Donut({ segments, centerLabel, centerSubLabel, size = 160 }: DonutProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = 40;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="-rotate-90" width={size} height={size}>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(15,23,42,0.06)"
          strokeWidth={stroke}
        />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * circumference;
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
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={offset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[20px] font-black tabular-nums tracking-tight text-slate-900 leading-none">
          {centerLabel}
        </p>
        {centerSubLabel && (
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {centerSubLabel}
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HORIZONTAL BARS
// ═══════════════════════════════════════════════════════════════════════════

export interface HBar {
  label: string;
  value: number;
  /** Max value used for width — defaults to the largest in the set. */
  max?: number;
  /** Pre-formatted suffix text shown after the bar (e.g. "72%"). */
  display?: string;
  color: string;
}

interface HBarsProps {
  bars: HBar[];
  className?: string;
}

export function HBars({ bars, className }: HBarsProps) {
  const max = Math.max(...bars.map((b) => b.max ?? b.value), 1);
  return (
    <div className={cn("space-y-4", className)}>
      {bars.map((b) => {
        const pct = Math.max(2, Math.round((b.value / max) * 100));
        return (
          <div key={b.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-600 font-medium">{b.label}</span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: b.color }}
              >
                {b.display ?? b.value}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${pct}%`,
                  background: b.color,
                  boxShadow: `0 0 0 1px ${b.color}33 inset`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
