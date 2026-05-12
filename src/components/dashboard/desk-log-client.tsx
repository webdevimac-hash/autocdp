"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Map,
  TrendingUp,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeskLogCard, type DeskLogRow } from "./desk-log-card";

export interface DeskLogData {
  appointments: DeskLogRow[];
  roadToSale: DeskLogRow[];
  performance: DeskLogRow[];
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface DeskLogClientProps {
  /** Initial data for the page's "today" view. */
  initial: DeskLogData;
}

export function DeskLogClient({ initial }: DeskLogClientProps) {
  const [day, setDay] = useState(() => new Date());
  const dateLabel = useMemo(() => formatDate(day), [day]);
  const isToday = useMemo(() => {
    const t = new Date();
    return (
      t.getFullYear() === day.getFullYear() &&
      t.getMonth() === day.getMonth() &&
      t.getDate() === day.getDate()
    );
  }, [day]);

  function shift(deltaDays: number) {
    const next = new Date(day);
    next.setDate(next.getDate() + deltaDays);
    setDay(next);
  }

  // For now we only have data for "today". Other days render zero rows.
  // TODO: When the desk-log API exists, fetch per-date data here.
  const data: DeskLogData = isToday
    ? initial
    : {
        appointments: initial.appointments.map((r) => ({ ...r, value: 0 })),
        roadToSale: initial.roadToSale.map((r) => ({ ...r, value: 0 })),
        performance: initial.performance.map((r) => ({ ...r, value: 0 })),
      };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] space-y-5">
      {/* Filter / date strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-indigo-200 text-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Filter
        </Button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => shift(-1)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[150px] text-center text-sm font-semibold text-slate-700">
            {dateLabel}
          </span>
          <button
            onClick={() => shift(1)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDay(new Date())}
            className="ml-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Today
          </button>
        </div>
      </div>

      {/* Three primary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DeskLogCard
          icon={CalendarDays}
          iconBg="bg-violet-500"
          title="Appointments"
          rows={data.appointments}
        />
        <DeskLogCard
          icon={Map}
          iconBg="bg-slate-700"
          title="Road to Sale"
          rows={data.roadToSale}
        />
        <DeskLogCard
          icon={TrendingUp}
          iconBg="bg-emerald-500"
          title="Performance"
          rows={data.performance}
        />
      </div>

      {/* Helper hint */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <ListChecks className="h-3.5 w-3.5" />
        Showing live numbers for {isToday ? "today" : dateLabel}. Click a card
        title in the future to drill into the underlying records.
      </div>
    </div>
  );
}
