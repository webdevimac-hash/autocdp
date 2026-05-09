"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Mail, MessageSquare, FileText, Search, X,
  ChevronDown, ChevronRight, Sparkles, Inbox,
  Clock, CheckCircle, AlertCircle, MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeDate, formatDate } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

type CommRow = {
  id: string;
  channel: string;
  status: string;
  subject: string | null;
  content: string;
  ai_generated: boolean | null;
  provider_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
  customer_id: string;
  campaign_id: string | null;
  customers: { first_name: string; last_name: string } | null;
};

type CommStats = {
  total: number;
  emailSent: number;
  emailOpened: number;
  emailOpenRate: number;
  smsSent: number;
  smsClicked: number;
  smsClickRate: number;
  mailSent: number;
  failed: number;
  bounceRate: number;
};

interface Props {
  initialComms: CommRow[];
  initialStats: CommStats;
  initialTotal: number;
  initialHasMore: boolean;
}

// ── Config ─────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  pending:   "chip chip-slate",
  queued:    "chip chip-slate",
  sent:      "chip chip-sky",
  delivered: "chip chip-emerald",
  opened:    "chip chip-emerald",
  clicked:   "chip chip-emerald",
  converted: "chip chip-violet",
  bounced:   "chip chip-amber",
  failed:    "chip chip-rose",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  pending: Clock, queued: Clock, sent: CheckCircle, delivered: CheckCircle,
  opened: MousePointerClick, clicked: MousePointerClick, converted: CheckCircle,
  bounced: AlertCircle, failed: AlertCircle,
};

const CHANNEL_CONFIG: Record<string, { icon: React.ElementType; chip: string; label: string }> = {
  sms:         { icon: MessageSquare, chip: "chip chip-violet", label: "SMS" },
  email:       { icon: Mail,          chip: "chip chip-sky",    label: "Email" },
  direct_mail: { icon: FileText,      chip: "chip chip-indigo", label: "Mail" },
};

const DAYS_OPTIONS = [
  { v: 7,  l: "7d"  },
  { v: 30, l: "30d" },
  { v: 90, l: "90d" },
  { v: 0,  l: "All" },
];

const STATUS_OPTIONS = [
  { v: "",          l: "Any Status"  },
  { v: "sent",      l: "Sent"        },
  { v: "delivered", l: "Delivered"   },
  { v: "opened",    l: "Opened"      },
  { v: "clicked",   l: "Clicked"     },
  { v: "bounced",   l: "Bounced"     },
  { v: "failed",    l: "Failed"      },
];

// ── Helpers ────────────────────────────────────────────────────

function msgPreview(comm: CommRow): string {
  if (comm.channel === "email") {
    return comm.subject ?? comm.content.replace(/<[^>]+>/g, "").trim().slice(0, 80);
  }
  if (comm.channel === "direct_mail") {
    return comm.content.replace(/<[^>]+>/g, "").trim().slice(0, 80) || "Direct Mail";
  }
  return comm.content.slice(0, 100);
}

function msgFull(comm: CommRow): string {
  if (comm.channel === "email") {
    return comm.content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  return comm.content;
}

// ── Sub-components ─────────────────────────────────────────────

function StatCard({
  value, label, sub, icon: Icon, iconBg, iconColor, accent,
}: {
  value: string; label: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string; accent: string;
}) {
  return (
    <div className={`stat-card ${accent} card-lift`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function SegmentedButtons({
  options, value, onChange,
}: {
  options: { v: string | number; l: string }[];
  value: string | number;
  onChange: (v: string | number) => void;
}) {
  return (
    <div className="flex gap-0.5 p-0.5 bg-slate-100 rounded-lg">
      {options.map(({ v, l }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
            value === v
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const CHANNEL_FILTER_OPTIONS = [
  { v: "",            l: "All"   },
  { v: "direct_mail", l: "Mail"  },
  { v: "sms",         l: "SMS"   },
  { v: "email",       l: "Email" },
];

// ── Main component ─────────────────────────────────────────────

export function CommunicationsClient({ initialComms, initialStats, initialTotal, initialHasMore }: Props) {
  const [comms,       setComms]       = useState<CommRow[]>(initialComms);
  const [stats,       setStats]       = useState<CommStats>(initialStats);
  const [total,       setTotal]       = useState(initialTotal);
  const [hasMore,     setHasMore]     = useState(initialHasMore);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());

  const [search,  setSearch]  = useState("");
  const [channel, setChannel] = useState("");
  const [status,  setStatus]  = useState("");
  const [days,    setDays]    = useState<number>(30);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const buildParams = useCallback(
    (pg: number) =>
      new URLSearchParams({
        channel,
        status,
        search: debouncedSearch,
        days:   String(days),
        page:   String(pg),
      }).toString(),
    [channel, status, debouncedSearch, days]
  );

  // Re-fetch when filters change
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res  = await fetch(`/api/communications?${buildParams(1)}`);
        const json = await res.json() as {
          communications: CommRow[];
          total: number;
          stats: CommStats;
          hasMore: boolean;
        };
        if (cancelled) return;
        setComms(json.communications ?? []);
        setStats(json.stats);
        setTotal(json.total ?? 0);
        setHasMore(json.hasMore ?? false);
        setCurrentPage(1);
        setExpanded(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [buildParams]);

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
      const res  = await fetch(`/api/communications?${buildParams(nextPage)}`);
      const json = await res.json() as { communications: CommRow[]; hasMore: boolean };
      setComms((prev) => [...prev, ...(json.communications ?? [])]);
      setHasMore(json.hasMore ?? false);
      setCurrentPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function resetFilters() {
    setSearch(""); setChannel(""); setStatus(""); setDays(30);
  }

  const hasFilters = Boolean(search || channel || status || days !== 30);

  return (
    <div className="space-y-5">

      {/* ── Stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          value={stats.total.toLocaleString()}
          label={`Total Sent (${days > 0 ? days + "d" : "all time"})`}
          sub={`${stats.mailSent} mail · ${stats.emailSent} email · ${stats.smsSent} SMS`}
          icon={Inbox}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          accent="stat-card-indigo"
        />
        <StatCard
          value={`${stats.emailOpenRate}%`}
          label="Email Open Rate"
          sub={`${stats.emailOpened} of ${stats.emailSent} opened`}
          icon={Mail}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          accent="stat-card-sky"
        />
        <StatCard
          value={`${stats.smsClickRate}%`}
          label="SMS Click Rate"
          sub={`${stats.smsClicked} of ${stats.smsSent} clicked`}
          icon={MessageSquare}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          accent="stat-card-violet"
        />
        <StatCard
          value={`${stats.bounceRate}%`}
          label="Bounce / Fail Rate"
          sub={`${stats.failed} message${stats.failed !== 1 ? "s" : ""} undelivered`}
          icon={AlertCircle}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          accent="stat-card-rose"
        />
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="inst-panel">
        <div className="p-4 sm:p-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name or subject…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedButtons
              options={CHANNEL_FILTER_OPTIONS}
              value={channel}
              onChange={(v) => setChannel(String(v))}
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-[7px] text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
            >
              {STATUS_OPTIONS.map(({ v, l }) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            <SegmentedButtons
              options={DAYS_OPTIONS}
              value={days}
              onChange={(v) => setDays(Number(v))}
            />

            {hasFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors px-2 py-1.5"
              >
                <X className="w-3 h-3" />Reset
              </button>
            )}

            <span className="ml-auto text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
              {loading ? "Loading…" : `${comms.length} of ${total.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────── */}
        {loading ? (
          <div className="py-20 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
            Loading…
          </div>
        ) : comms.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Inbox className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">No messages found</p>
            <p className="text-xs text-slate-400">
              {hasFilters ? "Try adjusting your filters." : "Messages will appear here once campaigns are sent."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #F1F5F9", background: "#FAFBFC" }}>
                    {[
                      { label: "Date",             cls: "w-[110px]" },
                      { label: "Customer",         cls: "min-w-[140px]" },
                      { label: "Channel",          cls: "w-[90px]" },
                      { label: "Subject / Message", cls: "min-w-[200px]" },
                      { label: "Status",           cls: "w-[140px]" },
                    ].map(({ label, cls }) => (
                      <th
                        key={label}
                        className={cn("text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap", cls)}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comms.map((comm) => {
                    const chanCfg  = CHANNEL_CONFIG[comm.channel] ?? CHANNEL_CONFIG.sms;
                    const ChanIcon = chanCfg.icon;
                    const chipCls  = STATUS_CHIP[comm.status] ?? "chip chip-slate";
                    const StIcon   = STATUS_ICON[comm.status] ?? CheckCircle;
                    const customer = comm.customers;
                    const preview  = msgPreview(comm);
                    const isOpen   = expanded.has(comm.id);

                    return (
                      <Fragment key={comm.id}>
                        {/* Main row */}
                        <tr
                          onClick={() => toggleExpand(comm.id)}
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                          style={{ borderBottom: isOpen ? "none" : "1px solid #F8FAFC" }}
                        >
                          {/* Date */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <p className="text-[12px] font-medium text-slate-700">
                              {formatRelativeDate(comm.sent_at ?? comm.created_at)}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {formatDate(comm.sent_at ?? comm.created_at, { month: "short", day: "numeric" })}
                            </p>
                          </td>

                          {/* Customer */}
                          <td className="px-5 py-3.5">
                            {customer ? (
                              <>
                                <p className="text-[13px] font-semibold text-slate-900">
                                  {customer.first_name} {customer.last_name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {comm.id.slice(0, 8)}…
                                </p>
                              </>
                            ) : (
                              <p className="text-[12px] text-slate-400 font-mono">{comm.id.slice(0, 8)}…</p>
                            )}
                          </td>

                          {/* Channel */}
                          <td className="px-5 py-3.5">
                            <span className={chanCfg.chip}>
                              <ChanIcon className="w-3 h-3" />
                              {chanCfg.label}
                            </span>
                          </td>

                          {/* Preview */}
                          <td className="px-5 py-3.5 max-w-[280px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isOpen
                                ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                              }
                              <p className="text-[12px] text-slate-600 truncate">{preview || "—"}</p>
                              {comm.ai_generated && (
                                <Sparkles className="w-3 h-3 text-violet-400 shrink-0" title="AI generated" />
                              )}
                            </div>
                            {comm.channel === "email" && comm.subject && (
                              <p className="text-[10px] text-slate-400 mt-0.5 ml-4 truncate">
                                {comm.content.replace(/<[^>]+>/g, "").slice(0, 60)}
                              </p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5">
                            <div>
                              <span className={chipCls}>
                                <StIcon className="w-3 h-3" />
                                {comm.status}
                              </span>
                              {comm.opened_at && (
                                <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                  Opened {formatRelativeDate(comm.opened_at)}
                                </p>
                              )}
                              {comm.clicked_at && !comm.opened_at && (
                                <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                  Clicked {formatRelativeDate(comm.clicked_at)}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isOpen && (
                          <tr style={{ borderBottom: "1px solid #F8FAFC" }}>
                            <td colSpan={5} className="px-5 pb-5 pt-0">
                              <div className="bg-slate-50 rounded-lg border border-slate-100 p-4 space-y-3">
                                <div>
                                  {comm.channel === "email" && comm.subject && (
                                    <p className="text-[11px] font-semibold text-slate-700 mb-1.5">
                                      Subject: {comm.subject}
                                    </p>
                                  )}
                                  <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                                    {msgFull(comm) || "(no content)"}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] pt-2 border-t border-slate-100">
                                  {comm.sent_at && (
                                    <span className="text-slate-500">
                                      <span className="font-medium text-slate-600">Sent:</span>{" "}
                                      {formatDate(comm.sent_at, { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                  )}
                                  {comm.delivered_at && (
                                    <span className="text-slate-500">
                                      <span className="font-medium text-slate-600">Delivered:</span>{" "}
                                      {formatDate(comm.delivered_at, { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                  )}
                                  {comm.opened_at && (
                                    <span className="text-emerald-700">
                                      <span className="font-medium">Opened:</span>{" "}
                                      {formatDate(comm.opened_at, { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                  )}
                                  {comm.clicked_at && (
                                    <span className="text-emerald-700">
                                      <span className="font-medium">Clicked:</span>{" "}
                                      {formatDate(comm.clicked_at, { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                  )}
                                  {comm.campaign_id && (
                                    <span className="text-slate-400 font-mono">
                                      Campaign: {comm.campaign_id.slice(0, 8)}…
                                    </span>
                                  )}
                                  {comm.provider_id && (
                                    <span className="text-slate-400 font-mono">
                                      Provider ID: {comm.provider_id.slice(0, 20)}{comm.provider_id.length > 20 ? "…" : ""}
                                    </span>
                                  )}
                                  {comm.ai_generated && (
                                    <span className="flex items-center gap-1 text-violet-600 font-medium">
                                      <Sparkles className="w-3 h-3" /> AI generated
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="p-5 border-t border-slate-50 flex items-center justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-60"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      Loading…
                    </>
                  ) : (
                    `Load more  (${comms.length} of ${total.toLocaleString()})`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
