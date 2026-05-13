"use client";

import { useState, type ReactNode } from "react";
import {
  Inbox,
  MailQuestion,
  MessageSquare,
  Hash,
  AlertTriangle,
  EyeOff,
  Flame,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

export interface CommunicationsCounts {
  all: number;
  unreplied: number;
  chat: number;
  /** Tag-style filters */
  negative: number;
  ignored: number;
  fumbled: number;
  /** Per-user assignment counts */
  by_user?: Array<{ name: string; initials: string; count: number }>;
}

interface CommunicationsShellProps {
  counts: CommunicationsCounts;
  /** The existing CommunicationsClient gets dropped in here. */
  children: ReactNode;
  /** Header dealership filter pill text (e.g. "Braman Miami"). */
  dealershipName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────

type MailboxId = "all" | "unreplied" | "chat";
type TagId = "negative" | "ignored" | "fumbled";

export function CommunicationsShell({
  counts,
  children,
  dealershipName,
}: CommunicationsShellProps) {
  const [mailbox, setMailbox] = useState<MailboxId>("all");
  const [tag, setTag] = useState<TagId | null>(null);
  const [user, setUser] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 px-4 sm:px-6 pb-6">
      {/* ─── Left filter rail ──────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header with dealership filter */}
        <div className="border-b border-slate-100 p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-2">
            Conversations
          </div>
          <button
            type="button"
            className="w-full inline-flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-100"
          >
            <span className="truncate">{dealershipName ?? "All stores"}</span>
            <span className="text-[10px] text-slate-400">▾</span>
          </button>
        </div>

        {/* Mailboxes */}
        <div className="px-2 pt-3">
          <MailboxButton
            id="all"
            label="All"
            icon={Inbox}
            count={counts.all}
            active={mailbox === "all"}
            onClick={() => setMailbox("all")}
          />
          <MailboxButton
            id="unreplied"
            label="Unreplied"
            icon={MailQuestion}
            count={counts.unreplied}
            tone="rose"
            active={mailbox === "unreplied"}
            onClick={() => setMailbox("unreplied")}
          />
          <MailboxButton
            id="chat"
            label="Chat"
            icon={MessageSquare}
            count={counts.chat}
            active={mailbox === "chat"}
            onClick={() => setMailbox("chat")}
          />
        </div>

        {/* Tags */}
        <div className="px-2 pt-4">
          <SectionLabel icon={Hash}>Tags</SectionLabel>
          <TagButton
            label="Negative"
            icon={AlertTriangle}
            tone="rose"
            count={counts.negative}
            active={tag === "negative"}
            onClick={() => setTag(tag === "negative" ? null : "negative")}
          />
          <TagButton
            label="Ignored"
            icon={EyeOff}
            tone="slate"
            count={counts.ignored}
            active={tag === "ignored"}
            onClick={() => setTag(tag === "ignored" ? null : "ignored")}
          />
          <TagButton
            label="BH Fumbled"
            icon={Flame}
            tone="amber"
            count={counts.fumbled}
            active={tag === "fumbled"}
            onClick={() => setTag(tag === "fumbled" ? null : "fumbled")}
          />
        </div>

        {/* Users */}
        {counts.by_user && counts.by_user.length > 0 && (
          <div className="px-2 pt-4 pb-3 flex-1 overflow-y-auto">
            <SectionLabel icon={Users}>Users</SectionLabel>
            {counts.by_user.map((u) => (
              <UserButton
                key={u.name}
                name={u.name}
                initials={u.initials}
                count={u.count}
                active={user === u.name}
                onClick={() => setUser(user === u.name ? null : u.name)}
              />
            ))}
          </div>
        )}

        {/* Filter summary footer */}
        <div className="mt-auto border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-[10.5px] text-slate-500">
          Showing{" "}
          <span className="font-bold text-slate-700">
            {mailbox === "all" ? "all" : mailbox}
          </span>
          {tag && (
            <>
              {" · "}
              <span className="font-bold text-slate-700">{tag}</span>
            </>
          )}
          {user && (
            <>
              {" · "}
              <span className="font-bold text-slate-700">{user}</span>
            </>
          )}
        </div>
      </aside>

      {/* ─── Right content area (existing CommunicationsClient lives here) */}
      <div className="flex-1 min-w-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {children}
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Hash;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
      <Icon className="h-3 w-3" />
      {children}
    </div>
  );
}

function MailboxButton({
  id: _id,
  label,
  icon: Icon,
  count,
  tone = "slate",
  active,
  onClick,
}: {
  id: MailboxId;
  label: string;
  icon: typeof Inbox;
  count: number;
  tone?: "slate" | "rose";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-emerald-600" : "text-slate-400",
        )}
      />
      <span className="flex-1 text-left truncate">{label}</span>
      <CountChip n={count} tone={active ? "emerald" : tone} />
    </button>
  );
}

function TagButton({
  label,
  icon: Icon,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Inbox;
  count: number;
  tone: "rose" | "slate" | "amber";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "bg-slate-100 text-slate-900"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="flex-1 text-left truncate">{label}</span>
      <CountChip n={count} tone={tone} />
    </button>
  );
}

function UserButton({
  name,
  initials,
  count,
  active,
  onClick,
}: {
  name: string;
  initials: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "bg-emerald-50 text-emerald-700"
          : "text-slate-600 hover:bg-slate-50",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
          active
            ? "bg-emerald-200 text-emerald-700"
            : "bg-slate-200 text-slate-700",
        )}
      >
        {initials}
      </span>
      <span className="flex-1 text-left truncate">{name}</span>
      <CountChip n={count} tone="slate" />
    </button>
  );
}

function CountChip({
  n,
  tone,
}: {
  n: number;
  tone: "emerald" | "rose" | "amber" | "slate";
}) {
  const formatted =
    n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : n.toLocaleString();
  const map: Record<typeof tone, string> = {
    emerald: "bg-emerald-100 text-emerald-700",
    rose:    "bg-rose-100 text-rose-600",
    amber:   "bg-amber-100 text-amber-700",
    slate:   "bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-1.5 py-px text-[10px] font-bold tabular-nums leading-none min-w-[20px]",
        map[tone],
      )}
    >
      {formatted}
    </span>
  );
}
