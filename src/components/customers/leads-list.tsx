"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Plus,
  AlertCircle,
  Phone,
  MessageCircle,
  Mail,
  Video,
  Search,
  BellOff,
  Filter,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CustomerDetailPanel,
  type CustomerDetailData,
} from "./customer-detail-panel";

// ----- Types ----------------------------------------------------------------

export interface LeadRow {
  id: string;
  first_name: string;
  last_name: string;
  store: string;
  created_label: string; // e.g. "9 minutes ago"
  source?: string;
  source_description?: string;
  last_attempt_label?: string;
  next_task?: string | null;
  next_task_overdue?: boolean;
  first_response?: string;
  first_user_response?: string;
  deal_sales_1?: { name: string; initials: string };
  deal_bdc?: { name: string; initials: string; has_avatar?: boolean };
  phone_count?: number;
  text_count?: number;
  email_count?: number;
  video_count?: number;
}

interface LeadsListProps {
  rows: LeadRow[];
  totalCount: number;
  loadDetail: (id: string) => Promise<CustomerDetailData | null>;
}

// ----- Component ------------------------------------------------------------

export function LeadsList({ rows, totalCount, loadDetail }: LeadsListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // Client-side filtering against the first 100 rows server gave us. Real
  // search will live behind /api/leads/search when ready.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.first_name,
        r.last_name,
        r.store,
        r.source,
        r.source_description,
        r.deal_sales_1?.name,
        r.deal_bdc?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  // Quick stats above the table.
  const noFollowupCount = rows.filter((r) => !r.next_task).length;
  const overdueCount    = rows.filter((r) => r.next_task_overdue).length;
  const newToday        = rows.filter((r) => r.created_label?.includes("minute") || r.created_label?.includes("hour ago")).length;

  async function handleRowClick(id: string) {
    setSelectedId(id);
    setLoading(true);
    try {
      const d = await loadDetail(id);
      setDetail(d);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setSelectedId(null);
    setDetail(null);
  }

  return (
    <>
      {/* Top action row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-100 bg-white sticky top-[3.5rem] z-20">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-indigo-200 bg-indigo-50/40 text-indigo-700 hover:bg-indigo-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Filter
          </Button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, store, source, salesperson…"
              className="h-9 w-72 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Live filter chips */}
          <QuickChip
            icon={<BellOff className="h-3 w-3" />}
            label="No Follow-up"
            count={noFollowupCount}
            tone="rose"
          />
          <QuickChip
            icon={<AlertCircle className="h-3 w-3" />}
            label="Overdue"
            count={overdueCount}
            tone="amber"
          />
          <QuickChip
            icon={<Filter className="h-3 w-3" />}
            label="New today"
            count={newToday}
            tone="emerald"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black tabular-nums tracking-tight text-slate-900">
            {totalCount.toLocaleString()}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Leads
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 sm:px-6 py-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 backdrop-blur-sm text-xs uppercase tracking-[0.12em] text-slate-500 sticky top-0 z-10">
                <tr>
                  <Th>Customer</Th>
                  <Th>Store</Th>
                  <Th>Created</Th>
                  <Th>Source</Th>
                  <Th className="min-w-[200px]">Source Description</Th>
                  <Th>Last Attempt</Th>
                  <Th>Next Task</Th>
                  <Th>First Response</Th>
                  <Th>First User Response</Th>
                  <Th>Deal Sales 1</Th>
                  <Th>Deal BDC</Th>
                  <Th className="text-center">
                    <Phone className="mx-auto h-3 w-3" />
                  </Th>
                  <Th className="text-center">
                    <MessageCircle className="mx-auto h-3 w-3" />
                  </Th>
                  <Th className="text-center">
                    <Mail className="mx-auto h-3 w-3" />
                  </Th>
                  <Th className="text-center">
                    <Video className="mx-auto h-3 w-3" />
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-14 text-center">
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                        <Search className="h-5 w-5 text-slate-300" />
                      </div>
                      <p className="text-[13px] font-semibold text-slate-700">
                        No matches for &ldquo;{query}&rdquo;
                      </p>
                      <p className="mt-1 text-[11.5px] text-slate-400">
                        Try a different name, store, or source.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <LeadRowComp
                      key={r.id}
                      row={r}
                      onClick={() => handleRowClick(r.id)}
                      isSelected={selectedId === r.id}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Panel overlay */}
      {selectedId && (
        <>
          {loading && !detail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm text-slate-600 shadow-xl">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
                Loading customer…
              </div>
            </div>
          )}
          {detail && (
            <CustomerDetailPanel customer={detail} onClose={handleClose} />
          )}
        </>
      )}
    </>
  );
}

// ─── Quick filter chip ────────────────────────────────────────────────────

function QuickChip({
  icon,
  label,
  count,
  tone,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  tone: "rose" | "amber" | "emerald";
}) {
  const TONE_BG: Record<typeof tone, string> = {
    rose:    "bg-rose-50 text-rose-700 ring-rose-200",
    amber:   "bg-amber-50 text-amber-700 ring-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  const TONE_NUM: Record<typeof tone, string> = {
    rose:    "bg-rose-200/60 text-rose-700",
    amber:   "bg-amber-200/60 text-amber-700",
    emerald: "bg-emerald-200/60 text-emerald-700",
  };
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ring-1 transition-colors",
        TONE_BG[tone],
      )}
    >
      {icon}
      {label}
      <span className={cn("rounded px-1.5 py-0 tabular-nums leading-none", TONE_NUM[tone])}>
        {count}
      </span>
    </button>
  );
}

// ----- Row ------------------------------------------------------------------

function LeadRowComp({
  row,
  onClick,
  isSelected,
}: {
  row: LeadRow;
  onClick: () => void;
  isSelected: boolean;
}) {
  const initials =
    `${row.first_name?.[0] ?? ""}${row.last_name?.[0] ?? ""}`.toUpperCase();
  const fullName = `${row.first_name} ${row.last_name}`;

  // Deterministic emerald/indigo/violet/amber/sky avatar tint so each
  // customer reads as their own visual entity (better at-a-glance scanning).
  const avatarTones = [
    "bg-emerald-100 text-emerald-700",
    "bg-indigo-100 text-indigo-700",
    "bg-violet-100 text-violet-700",
    "bg-amber-100 text-amber-700",
    "bg-sky-100 text-sky-700",
    "bg-rose-100 text-rose-700",
  ];
  const tone = avatarTones[
    [...initials].reduce((s, ch) => s + ch.charCodeAt(0), 0) % avatarTones.length
  ];

  return (
    <tr
      onClick={onClick}
      className={cn(
        "group cursor-pointer transition-colors",
        isSelected
          ? "bg-emerald-50/70"
          : "hover:bg-emerald-50/30",
      )}
    >
      <Td>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 ring-1 ring-white shadow-sm">
            <AvatarFallback className={cn("text-[10px] font-bold", tone)}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <div className="font-semibold text-slate-900">{fullName}</div>
            {row.source && (
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-slate-400 hidden xl:block">
                {row.source}
              </div>
            )}
          </div>
        </div>
      </Td>
      <Td className="text-slate-600">{row.store}</Td>
      <Td className="text-emerald-600">{row.created_label}</Td>
      <Td className="text-slate-600">{row.source ?? "—"}</Td>
      <Td className="max-w-[280px] truncate text-slate-600">
        {row.source_description ?? "—"}
      </Td>
      <Td className={cn("text-slate-600", row.last_attempt_label === "Unknown" && "text-slate-400")}>
        {row.last_attempt_label ?? "—"}
      </Td>
      <Td>
        <NextTaskCell value={row.next_task} overdue={row.next_task_overdue} />
      </Td>
      <Td>
        <ResponseCell value={row.first_response} />
      </Td>
      <Td>
        <ResponseCell value={row.first_user_response} />
      </Td>
      <Td>
        <PersonCell person={row.deal_sales_1} />
      </Td>
      <Td>
        <PersonCell person={row.deal_bdc} />
      </Td>
      <CounterCell value={row.phone_count} />
      <CounterCell value={row.text_count} tone="rose" />
      <CounterCell value={row.email_count} tone="rose" />
      <CounterCell value={row.video_count} />
    </tr>
  );
}

function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-3 text-left font-medium first:pl-5 last:pr-5",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-3 py-3 text-sm first:pl-5 last:pr-5",
        className,
      )}
    >
      {children}
    </td>
  );
}

function NextTaskCell({
  value,
  overdue,
}: {
  value?: string | null;
  overdue?: boolean;
}) {
  if (!value) {
    return (
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100 transition-colors"
        title="Set a follow-up task"
      >
        <BellOff className="h-3 w-3" />
        No Follow-up
        <span className="text-rose-400">＋</span>
      </button>
    );
  }
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
        <AlertCircle className="h-3 w-3" />
        {value}
      </span>
    );
  }
  if (value === "Today") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
        {value}
      </span>
    );
  }
  if (value === "Tomorrow") {
    return (
      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200">
        {value}
      </span>
    );
  }
  return <span className="text-slate-600">{value}</span>;
}

function ResponseCell({ value }: { value?: string }) {
  if (!value) return <span className="text-slate-400">—</span>;
  if (value === "Waiting" || value === "Fumbled") {
    return <span className="text-slate-400">{value}</span>;
  }
  if (value === "Unknown") {
    return <span className="text-slate-300">{value}</span>;
  }
  return <span className="font-mono text-xs text-slate-700">{value}</span>;
}

function PersonCell({
  person,
}: {
  person?: { name: string; initials: string; has_avatar?: boolean };
}) {
  if (!person) return <span className="text-slate-400">Unknown</span>;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarFallback
          className={cn(
            "text-[9px] font-semibold",
            person.has_avatar
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-200 text-slate-700",
          )}
        >
          {person.initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-slate-700">{person.name}</span>
    </div>
  );
}

function CounterCell({
  value,
  tone = "slate",
}: {
  value?: number;
  tone?: "slate" | "rose";
}) {
  return (
    <td className="px-3 py-3 text-center">
      {value && value > 0 ? (
        <span
          className={cn(
            "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
            tone === "rose"
              ? "bg-rose-100 text-rose-600"
              : "bg-slate-100 text-slate-600",
          )}
        >
          {value}
        </span>
      ) : (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-50 px-1.5 text-[10px] text-slate-400">
          —
        </span>
      )}
    </td>
  );
}
