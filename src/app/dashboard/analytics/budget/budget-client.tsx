"use client";

/**
 * BudgetClient — AI Budget Allocator dashboard
 *
 * Tabs:
 *   1. Overview   — current allocation, channel split bars, AI narrative
 *   2. History    — table of past allocations with attribution accuracy
 *   3. Rules      — edit budget constraints, channel limits, auto-push toggle
 *   4. Reasoning  — full swarm reasoning trail (Data Agent → Allocator → Orchestrator)
 */

import { useState, useTransition } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, TrendingUp, TrendingDown, Zap, Settings,
  Play, RefreshCw, AlertCircle, CheckCircle2, Clock,
  BarChart3, Brain, ChevronDown, ChevronUp, Shield,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignAllocation {
  channel:        string;
  campaignId:     string;
  campaignName:   string;
  adGroupId:      string;
  currentUsd:     number;
  recommendedUsd: number;
  predictedRoas:  number | null;
  confidence:     number;
  changeReason:   string;
  pushed:         boolean;
  pushError:      string | null;
}

interface AllocationRecord {
  id:               string;
  allocation_date:  string;
  total_budget_usd: number;
  allocations:      CampaignAllocation[];
  swarm_reasoning:  {
    dataAgentSummary:  string;
    channelDecisions:  string;
    orchestratorNotes: string;
    riskFlags:         string[];
  };
  summary:           string | null;
  status:            string;
  pushed_at:         string | null;
  push_errors:       string[];
  actual_spend_usd:  number | null;
  actual_roas:       number | null;
  prediction_error_pct: number | null;
  created_at:        string;
}

interface ChannelSummary {
  channel:     string;
  spend30d:    number;
  roas:        number | null;
  impressions: number;
  dailyAvg:    number;
}

interface Props {
  dealershipId:     string;
  dealershipName:   string;
  allocations:      Array<Record<string, unknown>>;
  rules:            Record<string, unknown> | null;
  channelSummary:   ChannelSummary[];
  connections:      Array<{ provider: string; status: string; last_sync_at: string | null }>;
  latestAllocation: Record<string, unknown> | null;
  userEmail:        string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHANNEL_LABEL: Record<string, string> = {
  google_ads: "Google Ads",
  meta_ads:   "Meta Ads",
  tiktok_ads: "TikTok Ads",
};

const CHANNEL_COLOR: Record<string, string> = {
  google_ads: "bg-blue-500",
  meta_ads:   "bg-indigo-500",
  tiktok_ads: "bg-pink-500",
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending:   { icon: <Clock className="w-3.5 h-3.5" />,    color: "text-slate-500",   label: "Pending"   },
  computing: { icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, color: "text-amber-500", label: "Computing" },
  ready:     { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-blue-500", label: "Ready"    },
  pushing:   { icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, color: "text-blue-500",  label: "Pushing"   },
  applied:   { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-500", label: "Applied" },
  failed:    { icon: <AlertCircle className="w-3.5 h-3.5" />,  color: "text-red-500",    label: "Failed"    },
};

function BudgetBar({ current, recommended, max }: { current: number; recommended: number; max: number }) {
  const currPct = Math.min(100, (current / max) * 100);
  const recPct  = Math.min(100, (recommended / max) * 100);
  const isUp    = recommended > current;
  const isDown  = recommended < current;

  return (
    <div className="space-y-1">
      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="absolute h-full bg-slate-300 rounded-full" style={{ width: `${currPct}%` }} />
        <div
          className={`absolute h-full rounded-full transition-all ${isUp ? "bg-emerald-500" : isDown ? "bg-amber-500" : "bg-blue-500"}`}
          style={{ width: `${recPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Current: ${current.toFixed(0)}/day</span>
        <span className={isUp ? "text-emerald-600 font-medium" : isDown ? "text-amber-600 font-medium" : ""}>
          {isUp ? "▲" : isDown ? "▼" : "="} ${recommended.toFixed(0)}/day
        </span>
      </div>
    </div>
  );
}

function RoasBadge({ roas }: { roas: number | null }) {
  if (!roas) return <span className="text-muted-foreground text-xs">—</span>;
  const color = roas >= 4 ? "text-emerald-600 bg-emerald-50" : roas >= 2 ? "text-blue-600 bg-blue-50" : "text-amber-600 bg-amber-50";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{roas.toFixed(2)}× ROAS</span>;
}

// ---------------------------------------------------------------------------
// Tab: Overview
// ---------------------------------------------------------------------------

function OverviewTab({
  latest,
  channelSummary,
  connections,
  dealershipId,
  onRunAllocator,
}: {
  latest:         AllocationRecord | null;
  channelSummary: ChannelSummary[];
  connections:    Props["connections"];
  dealershipId:   string;
  onRunAllocator: (budget: number) => Promise<void>;
}) {
  const [budget, setBudget] = useState("500");
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  const activeConnections = connections.filter((c) => c.status === "active");

  async function handleRun() {
    const b = parseFloat(budget);
    if (isNaN(b) || b <= 0) return;
    setRunning(true);
    try {
      await onRunAllocator(b);
      startTransition(() => window.location.reload());
    } finally {
      setRunning(false);
    }
  }

  const totalSpend30d = channelSummary.reduce((s, c) => s + c.spend30d, 0);
  const totalDailyAvg = channelSummary.reduce((s, c) => s + c.dailyAvg, 0);

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "30d Ad Spend",    value: `$${totalSpend30d.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: "text-blue-600 bg-blue-50" },
          { label: "Daily Avg Spend", value: `$${totalDailyAvg.toFixed(0)}`, icon: BarChart3, color: "text-purple-600 bg-purple-50" },
          { label: "Channels Active", value: activeConnections.length,        icon: Zap,       color: "text-emerald-600 bg-emerald-50" },
          { label: "Allocations Run", value: latest ? "Yes" : "None",         icon: Brain,     color: "text-amber-600 bg-amber-50" },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Run allocator */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              Run AI Budget Allocator
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              The 3-agent swarm (Data → Allocator → Orchestrator) analyzes your ad performance and
              computes the optimal daily budget split across channels.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeConnections.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Connect at least one ad platform in Integrations before running.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Total daily budget ($)</span>
                  <Input
                    type="number"
                    min={10}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-28 h-8 text-sm"
                    placeholder="500"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeConnections.map((c) => (
                    <span key={c.provider} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {CHANNEL_LABEL[c.provider] ?? c.provider}
                    </span>
                  ))}
                </div>
                <Button onClick={handleRun} disabled={running} className="gap-2">
                  {running
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <Play className="w-4 h-4" />}
                  {running ? "Swarm computing…" : "Run Allocation"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Takes ~30s. Budget changes are only pushed to ad platforms if auto-push is enabled in Rules.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Current channel split */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">30-Day Channel Spend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {channelSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ad performance data in the last 30 days.</p>
            ) : (
              channelSummary.map((ch) => {
                const pct = totalSpend30d > 0 ? (ch.spend30d / totalSpend30d) * 100 : 0;
                return (
                  <div key={ch.channel} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{CHANNEL_LABEL[ch.channel] ?? ch.channel}</span>
                      <div className="flex items-center gap-2">
                        <RoasBadge roas={ch.roas} />
                        <span className="text-xs text-muted-foreground">${ch.spend30d.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${CHANNEL_COLOR[ch.channel] ?? "bg-slate-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{pct.toFixed(1)}% of total · ${ch.dailyAvg.toFixed(0)}/day avg</p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Latest allocation narrative */}
      {latest && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                Latest Allocation — {latest.allocation_date}
              </CardTitle>
              <div className={`flex items-center gap-1 text-xs ${STATUS_CONFIG[latest.status]?.color}`}>
                {STATUS_CONFIG[latest.status]?.icon}
                {STATUS_CONFIG[latest.status]?.label}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {latest.summary && (
              <p className="text-sm leading-relaxed text-gray-700 bg-slate-50 p-3 rounded-lg border-l-2 border-purple-300">
                {latest.summary}
              </p>
            )}

            {/* Campaign allocations table */}
            {latest.allocations?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {["Channel", "Campaign", "Current", "Recommended", "Pred. ROAS", "Confidence", "Status"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {latest.allocations.map((a, i) => {
                      const delta = a.recommendedUsd - a.currentUsd;
                      return (
                        <tr key={i} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full text-white ${CHANNEL_COLOR[a.channel] ?? "bg-slate-500"}`}>
                              {CHANNEL_LABEL[a.channel]?.split(" ")[0] ?? a.channel}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs max-w-[160px] truncate">{a.campaignName}</td>
                          <td className="px-3 py-2.5 text-xs">${a.currentUsd.toFixed(0)}</td>
                          <td className="px-3 py-2.5 text-xs">
                            <span className={delta > 0 ? "text-emerald-600 font-medium" : delta < 0 ? "text-amber-600 font-medium" : ""}>
                              {delta > 0 ? "▲ " : delta < 0 ? "▼ " : ""}${a.recommendedUsd.toFixed(0)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5"><RoasBadge roas={a.predictedRoas} /></td>
                          <td className="px-3 py-2.5 text-xs">{(a.confidence * 100).toFixed(0)}%</td>
                          <td className="px-3 py-2.5">
                            {a.pushError
                              ? <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Error</span>
                              : a.pushed
                              ? <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Pushed</span>
                              : <span className="text-xs text-muted-foreground">Recommended</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Risk flags */}
            {latest.swarm_reasoning?.riskFlags?.length > 0 && (
              <div className="space-y-1">
                {latest.swarm_reasoning.riskFlags.map((flag, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {flag}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: History
// ---------------------------------------------------------------------------

function HistoryTab({ allocations }: { allocations: AllocationRecord[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (allocations.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No allocations yet. Run the AI Allocator from the Overview tab.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allocations.map((alloc) => {
        const isExpanded = expanded === alloc.id;
        const pushedCount = alloc.allocations?.filter((a) => a.pushed).length ?? 0;
        const errorCount  = alloc.allocations?.filter((a) => a.pushError).length ?? 0;

        return (
          <Card key={alloc.id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <button
                onClick={() => setExpanded(isExpanded ? null : alloc.id)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{alloc.allocation_date}</span>
                      <div className={`flex items-center gap-1 text-xs ${STATUS_CONFIG[alloc.status]?.color}`}>
                        {STATUS_CONFIG[alloc.status]?.icon}
                        {STATUS_CONFIG[alloc.status]?.label}
                      </div>
                      {alloc.actual_roas && alloc.prediction_error_pct != null && (
                        <Badge variant="outline" className={`text-[10px] ${Math.abs(alloc.prediction_error_pct) < 15 ? "text-emerald-600" : "text-amber-600"}`}>
                          {alloc.prediction_error_pct > 0 ? "+" : ""}{alloc.prediction_error_pct.toFixed(1)}% pred error
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ${alloc.total_budget_usd.toFixed(0)} budget ·{" "}
                      {pushedCount} pushed · {alloc.allocations?.length ?? 0} total campaigns
                      {errorCount > 0 && ` · ${errorCount} errors`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    {alloc.actual_roas && (
                      <RoasBadge roas={alloc.actual_roas} />
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  {alloc.summary && (
                    <p className="text-xs text-gray-600 leading-relaxed bg-slate-50 p-2.5 rounded">
                      {alloc.summary}
                    </p>
                  )}
                  {alloc.allocations?.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                      <span className="font-medium truncate max-w-[200px]">{a.campaignName}</span>
                      <span className="text-muted-foreground">${a.currentUsd.toFixed(0)} → <strong>${a.recommendedUsd.toFixed(0)}</strong></span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Rules
// ---------------------------------------------------------------------------

function RulesTab({
  rules,
  onSave,
}: {
  rules: Record<string, unknown> | null;
  onSave: (rules: Record<string, unknown>) => Promise<void>;
}) {
  const def = rules ?? {};
  const [monthlyCap,   setMonthlyCap]   = useState(String(def.monthly_cap_usd ?? ""));
  const [minChangePct, setMinChangePct] = useState(String(def.min_change_pct ?? "10"));
  const [autoPush,     setAutoPush]     = useState(Boolean(def.auto_push));
  const [lookback,     setLookback]     = useState(String(def.lookback_days ?? "14"));
  const [minImpressions, setMinImpressions] = useState(String(def.min_impressions_threshold ?? "500"));

  const channelLimits = (def.channel_limits as Record<string, { min: number; max: number }>) ?? {
    google_ads: { min: 20, max: 1000 },
    meta_ads:   { min: 10, max: 500 },
    tiktok_ads: { min: 10, max: 300 },
  };
  const [limits, setLimits] = useState(channelLimits);

  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        monthly_cap_usd:          monthlyCap ? parseFloat(monthlyCap) : null,
        min_change_pct:           parseFloat(minChangePct) || 10,
        auto_push:                autoPush,
        lookback_days:            parseInt(lookback) || 14,
        min_impressions_threshold: parseInt(minImpressions) || 500,
        channel_limits:           limits,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />
            Budget Constraints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-medium">Monthly Cap (USD, optional)</span>
              <Input
                type="number"
                value={monthlyCap}
                onChange={(e) => setMonthlyCap(e.target.value)}
                placeholder="e.g. 15000"
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">Hard ceiling — allocator will not exceed this / 30 per day</p>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium">Minimum Change % Before Push</span>
              <Input
                type="number"
                value={minChangePct}
                onChange={(e) => setMinChangePct(e.target.value)}
                placeholder="10"
                min={1}
                max={50}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">Skip API call if budget delta is below this threshold</p>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium">Lookback Window (days)</span>
              <Input
                type="number"
                value={lookback}
                onChange={(e) => setLookback(e.target.value)}
                placeholder="14"
                min={7}
                max={90}
                className="text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium">Min Impressions to Act</span>
              <Input
                type="number"
                value={minImpressions}
                onChange={(e) => setMinImpressions(e.target.value)}
                placeholder="500"
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">Hold budget if a campaign has fewer impressions in the window</p>
            </label>
          </div>

          {/* Auto-push toggle */}
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={autoPush}
              onChange={(e) => setAutoPush(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <p className="text-sm font-medium">Auto-push budget changes to ad platforms</p>
              <p className="text-xs text-muted-foreground">
                When off, the allocator writes recommendations but does NOT call Google/Meta/TikTok APIs.
                You review first, then push manually.
              </p>
            </div>
          </label>

          {autoPush && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Auto-push is active. The daily cron will update live ad budgets automatically at 6AM UTC.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel limits */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Per-Channel Daily Limits</CardTitle>
          <p className="text-xs text-muted-foreground">The allocator will always stay within min/max for each channel.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(["google_ads", "meta_ads", "tiktok_ads"] as const).map((ch) => (
              <div key={ch} className="grid grid-cols-3 gap-3 items-center">
                <span className="text-sm font-medium">{CHANNEL_LABEL[ch]}</span>
                <label className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase">Min $/day</span>
                  <Input
                    type="number"
                    value={limits[ch]?.min ?? 0}
                    onChange={(e) => setLimits((prev) => ({
                      ...prev,
                      [ch]: { ...prev[ch], min: parseFloat(e.target.value) || 0 },
                    }))}
                    className="text-sm"
                    min={0}
                  />
                </label>
                <label className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase">Max $/day</span>
                  <Input
                    type="number"
                    value={limits[ch]?.max ?? 0}
                    onChange={(e) => setLimits((prev) => ({
                      ...prev,
                      [ch]: { ...prev[ch], max: parseFloat(e.target.value) || 0 },
                    }))}
                    className="text-sm"
                    min={0}
                  />
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
        {saving ? "Saving…" : "Save Rules"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Reasoning
// ---------------------------------------------------------------------------

function ReasoningTab({ allocation }: { allocation: AllocationRecord | null }) {
  if (!allocation) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Run the allocator to see the swarm's reasoning trail.
      </div>
    );
  }

  const r = allocation.swarm_reasoning ?? {};

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Allocation from {allocation.allocation_date} · {allocation.allocations?.length ?? 0} campaigns
      </p>

      {[
        {
          title: "Phase 1 — Data Agent (Haiku)",
          subtitle: "Analyzes raw performance, computes ROAS/CPA momentum and confidence intervals",
          content: r.dataAgentSummary,
          color:   "border-blue-300 bg-blue-50/40",
        },
        {
          title: "Phase 2 — Allocation Agent (Sonnet)",
          subtitle: "Decides optimal budget split per channel and campaign given constraints",
          content: r.channelDecisions,
          color:   "border-purple-300 bg-purple-50/40",
        },
        {
          title: "Phase 3 — Orchestrator (Opus)",
          subtitle: "Reviews for risk, applies guardrails, writes final approved allocation",
          content: r.orchestratorNotes,
          color:   "border-amber-300 bg-amber-50/40",
        },
      ].map((phase) => (
        <Card key={phase.title} className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{phase.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{phase.subtitle}</p>
          </CardHeader>
          <CardContent>
            <div className={`text-xs leading-relaxed p-3 rounded-lg border-l-2 ${phase.color} whitespace-pre-wrap font-mono`}>
              {phase.content || "—"}
            </div>
          </CardContent>
        </Card>
      ))}

      {r.riskFlags?.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Risk Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {r.riskFlags.map((flag: string, i: number) => (
              <div key={i} className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded border border-amber-100">
                {flag}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type Tab = "overview" | "history" | "rules" | "reasoning";

export function BudgetClient({
  dealershipId,
  dealershipName,
  allocations,
  rules,
  channelSummary,
  connections,
  latestAllocation,
  userEmail,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  const typedAllocations    = allocations   as unknown as AllocationRecord[];
  const typedLatest         = latestAllocation as unknown as AllocationRecord | null;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview",   label: "Overview",   icon: <BarChart3 className="w-4 h-4" /> },
    { id: "history",    label: "History",    icon: <Clock className="w-4 h-4" /> },
    { id: "rules",      label: "Rules",      icon: <Settings className="w-4 h-4" /> },
    { id: "reasoning",  label: "Reasoning",  icon: <Brain className="w-4 h-4" /> },
  ];

  async function handleRunAllocator(totalBudgetUsd: number) {
    await fetch("/api/ads/budget/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalBudgetUsd }),
    });
  }

  async function handleSaveRules(newRules: Record<string, unknown>) {
    await fetch("/api/ads/budget/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRules),
    });
    window.location.reload();
  }

  return (
    <>
      <Header
        title="Budget Allocator"
        subtitle={`${dealershipName} — AI-driven daily budget optimization`}
        userEmail={userEmail}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-5">
        {/* Tabs */}
        <div className="border-b">
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {tab === "overview" && (
          <OverviewTab
            latest={typedLatest}
            channelSummary={channelSummary}
            connections={connections}
            dealershipId={dealershipId}
            onRunAllocator={handleRunAllocator}
          />
        )}
        {tab === "history" && <HistoryTab allocations={typedAllocations} />}
        {tab === "rules"   && <RulesTab rules={rules} onSave={handleSaveRules} />}
        {tab === "reasoning" && <ReasoningTab allocation={typedLatest} />}
      </main>
    </>
  );
}
