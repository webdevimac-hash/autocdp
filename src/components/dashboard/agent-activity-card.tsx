"use client";

import Link from "next/link";
import {
  Bot,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { cn, formatRelativeDate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

export interface AgentRunRow {
  id: string;
  agent_type: string;
  status: string;
  created_at: string;
  output_summary: string | null;
}

interface AgentActivityCardProps {
  runs: AgentRunRow[];
}

// ─── Component ────────────────────────────────────────────────────────────

const AGENT_TONE: Record<
  string,
  { fg: string; bg: string; ring: string; label: string }
> = {
  orchestrator: { fg: "text-violet-700",  bg: "bg-violet-50",  ring: "ring-violet-200",  label: "Orchestrator" },
  data:         { fg: "text-sky-700",     bg: "bg-sky-50",     ring: "ring-sky-200",     label: "Data" },
  targeting:    { fg: "text-indigo-700",  bg: "bg-indigo-50",  ring: "ring-indigo-200",  label: "Targeting" },
  creative:     { fg: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200", label: "Creative" },
  optimization: { fg: "text-amber-700",   bg: "bg-amber-50",   ring: "ring-amber-200",   label: "Optimization" },
};

export function AgentActivityCard({ runs }: AgentActivityCardProps) {
  const runningCount = runs.filter((r) => r.status === "running").length;

  return (
    <div className="inst-panel overflow-hidden">
      {/* Header */}
      <div className="inst-panel-header">
        <div className="flex items-center gap-2">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-emerald-100">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            {runningCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>
          <div>
            <div className="inst-panel-title">Agent Activity</div>
            <div className="inst-panel-subtitle">
              {runningCount > 0
                ? `${runningCount} agent${runningCount === 1 ? "" : "s"} running now`
                : "Latest swarm executions"}
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/agents"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          View all <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* List or empty */}
      <div className="p-2">
        {runs.length === 0 ? <EmptyAgentState /> : (
          <ul className="divide-y divide-slate-100">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50"
              >
                <StatusDot status={run.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AgentChip type={run.agent_type} />
                    <span className="text-[11px] text-slate-400">
                      {formatRelativeDate(run.created_at)}
                    </span>
                  </div>
                  {run.output_summary && (
                    <p className="mt-0.5 text-[12px] leading-snug text-slate-500 line-clamp-2">
                      {run.output_summary}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <div className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
      </div>
    );
  }
  if (status === "running") {
    return (
      <div className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-50">
        <Clock className="h-3 w-3 text-indigo-500 animate-pulse" />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-50">
        <AlertCircle className="h-3 w-3 text-rose-500" />
      </div>
    );
  }
  return (
    <div className="mt-1 h-4 w-4 rounded-full bg-slate-100 ring-1 ring-slate-200" />
  );
}

function AgentChip({ type }: { type: string }) {
  const tone = AGENT_TONE[type] ?? {
    fg: "text-slate-700",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
    label: type,
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
        tone.fg,
        tone.bg,
        tone.ring,
      )}
    >
      {tone.label}
    </span>
  );
}

function EmptyAgentState() {
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
        <Bot className="h-5 w-5 text-slate-300" />
      </div>
      <p className="text-[13px] font-semibold text-slate-700">
        No agent runs yet
      </p>
      <p className="mt-1 text-[11.5px] text-slate-400 max-w-[260px] mx-auto">
        Launch a campaign and the swarm will appear here in real time.
      </p>
      <Link
        href="/dashboard/agents"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
      >
        <Sparkles className="h-3 w-3" />
        Try a test run
      </Link>
    </div>
  );
}
