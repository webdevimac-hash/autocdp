"use client";

import type { ReactNode } from "react";
import { Calendar, ChevronLeft, ChevronRight, Plus, Layout } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

// ----- Types ----------------------------------------------------------------

export interface AppointmentRow {
  id: string;
  customer_name: string;
  customer_initials: string;
  store: string;
  type: "Sales" | "Delivery" | "Service" | string;
  vehicle?: string;
  vehicle_tags?: string[];
  date_label: string;
  time_label: string;
  confirmed: "Confirmed" | "Pending" | "Declined";
  status: "Show" | "No Show" | "Scheduled";
  assigned_to: { name: string; initials: string; has_avatar?: boolean };
  confirmed_by?: { name: string; initials: string; has_avatar?: boolean } | null;
  created_by: { name: string; initials: string; has_avatar?: boolean };
}

interface AppointmentsTableProps {
  rows: AppointmentRow[];
  dateLabel: string;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  onToday?: () => void;
  onRowClick?: (id: string) => void;
}

// ----- Component ------------------------------------------------------------

export function AppointmentsTable({
  rows,
  dateLabel,
  onPrevDay,
  onNextDay,
  onToday,
  onRowClick,
}: AppointmentsTableProps) {
  return (
    <div className="flex h-full flex-col bg-slate-50">
      <PageHeader
        icon={<Calendar className="h-5 w-5" />}
        iconBg="bg-violet-500"
        title="Appointments"
        actions={
          <button className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600">
            New Appointment
          </button>
        }
      />

      <div className="flex items-center justify-between px-6 py-3">
        <button className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
          <Plus className="h-3.5 w-3.5" />
          Add Filter
        </button>

        <div className="flex items-center gap-4 text-sm">
          <span className="font-semibold text-slate-700">
            {rows.length} Appointments
          </span>
          <div className="flex items-center gap-1 text-slate-600">
            <button
              onClick={onPrevDay}
              className="rounded-md p-1 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] text-center font-medium">
              {dateLabel}
            </span>
            <button
              onClick={onNextDay}
              className="rounded-md p-1 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={onToday}
            className="font-medium text-emerald-600 hover:text-emerald-700"
          >
            Today
          </button>
          <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
            <Layout className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <Th>Customer</Th>
                  <Th>Store</Th>
                  <Th>Appointment Type</Th>
                  <Th>Vehicle</Th>
                  <Th>Appointment Date</Th>
                  <Th>Appointment Time</Th>
                  <Th>Confirmed</Th>
                  <Th>Appointment Status</Th>
                  <Th>Assigned to</Th>
                  <Th>Confirmed By</Th>
                  <Th>Created by</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onRowClick?.(r.id)}
                    className="cursor-pointer transition-colors hover:bg-emerald-50/40"
                  >
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-emerald-100 text-[10px] font-semibold text-emerald-700">
                            {r.customer_initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-slate-800">
                          {r.customer_name}
                        </span>
                      </div>
                    </Td>
                    <Td className="text-slate-600">{r.store}</Td>
                    <Td className="text-slate-600">{r.type}</Td>
                    <Td className="text-slate-700">
                      <span className="flex items-center gap-1.5">
                        {r.vehicle ?? "—"}
                        {r.vehicle_tags?.map((t, i) => (
                          <span key={i}>{t}</span>
                        ))}
                      </span>
                    </Td>
                    <Td className="text-slate-600">{r.date_label}</Td>
                    <Td className="font-mono text-xs text-slate-700">
                      {r.time_label}
                    </Td>
                    <Td>
                      <ConfirmedBadge value={r.confirmed} />
                    </Td>
                    <Td>
                      <StatusBadge value={r.status} />
                    </Td>
                    <Td>
                      <PersonCell person={r.assigned_to} />
                    </Td>
                    <Td>
                      {r.confirmed_by ? (
                        <PersonCell person={r.confirmed_by} />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td>
                      <PersonCell person={r.created_by} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-3 text-left font-medium first:pl-5 last:pr-5">
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

function ConfirmedBadge({ value }: { value: AppointmentRow["confirmed"] }) {
  const cls =
    value === "Confirmed"
      ? "bg-emerald-100 text-emerald-700"
      : value === "Pending"
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";
  return (
    <Badge className={cn("rounded-md", cls)} variant="outline">
      {value}
    </Badge>
  );
}

function StatusBadge({ value }: { value: AppointmentRow["status"] }) {
  const cls =
    value === "Show"
      ? "bg-emerald-100 text-emerald-700"
      : value === "No Show"
        ? "bg-rose-100 text-rose-700"
        : "bg-slate-100 text-slate-700";
  return (
    <Badge className={cn("rounded-md", cls)} variant="outline">
      {value}
    </Badge>
  );
}

function PersonCell({
  person,
}: {
  person: { name: string; initials: string; has_avatar?: boolean };
}) {
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
