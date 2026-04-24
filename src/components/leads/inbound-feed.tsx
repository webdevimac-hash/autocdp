"use client";

import { useState, useEffect, useCallback } from "react";
import type { ConquestLead } from "@/types";

interface InboundFeedProps {
  dealershipId?: string;
}

interface ReplyState {
  leadId: string | null;
  channel: "sms" | "email";
  message: string;
  subject: string;
  sending: boolean;
  drafting: boolean;
}

const DEFAULT_REPLY: ReplyState = {
  leadId: null, channel: "sms", message: "", subject: "", sending: false, drafting: false,
};

const SCORE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  mid: "bg-yellow-100 text-yellow-800",
  low: "bg-red-100 text-red-800",
};

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Hot", color: SCORE_COLORS.high };
  if (score >= 50) return { label: "Warm", color: SCORE_COLORS.mid };
  return { label: "Cold", color: SCORE_COLORS.low };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isOptedOut(lead: ConquestLead): boolean {
  return !!(lead.metadata as Record<string, unknown>)?.tcpa_optout;
}

export function InboundLeadFeed({ dealershipId }: InboundFeedProps) {
  const [leads, setLeads] = useState<ConquestLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "contacted">("all");
  const [reply, setReply] = useState<ReplyState>(DEFAULT_REPLY);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/leads/list${q}`);
      if (res.ok) {
        const data = await res.json() as { leads: ConquestLead[] };
        setLeads(data.leads ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── AI Draft ──────────────────────────────────────────────────
  async function generateDraft(lead: ConquestLead, channel: "sms" | "email") {
    setReply((r) => ({ ...r, leadId: lead.id, channel, drafting: true, message: "", subject: "" }));
    try {
      const res = await fetch("/api/leads/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conquest_lead_id: lead.id, channel }),
      });
      const data = await res.json() as {
        success?: boolean; error?: string; message?: string;
        draft?: { content: string; subject?: string };
      };
      if (!res.ok || !data.success) {
        showToast("error", data.message ?? data.error ?? "AI draft failed");
        setReply(DEFAULT_REPLY);
        return;
      }
      setReply((r) => ({
        ...r,
        drafting: false,
        message: data.draft?.content ?? "",
        subject: data.draft?.subject ?? "",
      }));
    } catch {
      showToast("error", "Network error — please try again");
      setReply(DEFAULT_REPLY);
    }
  }

  // ── Send ──────────────────────────────────────────────────────
  async function sendReply() {
    if (!reply.leadId || !reply.message.trim()) return;
    setReply((r) => ({ ...r, sending: true }));

    try {
      const res = await fetch("/api/leads/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conquest_lead_id: reply.leadId,
          channel: reply.channel,
          message: reply.message,
          subject: reply.subject || undefined,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string; message?: string };
      if (!res.ok || !data.success) {
        showToast("error", data.message ?? data.error ?? "Failed to send");
      } else {
        showToast("success", `Reply sent via ${reply.channel.toUpperCase()}`);
        setReply(DEFAULT_REPLY);
        fetchLeads();
      }
    } catch {
      showToast("error", "Network error — please try again");
    } finally {
      setReply((r) => ({ ...r, sending: false }));
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${
          toast.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Inbound Leads</h2>
        <div className="flex gap-2 flex-wrap">
          {(["all", "new", "contacted"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                filter === f ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={fetchLeads}
            className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Loading leads…</div>
      ) : leads.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">No leads found</div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {leads.map((lead) => {
            const { label, color } = scoreLabel(lead.score);
            const isExpanded = reply.leadId === lead.id;
            const optedOut = isOptedOut(lead);

            return (
              <div key={lead.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Name + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {lead.first_name} {lead.last_name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
                        {label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        lead.status === "new"
                          ? "bg-blue-100 text-blue-800"
                          : lead.status === "contacted"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-purple-100 text-purple-800"
                      }`}>
                        {lead.status}
                      </span>
                      {optedOut && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 border border-red-200">
                          STOP / opted out
                        </span>
                      )}
                    </div>

                    {/* Contact info */}
                    <div className="mt-1 text-sm text-gray-500 space-y-0.5">
                      {lead.email && <div>✉ {lead.email}</div>}
                      {lead.phone && <div>📞 {lead.phone}</div>}
                      {lead.vehicle_interest && (
                        <div>🚗 Interested in: {lead.vehicle_interest}</div>
                      )}
                      <div className="text-xs text-gray-400">
                        Source: <span className="font-medium">{lead.source}</span> · {timeAgo(lead.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {!optedOut && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {/* AI Draft button */}
                      <button
                        onClick={() => {
                          const ch = lead.phone ? "sms" : "email";
                          if (isExpanded && reply.channel === ch) {
                            setReply(DEFAULT_REPLY);
                          } else {
                            generateDraft(lead, ch);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                      >
                        <span>✨</span> AI Reply
                      </button>

                      {/* Manual reply toggle */}
                      <button
                        onClick={() => {
                          if (isExpanded) {
                            setReply(DEFAULT_REPLY);
                          } else {
                            setReply({
                              ...DEFAULT_REPLY,
                              leadId: lead.id,
                              channel: lead.phone ? "sms" : "email",
                            });
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        ✏ Manual
                      </button>
                    </div>
                  )}

                  {optedOut && (
                    <div className="shrink-0 text-xs text-red-500 font-medium pt-1">
                      Cannot contact
                    </div>
                  )}
                </div>

                {/* Inline reply / draft panel */}
                {isExpanded && !optedOut && (
                  <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4 space-y-3">
                    {/* Drafting state */}
                    {reply.drafting && (
                      <div className="flex items-center gap-2 text-sm text-indigo-700">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        AI is drafting a personalized reply…
                      </div>
                    )}

                    {/* Channel selector */}
                    {!reply.drafting && (
                      <div className="flex gap-2">
                        {(["sms", "email"] as const).map((ch) => (
                          <button
                            key={ch}
                            disabled={ch === "sms" && !lead.phone || ch === "email" && !lead.email}
                            onClick={() => setReply((r) => ({ ...r, channel: ch }))}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              reply.channel === ch
                                ? "bg-indigo-600 text-white"
                                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {ch === "sms" ? "📱 SMS" : "✉ Email"}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Email subject */}
                    {!reply.drafting && reply.channel === "email" && (
                      <input
                        type="text"
                        placeholder="Subject line"
                        value={reply.subject}
                        onChange={(e) => setReply((r) => ({ ...r, subject: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    )}

                    {/* Message textarea */}
                    {!reply.drafting && (
                      <>
                        <textarea
                          rows={4}
                          placeholder={`Write your ${reply.channel === "sms" ? "text message" : "email"} to ${lead.first_name ?? "the lead"}…`}
                          value={reply.message}
                          onChange={(e) => setReply((r) => ({ ...r, message: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                        />
                        {reply.channel === "sms" && reply.message.length > 0 && (
                          <p className={`text-xs ${reply.message.length > 160 ? "text-red-500" : "text-gray-400"}`}>
                            {reply.message.length}/160 characters
                          </p>
                        )}
                      </>
                    )}

                    {/* Actions */}
                    {!reply.drafting && (
                      <div className="flex justify-between items-center gap-2">
                        <button
                          onClick={() => generateDraft(lead, reply.channel)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          ↻ Regenerate AI draft
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setReply(DEFAULT_REPLY)}
                            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={sendReply}
                            disabled={reply.sending || !reply.message.trim()}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {reply.sending ? "Sending…" : `Send ${reply.channel.toUpperCase()}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
