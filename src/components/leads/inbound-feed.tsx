"use client";

import { useState, useEffect, useCallback } from "react";
import type { ConquestLead } from "@/types";

interface InboundFeedProps {
  dealershipId: string;
}

interface ReplyState {
  leadId: string | null;
  channel: "sms" | "email";
  message: string;
  subject: string;
  sending: boolean;
}

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
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function InboundLeadFeed({ dealershipId }: InboundFeedProps) {
  const [leads, setLeads] = useState<ConquestLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "contacted">("all");
  const [reply, setReply] = useState<ReplyState>({
    leadId: null,
    channel: "sms",
    message: "",
    subject: "",
    sending: false,
  });
  const [replySuccess, setReplySuccess] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/list?status=${filter === "all" ? "" : filter}`);
      if (res.ok) {
        const data = await res.json() as { leads: ConquestLead[] };
        setLeads(data.leads ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  async function sendReply() {
    if (!reply.leadId || !reply.message.trim()) return;
    setReply((r) => ({ ...r, sending: true }));
    setReplyError(null);

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

      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setReplyError(data.error ?? "Failed to send");
      } else {
        setReplySuccess(`Reply sent via ${reply.channel}`);
        setReply({ leadId: null, channel: "sms", message: "", subject: "", sending: false });
        fetchLeads();
        setTimeout(() => setReplySuccess(null), 4000);
      }
    } catch {
      setReplyError("Network error — please try again");
    } finally {
      setReply((r) => ({ ...r, sending: false }));
    }
  }

  const activeLead = reply.leadId ? leads.find((l) => l.id === reply.leadId) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Inbound Leads</h2>
        <div className="flex gap-2">
          {(["all", "new", "contacted"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={fetchLeads}
            className="ml-2 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Success / error banners */}
      {replySuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {replySuccess}
        </div>
      )}

      {/* Lead list */}
      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Loading leads…</div>
      ) : leads.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">No leads found</div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {leads.map((lead) => {
            const { label, color } = scoreLabel(lead.score);
            const isExpanded = reply.leadId === lead.id;
            return (
              <div key={lead.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
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
                    </div>
                    <div className="mt-1 text-sm text-gray-500 space-y-0.5">
                      {lead.email && <div>✉ {lead.email}</div>}
                      {lead.phone && <div>📞 {lead.phone}</div>}
                      {lead.vehicle_interest && (
                        <div>🚗 Interested in: {lead.vehicle_interest}</div>
                      )}
                      <div className="text-xs text-gray-400">
                        Source: {lead.source} · {timeAgo(lead.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Reply button */}
                  <button
                    onClick={() =>
                      setReply((r) => ({
                        ...r,
                        leadId: r.leadId === lead.id ? null : lead.id,
                        channel: lead.phone ? "sms" : "email",
                        message: "",
                        subject: "",
                      }))
                    }
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isExpanded
                        ? "bg-gray-200 text-gray-700"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    {isExpanded ? "Cancel" : "Reply"}
                  </button>
                </div>

                {/* Inline reply panel */}
                {isExpanded && (
                  <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4 space-y-3">
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

                    {reply.channel === "email" && (
                      <input
                        type="text"
                        placeholder="Subject line"
                        value={reply.subject}
                        onChange={(e) => setReply((r) => ({ ...r, subject: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    )}

                    <textarea
                      rows={4}
                      placeholder={`Write your ${reply.channel === "sms" ? "text message" : "email"} to ${lead.first_name}…`}
                      value={reply.message}
                      onChange={(e) => setReply((r) => ({ ...r, message: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />

                    {replyError && (
                      <p className="text-sm text-red-600">{replyError}</p>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setReply((r) => ({ ...r, leadId: null, message: "", subject: "" }))}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
