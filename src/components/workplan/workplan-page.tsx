"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ListTodo, Phone, MessageCircle, Mail, Video, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

// ----- Types ----------------------------------------------------------------

export interface WorkplanTaskGroup {
  id: string;
  date_label: string; // "MONDAY, MAY 11"
  title: string;
  completed: number;
  total: number;
  counts: {
    calls: number;
    texts: number;
    emails: number;
    videos: number;
    tasks: number;
  };
}

interface WorkplanPageProps {
  groups: WorkplanTaskGroup[];
  allComplete?: boolean;
}

// ----- Component ------------------------------------------------------------

const VIEWS = ["My Workplan", "Team Workplan", "Service Workplan"] as const;

export function WorkplanPage({ groups, allComplete }: WorkplanPageProps) {
  const [view, setView] = useState<(typeof VIEWS)[number]>("My Workplan");

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <PageHeader
        icon={<ListTodo className="h-5 w-5" />}
        iconBg="bg-emerald-500"
        title={view}
        actions={
          <select
            value={view}
            onChange={(e) => setView(e.target.value as (typeof VIEWS)[number])}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {VIEWS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.map((g) => (
              <TaskGroupCard key={g.id} group={g} />
            ))}
          </div>
        )}

        {allComplete && <CompletionState />}
      </div>
    </div>
  );
}

function TaskGroupCard({ group }: { group: WorkplanTaskGroup }) {
  const pct =
    group.total === 0 ? 0 : Math.round((group.completed / group.total) * 100);
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {group.date_label}
          </div>
          <div className="mt-1 flex items-center gap-3">
            <div className="font-semibold text-slate-800">{group.title}</div>
            <span className="text-xs text-slate-500">
              {group.completed} / {group.total} Completed ({pct}%)
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <CountChip icon={<Phone className="h-3 w-3" />} value={group.counts.calls} tone="emerald" />
          <CountChip icon={<MessageCircle className="h-3 w-3" />} value={group.counts.texts} tone="sky" />
          <CountChip icon={<Mail className="h-3 w-3" />} value={group.counts.emails} tone="indigo" />
          <CountChip icon={<Video className="h-3 w-3" />} value={group.counts.videos} tone="rose" />
          <CountChip icon={<CheckCircle2 className="h-3 w-3" />} value={group.counts.tasks} tone="amber" />
        </div>
      </div>
    </div>
  );
}

function CountChip({
  icon,
  value,
  tone,
}: {
  icon: ReactNode;
  value: number;
  tone: "emerald" | "sky" | "indigo" | "rose" | "amber";
}) {
  const cls = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        cls,
      )}
    >
      {icon}
      {value}
    </span>
  );
}

function CompletionState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl">🌞</div>
      <div className="mt-4 text-xl font-semibold text-emerald-600">
        All Tasks Completed!
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Take a breath. We&apos;ll surface the next batch when it&apos;s ready.
      </p>
    </div>
  );
}
