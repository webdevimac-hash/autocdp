"use client";

import type { ReactNode, ComponentType } from "react";
import {
  MessageSquare,
  MapPin,
  Calculator,
  ThumbsUp,
  Flag,
  AlertTriangle,
  Flame,
  Users,
  BedDouble,
  Camera,
  Video,
  Globe,
  Plus,
  ChevronsRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

// ----- Types ----------------------------------------------------------------

export interface FunnelStage {
  id: "engaged" | "visit" | "proposal" | "sold" | "delivered";
  label: string;
  count: number;
  warnings?: number;
  hot?: number;
  customers?: number;
}

export interface ChannelTotal {
  id: "snooze" | "snaps" | "videos" | "insite";
  label: string;
  count: number;
}

interface SalesEngagementHubProps {
  stages: FunnelStage[];
  dropoffs: number[];
  channels: ChannelTotal[];
  overallEngaged: number;
}

// ----- Component ------------------------------------------------------------

const STAGE_ICONS: Record<FunnelStage["id"], ComponentType<any>> = {
  engaged: MessageSquare,
  visit: MapPin,
  proposal: Calculator,
  sold: ThumbsUp,
  delivered: Flag,
};

const CHANNEL_META: Record<
  ChannelTotal["id"],
  { icon: ComponentType<any>; bg: string }
> = {
  snooze: { icon: BedDouble, bg: "bg-violet-500" },
  snaps: { icon: Camera, bg: "bg-sky-500" },
  videos: { icon: Video, bg: "bg-rose-500" },
  insite: { icon: Globe, bg: "bg-amber-500" },
};

export function SalesEngagementHub({
  stages,
  dropoffs,
  channels,
  overallEngaged,
}: SalesEngagementHubProps) {
  return (
    <div className="flex h-full flex-col bg-slate-50">
      <PageHeader
        icon={<ChevronsRight className="h-5 w-5" />}
        iconBg="bg-emerald-500"
        title="Sales Engagement Hub"
        subtitle="Live pipeline across every stage — click any stage to drill in."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
              <Plus className="h-3.5 w-3.5" />
              Add Filter
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-fuchsia-600">
              <Sparkles className="h-3.5 w-3.5" />
              Ask AI
            </button>
          </>
        }
      />

      <div className="flex-1 px-6 py-8">
        <div className="rounded-2xl bg-white px-8 py-10 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-center gap-2 overflow-x-auto">
            <FunnelArrow value={overallEngaged} tone="emerald" leading />
            {stages.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-2">
                <StageColumn stage={stage} />
                {i < stages.length - 1 && (
                  <FunnelArrow value={dropoffs[i]} tone="slate" />
                )}
              </div>
            ))}
          </div>

          {/* Channel totals */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {channels.map((c) => {
              const meta = CHANNEL_META[c.id];
              const Icon = meta.icon;
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm",
                      meta.bg,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-xl font-semibold text-slate-800">
                      {c.count.toLocaleString()}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">
                      {c.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Sub-components -------------------------------------------------------

function StageColumn({ stage }: { stage: FunnelStage }) {
  const Icon = STAGE_ICONS[stage.id];
  return (
    <div className="flex min-w-[120px] flex-col items-center">
      <Icon className="mb-2 h-5 w-5 text-slate-500" />
      <div className="text-3xl font-bold tabular-nums text-emerald-600">
        {stage.count.toLocaleString()}
      </div>
      <div className="mt-0.5 text-sm font-medium text-slate-700">{stage.label}</div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        {typeof stage.warnings === "number" && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            {stage.warnings}
          </span>
        )}
        {typeof stage.hot === "number" && (
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-rose-500" />
            {stage.hot}
          </span>
        )}
        {typeof stage.customers === "number" && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3 text-slate-400" />
            {stage.customers}
          </span>
        )}
      </div>
    </div>
  );
}

function FunnelArrow({
  value,
  tone,
  leading,
}: {
  value: number;
  tone: "emerald" | "slate";
  leading?: boolean;
}) {
  const stroke = tone === "emerald" ? "#10B981" : "#CBD5E1";
  return (
    <div className="flex flex-col items-center">
      <svg
        width={leading ? 30 : 56}
        height="44"
        viewBox={leading ? "0 0 30 44" : "0 0 56 44"}
        className="text-slate-300"
      >
        {(leading ? [0] : [0, 12, 24]).map((x, i) => (
          <path
            key={i}
            d={`M${x + 2} 14 L${x + 12} 22 L${x + 2} 30`}
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={1 - i * 0.25}
          />
        ))}
      </svg>
      <span className="mt-0.5 text-xs text-slate-500">{value}</span>
    </div>
  );
}
