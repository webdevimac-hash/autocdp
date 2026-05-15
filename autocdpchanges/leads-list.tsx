"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Plus, AlertCircle, Phone, MessageCircle, Mail, Video, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CustomerDetailPanel,
  type CustomerDetailData,
} from "./customer-detail-panel";

// ----- Types ----------------------------------------------------------------

/**
 * A row in the leads list view. Designed to be lightweight enough to fetch in
 * bulk; the heavy `CustomerDetailData` is only loaded on click.
 */
export interface LeadRow {
  id: string;
  first_name: string;
  last_name: string;
  store: string;
  created_label: string; // e.g. "9 minutes ago"
  source?: string; // "Internet" | "Campaign" | ...
  source_description?: string; // long text
  last_attempt_label?: string;
  /** Either an ISO-like label ("Tomorrow", "Today") or null for no follow-up. */
  next_task?: string | null;
  next_task_overdue?: boolean;
  first_response?: string; // "1m 15s" | "Waiting" | "Fumbled" | "Unknown"
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
  /**
   * Function that loads full detail for a clicked lead. Should return the
   * `CustomerDetailData` shape consumed by `CustomerDetailPanel`. Throws or
   * returns null on failure.
   */
  loadDetail: (id: string) => Promise<CustomerDetailData | null>;
}

// ----- Component ------------------------------------------------------------

export function LeadsList({ rows, totalCount, loadDetail }: LeadsListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetailData | null>(null);
  const [loading, setLoading] = useState(false);

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
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-indigo-200 text-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Filter
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search leads…"
              className="h-8 w-64 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-700">
          {totalCount.toLocaleString()} Leads
        </div>
      </div>

      {/* Table */}
      <div className="px-6 pb-8">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
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
                {rows.map((r) => (
                  <LeadRowComp
                    key={r.id}
                    row={r}
                    onClick={() => handleRowClick(r.id)}
                    isSelected={selectedId === r.id}
                  />
                ))}
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

  return (
    <tr
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-colors hover:bg-emerald-50/40",
        isSelected && "bg-emerald-50/60",
      )}
    >
      <Td>
        <div className="flex items-center gap-3">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-slate-200 text-[10px] font-semibold text-slate-700">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-slate-800">{fullName}</span>
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
      <Badge
        variant="outline"
        className="gap-1 rounded-md border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-600"
      >
        <AlertCircle className="h-3 w-3" />
        No Follow-up +
      </Badge>
    );
  }
  if (overdue) {
    return <span className="font-medium text-amber-600">{value}</span>;
  }
  if (value === "Today" || value === "Tomorrow") {
    return <span className="text-slate-700">{value}</span>;
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
        <span
          className={cn(
            "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-50 px-1.5 text-[10px] text-slate-400",
          )}
        >
          —
        </span>
      )}
    </td>
  );
}
