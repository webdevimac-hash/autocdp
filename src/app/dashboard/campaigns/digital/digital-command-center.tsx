"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Brain, TrendingUp, BarChart2, Play, RefreshCw, CheckCircle2,
  AlertCircle, Clock, DollarSign, MousePointerClick, Eye,
  Sparkles, ChevronDown, ChevronUp, Target, Zap, BookOpen,
  Megaphone, Star, ArrowUpRight, Check, X, CircleDot,
} from "lucide-react";
import type { AdsPerfSummary } from "@/lib/ads/ads-sync";

// ── Types ─────────────────────────────────────────────────────

interface Playbook {
  id:         string;
  version:    number;
  content:    Record<string, unknown>;
  updated_at: string;
}

interface PendingApproval {
  id:                    string;
  approval_type:         string;
  title:                 string;
  description:           string;
  recommended_spend_usd: number;
  predicted_roi:         string | null;
  status:                string;
  expires_at:            string;
  created_at:            string;
  agent_reasoning:       string | null;
}

interface DmCampaign {
  id:              string;
  platform:        string;
  name:            string;
  objective:       string;
  status:          string;
  budget_daily_usd: number | null;
  agent_rationale: string | null;
  created_at:      string;
}

interface Pattern {
  id:           string;
  pattern_type: string;
  title:        string;
  description:  string;
  confidence:   number;
  platforms:    string[];
  applied_count: number;
  win_rate:     number | null;
  created_at:   string;
}

interface AgentRun {
  id:             string;
  status:         string;
  input_summary:  string;
  output_summary: string | null;
  created_at:     string;
  duration_ms:    number | null;
}

interface Connection {
  provider:     string;
  status:       string;
  last_sync_at: string | null;
}

interface Props {
  dealershipId:     string;
  dealershipName:   string;
  playbook:         Playbook | null;
  pendingApprovals: PendingApproval[];
  campaigns:        DmCampaign[];
  patterns:         Pattern[];
  recentRuns:       AgentRun[];
  perfSummary:      AdsPerfSummary[];
  connections:      Connection[];
}

// ── Helpers ───────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  meta_ads:   "Meta Ads",
  tiktok_ads: "TikTok Ads",
};

const PLATFORM_COLORS: Record<string, string> = {
  google_ads: "bg-blue-100 text-blue-700",
  meta_ads:   "bg-indigo-100 text-indigo-700",
  tiktok_ads: "bg-pink-100 text-pink-700",
};

const PATTERN_TYPE_COLORS: Record<string, string> = {
  creative:    "bg-purple-100 text-purple-700",
  audience:    "bg-blue-100 text-blue-700",
  timing:      "bg-amber-100 text-amber-700",
  offer:       "bg-green-100 text-green-700",
  bidding:     "bg-orange-100 text-orange-700",
  channel_mix: "bg-cyan-100 text-cyan-700",
  funnel:      "bg-rose-100 text-rose-700",
  seasonal:    "bg-teal-100 text-teal-700",
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${accent}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium opacity-70">{icon}{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-[10px] opacity-60">{sub}</div>}
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PLATFORM_COLORS[platform] ?? "bg-gray-100 text-gray-600"}`}>
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}

function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: PendingApproval;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold text-gray-900 text-sm">{approval.title}</span>
            {approval.recommended_spend_usd && (
              <span className="text-[11px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                ${approval.recommended_spend_usd}/day
              </span>
            )}
            {approval.predicted_roi && (
              <span className="text-[11px] bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                Est. ROI: {approval.predicted_roi}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{approval.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setLoading("approve"); onApprove(approval.id).finally(() => setLoading(null)); }}
            disabled={!!loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading === "approve" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Approve
          </button>
          <button
            onClick={() => { setLoading("reject"); onReject(approval.id).finally(() => setLoading(null)); }}
            disabled={!!loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {loading === "reject" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            Reject
          </button>
        </div>
      </div>

      {approval.agent_reasoning && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-[11px] text-amber-700 font-medium"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide" : "Show"} agent reasoning
        </button>
      )}
      {expanded && approval.agent_reasoning && (
        <div className="text-xs text-gray-600 bg-white border border-amber-100 rounded-lg p-3 leading-relaxed">
          {approval.agent_reasoning}
        </div>
      )}

      <div className="text-[10px] text-amber-600">
        Expires {fmtRelative(approval.expires_at)} · Requested {fmtRelative(approval.created_at)}
      </div>
    </div>
  );
}

function PlaybookSection({ playbook }: { playbook: Playbook | null }) {
  const [open, setOpen] = useState(false);

  if (!playbook) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center space-y-2">
        <BookOpen className="w-8 h-8 text-gray-300 mx-auto" />
        <p className="text-sm text-gray-500 font-medium">No playbook yet</p>
        <p className="text-xs text-gray-400">Run the Digital Marketing Agent to generate your first strategic playbook. It learns from every campaign cycle.</p>
      </div>
    );
  }

  const c = playbook.content;
  const ba = c.budget_allocation as Record<string, number> | undefined;
  const principles = c.creative_principles as Array<{ principle: string; evidence_count: number }> | undefined;
  const offers = c.offer_library as Array<{ offer_text: string; conversions: number; channels: string[] }> | undefined;
  const audiences = c.top_audiences as Array<{ name: string; priority: string; description: string }> | undefined;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-brand-600" />
          <div className="text-left">
            <div className="font-semibold text-gray-900 text-sm">Digital Marketing Playbook</div>
            <div className="text-[11px] text-gray-400">v{playbook.version} · Updated {fmtRelative(playbook.updated_at)}</div>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 p-5 space-y-5">
          {!!c.executive_summary && (
            <div className="bg-brand-50 border border-brand-100 rounded-lg p-3.5 text-sm text-brand-900 leading-relaxed">
              {String(c.executive_summary)}
            </div>
          )}

          {ba && (
            <div>
              <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Budget Allocation</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ba).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-500">{PLATFORM_LABELS[k] ?? k}</span>
                    <span className="text-sm font-bold text-gray-900">{v}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {audiences?.length ? (
            <div>
              <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Top Audiences</h4>
              <div className="space-y-2">
                {audiences.slice(0, 4).map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${a.priority === "high" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                      {a.priority}
                    </span>
                    <div>
                      <span className="font-medium text-gray-900">{a.name}</span>
                      <span className="text-gray-500 ml-1">— {a.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {principles?.length ? (
            <div>
              <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Creative Principles</h4>
              <ul className="space-y-1.5">
                {principles.slice(0, 5).map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Star className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-gray-700">{p.principle}
                      {p.evidence_count > 0 && (
                        <span className="text-[10px] text-gray-400 ml-1">({p.evidence_count} data pts)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {offers?.length ? (
            <div>
              <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Proven Offer Library</h4>
              <div className="space-y-2">
                {offers.slice(0, 4).map((o, i) => (
                  <div key={i} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800 font-medium">"{o.offer_text}"</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {o.channels?.map((ch) => <PlatformBadge key={ch} platform={ch} />)}
                      <span className="text-[11px] text-green-700 font-medium">{o.conversions} conv</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export function DigitalCommandCenter({
  dealershipId,
  dealershipName,
  playbook,
  pendingApprovals,
  campaigns,
  patterns,
  recentRuns,
  perfSummary,
  connections,
}: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [approvals, setApprovals] = useState(pendingApprovals);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function runAgent(mode: "analyze" | "full_cycle") {
    setAgentRunning(true);
    try {
      const res = await fetch("/api/agents/digital-marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, allowExecute: false }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; executiveBrief?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Agent run failed");
      setToast({ type: "success", message: "Digital Marketing Agent completed! Refreshing…" });
      setTimeout(() => router.refresh(), 1500);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Agent failed" });
    } finally {
      setAgentRunning(false);
    }
  }

  async function handleApprove(id: string) {
    const res = await fetch("/api/dm/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "approve" }),
    });
    if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error ?? "Failed"); }
    setApprovals((a) => a.filter((x) => x.id !== id));
    setToast({ type: "success", message: "Approved! Agent is executing the campaign…" });
  }

  async function handleReject(id: string) {
    const res = await fetch("/api/dm/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "reject" }),
    });
    if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error ?? "Failed"); }
    setApprovals((a) => a.filter((x) => x.id !== id));
    setToast({ type: "success", message: "Recommendation rejected." });
  }

  const connectedPlatforms = connections.filter((c) => c.status === "active").map((c) => c.provider);
  const hasAnyPlatform = connectedPlatforms.length > 0;

  // Aggregate 7-day totals across all platforms
  const totalSpend  = perfSummary.reduce((s, p) => s + p.last7Days.spendUsd, 0);
  const totalImpr   = perfSummary.reduce((s, p) => s + p.last7Days.impressions, 0);
  const totalClicks = perfSummary.reduce((s, p) => s + p.last7Days.clicks, 0);
  const avgRoas     = perfSummary.filter((p) => p.last7Days.roas != null).length > 0
    ? perfSummary.reduce((s, p) => s + (p.last7Days.roas ?? 0), 0) / perfSummary.filter((p) => p.last7Days.roas != null).length
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-brand-600" />
            Digital Marketing
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            AI-powered paid media strategy for {dealershipName} — Google Ads, Meta Ads, TikTok
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => runAgent("analyze")}
            disabled={agentRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <BarChart2 className={`w-4 h-4 ${agentRunning ? "animate-pulse" : ""}`} />
            Analyze
          </button>
          <button
            onClick={() => runAgent("full_cycle")}
            disabled={agentRunning || !hasAnyPlatform}
            title={!hasAnyPlatform ? "Connect a platform first" : undefined}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {agentRunning
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running…</>
              : <><Sparkles className="w-4 h-4" /> Run Agent</>
            }
          </button>
        </div>
      </div>

      {/* No platforms banner */}
      {!hasAnyPlatform && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">No ad platforms connected</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Connect Google Ads, Meta Ads, or TikTok Ads in{" "}
              <a href="/dashboard/integrations" className="underline font-medium">Integrations</a>{" "}
              to unlock full paid digital management.
            </p>
          </div>
        </div>
      )}

      {/* Performance KPIs */}
      {perfSummary.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Last 7 Days — All Platforms</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<DollarSign className="w-3 h-3" />} label="Total Spend"
              value={`$${totalSpend.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              accent="bg-blue-50 border-blue-100 text-blue-900" />
            <StatCard icon={<Eye className="w-3 h-3" />} label="Impressions"
              value={fmtNum(totalImpr)}
              accent="bg-indigo-50 border-indigo-100 text-indigo-900" />
            <StatCard icon={<MousePointerClick className="w-3 h-3" />} label="Clicks"
              value={fmtNum(totalClicks)}
              sub={totalImpr > 0 ? `${((totalClicks / totalImpr) * 100).toFixed(2)}% CTR` : undefined}
              accent="bg-purple-50 border-purple-100 text-purple-900" />
            <StatCard icon={<TrendingUp className="w-3 h-3" />} label="Avg ROAS"
              value={avgRoas != null ? `${avgRoas.toFixed(2)}×` : "N/A"}
              accent="bg-green-50 border-green-100 text-green-900" />
          </div>

          {/* Per-platform breakdown */}
          <div className="mt-3 space-y-2">
            {perfSummary.map((p) => (
              <div key={p.platform} className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3">
                <PlatformBadge platform={p.platform} />
                <div className="flex-1 flex flex-wrap gap-4 text-[12px]">
                  <span className="text-gray-500">Spend: <strong className="text-gray-900">${p.last7Days.spendUsd.toFixed(0)}</strong></span>
                  <span className="text-gray-500">Impr: <strong className="text-gray-900">{fmtNum(p.last7Days.impressions)}</strong></span>
                  <span className="text-gray-500">CTR: <strong className="text-gray-900">{p.last7Days.impressions > 0 ? ((p.last7Days.clicks / p.last7Days.impressions) * 100).toFixed(2) : 0}%</strong></span>
                  {p.last7Days.roas != null && (
                    <span className="text-gray-500">ROAS: <strong className="text-gray-900">{p.last7Days.roas.toFixed(2)}×</strong></span>
                  )}
                  {p.lastSyncedAt && (
                    <span className="text-gray-400">Synced {fmtRelative(p.lastSyncedAt)}</span>
                  )}
                </div>
                <a href="/dashboard/integrations" className="shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      {approvals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Pending Spend Approvals ({approvals.length})
          </h2>
          <div className="space-y-3">
            {approvals.map((a) => (
              <ApprovalCard key={a.id} approval={a} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        </div>
      )}

      {/* Playbook */}
      <PlaybookSection playbook={playbook} />

      {/* Campaigns */}
      {campaigns.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> AI-Managed Campaigns ({campaigns.length})
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Platform</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Objective</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Budget</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.slice(0, 10).map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-[200px]">{c.name}</div>
                      {c.agent_rationale && (
                        <div className="text-[10px] text-gray-400 truncate max-w-[200px] mt-0.5">{c.agent_rationale.slice(0, 80)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3"><PlatformBadge platform={c.platform} /></td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{c.objective}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.budget_daily_usd ? `$${c.budget_daily_usd}/day` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        c.status === "active" ? "bg-green-100 text-green-700" :
                        c.status === "pending_approval" ? "bg-amber-100 text-amber-700" :
                        c.status === "paused" ? "bg-gray-100 text-gray-600" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {c.status === "active" && <CircleDot className="w-2.5 h-2.5" />}
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Learning Patterns */}
      {patterns.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" /> Learning Patterns ({patterns.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {patterns.map((p) => (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PATTERN_TYPE_COLORS[p.pattern_type] ?? "bg-gray-100 text-gray-600"}`}>
                    {p.pattern_type}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${Math.round(p.confidence * 100)}%` }}
                      />
                    </div>
                    {Math.round(p.confidence * 100)}%
                  </div>
                </div>
                <div className="font-semibold text-gray-900 text-sm leading-snug">{p.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{p.description}</div>
                <div className="flex flex-wrap gap-1.5">
                  {p.platforms.map((pl) => <PlatformBadge key={pl} platform={pl} />)}
                  {p.applied_count > 0 && (
                    <span className="text-[10px] text-gray-400">Applied {p.applied_count}×</span>
                  )}
                  {p.win_rate != null && (
                    <span className="text-[10px] text-green-600 font-medium">{Math.round(p.win_rate * 100)}% win rate</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Agent Runs */}
      {recentRuns.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Recent Agent Runs
          </h2>
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  run.status === "completed" ? "bg-green-500" :
                  run.status === "failed" ? "bg-red-500" : "bg-amber-500 animate-pulse"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{run.input_summary}</div>
                  {run.output_summary && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{run.output_summary}</div>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 shrink-0">
                  {fmtRelative(run.created_at)}
                  {run.duration_ms && (
                    <span className="ml-1 text-gray-300">· {(run.duration_ms / 1000).toFixed(0)}s</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!agentRunning && !perfSummary.length && !patterns.length && campaigns.length === 0 && (
        <div className="text-center py-16 space-y-4">
          <Brain className="w-12 h-12 text-gray-200 mx-auto" />
          <div>
            <p className="text-gray-900 font-semibold">Ready to transform your digital marketing</p>
            <p className="text-gray-400 text-sm mt-1 max-w-md mx-auto">
              Click "Run Agent" to start your first analysis cycle. The AI will review your inventory,
              CRM data, and performance history to build a strategic playbook and recommend campaigns.
            </p>
          </div>
          <button
            onClick={() => runAgent("analyze")}
            disabled={agentRunning}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Start First Analysis
          </button>
        </div>
      )}
    </div>
  );
}
