"use client";

import type { ReactNode } from "react";
import { Send, Plus, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

// ----- Types ----------------------------------------------------------------

export interface EmailBlastRow {
  id: string;
  store: string;
  status: "Complete" | "Scheduled" | "Draft" | "Sending" | "Failed";
  subject: string;
  created_by: { name: string; initials: string };
  created_label: string;
  email_score: "Excellent" | "Good" | "Fair" | "Poor";
  send_date: string;
  sent: number;
  opened: number;
  clicked: number | null;
  replied: number | null;
  issues: number | null;
}

interface EmailBlastTableProps {
  rows: EmailBlastRow[];
  onCreate?: () => void;
}

// ----- Component ------------------------------------------------------------

export function EmailBlastTable({ rows, onCreate }: EmailBlastTableProps) {
  return (
    <div className="flex h-full flex-col bg-slate-50">
      <PageHeader
        icon={<Send className="h-5 w-5" />}
        iconBg="bg-sky-500"
        title="Email Blast"
        actions={
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-fuchsia-600"
          >
            <Sparkles className="h-3.5 w-3.5" />
            New AI Blast
          </button>
        }
      />

      <div className="flex items-center justify-between px-6 py-3">
        <button className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
          <Plus className="h-3.5 w-3.5" />
          Add Filter
        </button>
        <div className="text-sm font-semibold text-slate-700">
          {rows.length} Email Blasts
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <Th>Store</Th>
                  <Th>Status</Th>
                  <Th>Subject</Th>
                  <Th>Created By</Th>
                  <Th>Created</Th>
                  <Th>Email Score</Th>
                  <Th>Send Date</Th>
                  <Th className="text-right">Sent</Th>
                  <Th className="text-right">Opened</Th>
                  <Th className="text-right">Clicked</Th>
                  <Th className="text-right">Replied</Th>
                  <Th className="text-right">Issues</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer transition-colors hover:bg-emerald-50/40"
                  >
                    <Td className="text-slate-700">{r.store}</Td>
                    <Td>
                      <StatusBadge value={r.status} />
                    </Td>
                    <Td className="font-medium text-slate-800">{r.subject}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-slate-200 text-[9px] font-semibold text-slate-700">
                            {r.created_by.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-slate-700">
                          {r.created_by.name}
                        </span>
                      </div>
                    </Td>
                    <Td className="text-emerald-600">{r.created_label}</Td>
                    <Td>
                      <ScoreBadge value={r.email_score} />
                    </Td>
                    <Td className="font-mono text-xs text-slate-600">
                      {r.send_date}
                    </Td>
                    <Td className="text-right tabular-nums text-slate-700">
                      {r.sent.toLocaleString()}
                    </Td>
                    <Td className="text-right tabular-nums text-slate-700">
                      {r.opened.toLocaleString()}
                    </Td>
                    <NumberCell value={r.clicked} />
                    <NumberCell value={r.replied} />
                    <NumberCell value={r.issues} dangerous />
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

function StatusBadge({ value }: { value: EmailBlastRow["status"] }) {
  const cls =
    value === "Complete"
      ? "bg-emerald-100 text-emerald-700"
      : value === "Scheduled"
        ? "bg-sky-100 text-sky-700"
        : value === "Sending"
          ? "bg-amber-100 text-amber-700"
          : value === "Failed"
            ? "bg-rose-100 text-rose-700"
            : "bg-slate-100 text-slate-700";
  return (
    <Badge className={cn("rounded-md", cls)} variant="outline">
      {value}
    </Badge>
  );
}

function ScoreBadge({ value }: { value: EmailBlastRow["email_score"] }) {
  const cls =
    value === "Excellent"
      ? "bg-emerald-100 text-emerald-700"
      : value === "Good"
        ? "bg-lime-100 text-lime-700"
        : value === "Fair"
          ? "bg-amber-100 text-amber-700"
          : "bg-rose-100 text-rose-700";
  return (
    <Badge className={cn("rounded-md", cls)} variant="outline">
      {value}
    </Badge>
  );
}

function NumberCell({
  value,
  dangerous,
}: {
  value: number | null;
  dangerous?: boolean;
}) {
  return (
    <td className="px-3 py-3 text-right last:pr-5">
      {value === null ? (
        <span className="text-slate-300">—</span>
      ) : (
        <span
          className={cn(
            "tabular-nums",
            dangerous && value > 0 ? "font-semibold text-rose-600" : "text-slate-700",
          )}
        >
          {value.toLocaleString()}
        </span>
      )}
    </td>
  );
}
