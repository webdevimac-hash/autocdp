"use client";

/**
 * A/B Tests Client — Dynamic Creative Testing Dashboard
 *
 * Features:
 *  - Active / Completed test list with live KPI comparisons
 *  - Win probability gauge per variant
 *  - "Generate Creatives" modal — calls /api/ads/creatives/generate
 *  - "Create Test" form — calls POST /api/ads/ab-tests
 *  - "Run Optimizer" button — calls /api/ads/ab-tests/[id]/optimize
 *  - Expandable variant rows with CTR / CVR / CPA / ROAS comparison bars
 */

import { useState, useTransition } from "react";
import {
  FlaskConical, Sparkles, TrendingUp, Trophy, Pause, Play,
  ChevronDown, ChevronRight, BarChart2, Zap, Plus, X,
  CheckCircle, AlertCircle, Clock, RefreshCw, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Variant {
  id:             string;
  test_id:        string;
  name:           string;
  is_control:     boolean;
  platform_ad_id: string | null;
  impressions:    number;
  clicks:         number;
  conversions:    number;
  spend_usd:      number;
  ctr:            number;
  cvr:            number;
  cpa:            number | null;
  roas:           number | null;
  win_probability: number | null;
  status:         string;
  creative:       Record<string, unknown>;
  last_kpi_sync_at: string | null;
}

interface AbTest {
  id:                   string;
  name:                 string;
  platform:             string;
  status:               string;
  primary_metric:       string;
  hypothesis:           string | null;
  min_impressions:      number;
  confidence_threshold: number;
  auto_optimize:        boolean;
  budget_scale_pct:     number;
  winner_variant_id:    string | null;
  started_at:           string;
  ended_at:             string | null;
  created_at:           string;
  variants:             Variant[];
}

interface Props {
  dealershipId:       string;
  dealershipName:     string;
  tests:              Record<string, unknown>[];
  creativePatterns:   Record<string, unknown>[];
  connectedPlatforms: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(n: number): string { return `${(n * 100).toFixed(2)}%`; }
function usd(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(2)}`;
}
function fmtNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString();
}
function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

const PLATFORM_LABEL: Record<string, string> = {
  google_ads: "Google Ads", meta_ads: "Meta Ads", tiktok_ads: "TikTok Ads",
};
const PLATFORM_COLOR: Record<string, string> = {
  google_ads: "bg-blue-100 text-blue-700 border-blue-200",
  meta_ads:   "bg-indigo-100 text-indigo-700 border-indigo-200",
  tiktok_ads: "bg-slate-900 text-white border-slate-700",
};
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  active:          { label: "Active",          color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: Play },
  paused:          { label: "Paused",          color: "text-amber-600 bg-amber-50 border-amber-200",       icon: Pause },
  winner_declared: { label: "Winner Found",    color: "text-violet-600 bg-violet-50 border-violet-200",    icon: Trophy },
  completed:       { label: "Completed",       color: "text-slate-500 bg-slate-50 border-slate-200",       icon: CheckCircle },
  draft:           { label: "Draft",           color: "text-slate-400 bg-slate-50 border-slate-200",       icon: Clock },
  failed:          { label: "Failed",          color: "text-rose-600 bg-rose-50 border-rose-200",          icon: AlertCircle },
};
const METRIC_LABEL: Record<string, string> = {
  ctr: "CTR", cvr: "CVR", cpa: "CPA", roas: "ROAS", clicks: "Clicks",
};

// ---------------------------------------------------------------------------
// Win probability gauge
// ---------------------------------------------------------------------------

function WinGauge({ probability, isWinner }: { probability: number; isWinner: boolean }) {
  const pct = Math.min(Math.max(probability * 100, 0), 100);
  const color = pct >= 95
    ? (isWinner ? "#10B981" : "#EF4444")
    : pct >= 80 ? "#F59E0B" : "#94A3B8";

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8">
        <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90">
          <circle cx="16" cy="16" r="12" fill="none" stroke="#E2E8F0" strokeWidth="3" />
          <circle
            cx="16" cy="16" r="12" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${(pct / 100) * 75.4} 75.4`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color }}>
          {pct.toFixed(0)}
        </span>
      </div>
      <span className="text-[10px] text-slate-500 font-medium">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant comparison row
// ---------------------------------------------------------------------------

function VariantRow({
  variant, isWinner, allVariants, metric,
}: {
  variant: Variant;
  isWinner: boolean;
  allVariants: Variant[];
  metric: string;
}) {
  const maxImp = Math.max(...allVariants.map((v) => v.impressions), 1);
  const maxClk = Math.max(...allVariants.map((v) => v.clicks), 1);

  const metricValue = metric === "ctr" ? variant.ctr
    : metric === "cvr" ? variant.cvr
    : metric === "cpa" ? (variant.cpa ?? 0)
    : metric === "roas" ? (variant.roas ?? 0)
    : variant.clicks;

  const control = allVariants.find((v) => v.is_control);
  const controlVal = control
    ? metric === "ctr" ? control.ctr
    : metric === "cvr" ? control.cvr
    : metric === "cpa" ? (control.cpa ?? 0)
    : metric === "roas" ? (control.roas ?? 0)
    : control.clicks
    : 0;

  const liftPct = !variant.is_control && controlVal > 0 && metric !== "cpa"
    ? ((metricValue - controlVal) / controlVal) * 100
    : !variant.is_control && controlVal > 0 && metric === "cpa"
    ? ((controlVal - metricValue) / controlVal) * 100  // lower CPA = better
    : null;

  const statusBadge: Record<string, string> = {
    active:     "bg-emerald-50 text-emerald-700",
    winner:     "bg-violet-100 text-violet-700 font-bold",
    eliminated: "bg-slate-100 text-slate-400 line-through",
    paused:     "bg-amber-50 text-amber-600",
    draft:      "bg-slate-50 text-slate-400",
  };

  return (
    <div className={`p-4 rounded-[var(--radius)] border transition-all ${
      isWinner
        ? "border-violet-200 bg-violet-50/50 shadow-sm"
        : variant.is_control
        ? "border-slate-200 bg-white"
        : "border-slate-100 bg-white"
    }`}>
      {/* Name + badges */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isWinner && <Trophy className="w-3.5 h-3.5 text-violet-500" />}
          <span className="text-[13px] font-semibold text-slate-800">{variant.name}</span>
          {variant.is_control && (
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
              Control
            </span>
          )}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${statusBadge[variant.status] ?? "bg-slate-100 text-slate-500"}`}>
            {variant.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {variant.win_probability != null && (
            <WinGauge probability={variant.win_probability} isWinner={isWinner} />
          )}
          {liftPct !== null && (
            <div className={`flex items-center gap-0.5 text-[11px] font-bold ${liftPct >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
              {liftPct >= 0
                ? <ArrowUpRight className="w-3 h-3" />
                : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(liftPct).toFixed(1)}% {METRIC_LABEL[metric] ?? metric}
            </div>
          )}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Impressions", value: fmtNum(variant.impressions), bar: variant.impressions / maxImp, color: "#6366F1" },
          { label: "Clicks",      value: fmtNum(variant.clicks),      bar: variant.clicks / maxClk,       color: "#8B5CF6" },
          { label: "CTR",         value: pct(variant.ctr),            bar: variant.ctr * 10,              color: "#0EA5E9" },
          { label: "CVR",         value: pct(variant.cvr),            bar: variant.cvr * 20,              color: "#10B981" },
        ].map((kpi) => (
          <div key={kpi.label}>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">{kpi.label}</div>
            <div className="text-[13px] font-bold text-slate-900 tabular-nums mb-1">{kpi.value}</div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(Math.max(kpi.bar * 100, 2), 100)}%`, background: kpi.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Secondary metrics */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
        <span>Spend: <span className="font-semibold text-slate-700">{usd(variant.spend_usd)}</span></span>
        {variant.cpa != null && <span>CPA: <span className="font-semibold text-slate-700">{usd(variant.cpa)}</span></span>}
        {variant.roas != null && <span>ROAS: <span className="font-semibold text-slate-700">{variant.roas.toFixed(2)}×</span></span>}
        {variant.platform_ad_id && (
          <span className="text-slate-400 font-mono text-[9px] ml-auto">Ad: {variant.platform_ad_id.slice(-8)}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test card
// ---------------------------------------------------------------------------

function TestCard({
  test,
  onOptimize,
}: {
  test: AbTest;
  onOptimize: (testId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [optimizing, startOptimize] = useTransition();

  const statusCfg = STATUS_CONFIG[test.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;
  const variants  = test.variants as unknown as Variant[];
  const winner    = variants.find((v) => v.id === test.winner_variant_id);
  const activeVariants = variants.filter((v) => v.status !== "eliminated" && v.status !== "draft");

  // Aggregate totals
  const totalImpressions = variants.reduce((s, v) => s + (v.impressions ?? 0), 0);
  const totalSpend       = variants.reduce((s, v) => s + Number(v.spend_usd ?? 0), 0);

  return (
    <div className="inst-panel card-lift">
      {/* Header */}
      <button
        className="w-full text-left inst-panel-header hover:bg-slate-50/50 transition-colors rounded-t-[var(--radius)]"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FlaskConical className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="inst-panel-title truncate">{test.name}</div>
            {test.hypothesis && (
              <div className="inst-panel-subtitle truncate">{test.hypothesis}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Platform badge */}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${PLATFORM_COLOR[test.platform] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {PLATFORM_LABEL[test.platform] ?? test.platform}
          </span>
          {/* Status badge */}
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            {statusCfg.label}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Summary metrics strip */}
      <div className="px-4 py-2 bg-slate-50/40 border-t border-slate-100 flex items-center gap-6 flex-wrap text-[11px] text-slate-500">
        <span>
          <span className="font-semibold text-slate-800">{variants.length}</span> variants
        </span>
        <span>
          <span className="font-semibold text-slate-800">{fmtNum(totalImpressions)}</span> impressions
        </span>
        <span>
          Spend: <span className="font-semibold text-slate-800">{usd(totalSpend)}</span>
        </span>
        <span>
          Metric: <span className="font-semibold text-slate-800">{METRIC_LABEL[test.primary_metric] ?? test.primary_metric}</span>
        </span>
        {test.status === "winner_declared" && winner && (
          <span className="flex items-center gap-1 text-violet-600 font-semibold">
            <Trophy className="w-3 h-3" />
            Winner: {winner.name}
          </span>
        )}
        <span className="ml-auto text-slate-400">
          Started {relativeDate(test.started_at)}
          {test.ended_at && ` · Ended ${relativeDate(test.ended_at)}`}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 sm:p-5 border-t border-slate-100">
          {/* Actions */}
          {test.status === "active" && (
            <div className="flex items-center gap-2 mb-5">
              <button
                onClick={() => startOptimize(() => onOptimize(test.id))}
                disabled={optimizing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${optimizing ? "animate-spin" : ""}`} />
                {optimizing ? "Evaluating…" : "Run Optimizer"}
              </button>
              <span className="text-[11px] text-slate-400">
                Needs ≥{fmtNum(test.min_impressions)} impressions per variant ·
                Target {(test.confidence_threshold * 100).toFixed(0)}% confidence
              </span>
            </div>
          )}

          {/* Variants */}
          <div className="space-y-3">
            {activeVariants.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">
                No variants linked yet. Push ads via the Digital Command Center and link the platform ad IDs.
              </div>
            )}
            {activeVariants
              .sort((a, b) => (b.is_control ? 1 : 0) - (a.is_control ? 1 : 0))
              .map((v) => (
                <VariantRow
                  key={v.id}
                  variant={v}
                  isWinner={v.id === test.winner_variant_id}
                  allVariants={activeVariants}
                  metric={test.primary_metric}
                />
              ))}
          </div>

          {/* Test settings */}
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-slate-500">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Primary Metric</div>
              <div className="font-semibold text-slate-700">{METRIC_LABEL[test.primary_metric]}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Min Impressions</div>
              <div className="font-semibold text-slate-700">{fmtNum(test.min_impressions)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Confidence Target</div>
              <div className="font-semibold text-slate-700">{(test.confidence_threshold * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Budget Scale on Win</div>
              <div className="font-semibold text-slate-700">+{test.budget_scale_pct}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create test + generate creatives modal
// ---------------------------------------------------------------------------

function CreateTestModal({
  connectedPlatforms,
  onClose,
  onCreated,
}: {
  connectedPlatforms: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"config" | "generating" | "review" | "creating">("config");
  const [platform, setPlatform]           = useState(connectedPlatforms[0] ?? "google_ads");
  const [campaignGoal, setCampaignGoal]   = useState("");
  const [finalUrl, setFinalUrl]           = useState("");
  const [numVariants, setNumVariants]     = useState(platform === "google_ads" ? 3 : 6);
  const [testName, setTestName]           = useState("");
  const [hypothesis, setHypothesis]       = useState("");
  const [primaryMetric, setPrimaryMetric] = useState("ctr");
  const [minImpressions, setMinImpressions] = useState(1000);
  const [generated, setGenerated]         = useState<Record<string, unknown> | null>(null);
  const [error, setError]                 = useState("");

  async function handleGenerate() {
    if (!campaignGoal || !finalUrl) { setError("Campaign goal and final URL are required"); return; }
    setError("");
    setStep("generating");
    try {
      const res = await fetch("/api/ads/creatives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, campaignGoal, finalUrl, numVariants }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Generation failed");
      setGenerated(data);
      if (!testName) setTestName(`${PLATFORM_LABEL[platform] ?? platform} — ${campaignGoal.slice(0, 40)}`);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStep("config");
    }
  }

  async function handleCreate() {
    if (!testName) { setError("Test name is required"); return; }
    setStep("creating");
    try {
      const variants = generated?.platform === "google_ads"
        ? (generated.variants as Array<{ name: string; hypothesis: string; headlines: unknown[]; descriptions: unknown[]; path1?: string; path2?: string }>)
            .map((v, i) => ({
              name:      v.name,
              isControl: i === 0,
              creative:  { headlines: v.headlines, descriptions: v.descriptions, path1: v.path1, path2: v.path2, finalUrl },
            }))
        : (generated?.variants as Array<{ name: string; hypothesis: string; headline: string; primaryText: string; description?: string; callToAction: string; imagePrompt?: string }> ?? [])
            .map((v, i) => ({
              name:      v.name,
              isControl: i === 0,
              creative:  { headline: v.headline, primaryText: v.primaryText, description: v.description, callToAction: v.callToAction, finalUrl },
            }));

      const res = await fetch("/api/ads/ab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: testName, platform, hypothesis, primaryMetric, minImpressions,
          budgetScalePct: 20, autoOptimize: true, variants,
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Create failed");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setStep("review");
    }
  }

  const platforms = connectedPlatforms.filter((p) => ["google_ads", "meta_ads"].includes(p));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-[var(--radius)] shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <h2 className="text-[15px] font-bold text-slate-900">
              {step === "review" ? "Review Generated Creatives" : "Generate Creative Variations"}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {step === "config" && (
            <>
              {/* Platform selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 block">Platform</label>
                {platforms.length === 0 ? (
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    No ad platforms connected. Connect Google Ads or Meta Ads in Integrations first.
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {platforms.map((p) => (
                      <button
                        key={p}
                        onClick={() => { setPlatform(p); setNumVariants(p === "google_ads" ? 3 : 6); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          platform === p ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:border-indigo-300"
                        }`}
                      >
                        {PLATFORM_LABEL[p]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Campaign goal */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 block">Campaign Goal</label>
                <input
                  value={campaignGoal} onChange={(e) => setCampaignGoal(e.target.value)}
                  placeholder="e.g. Move aged F-150 inventory before month-end, Conquest Toyota drivers"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {/* Final URL */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 block">Final URL</label>
                <input
                  value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)}
                  placeholder="https://yourdealership.com/specials"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {/* Number of variants */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 block">
                  Number of Variants
                  <span className="ml-2 text-slate-400 normal-case font-normal">
                    {platform === "google_ads"
                      ? "(each RSA tests 15 headlines × 4 descriptions = 720 combinations)"
                      : "(each is a distinct Meta ad creative)"}
                  </span>
                </label>
                <div className="flex gap-2">
                  {(platform === "google_ads" ? [2, 3, 4, 5] : [4, 6, 8, 10]).map((n) => (
                    <button
                      key={n}
                      onClick={() => setNumVariants(n)}
                      className={`w-10 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        numVariants === n ? "bg-violet-600 text-white border-violet-600" : "border-slate-200 text-slate-500 hover:border-violet-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!campaignGoal || !finalUrl || platforms.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-40"
              >
                <Sparkles className="w-4 h-4" />
                Generate {numVariants} AI Creative Variants
              </button>
            </>
          )}

          {step === "generating" && (
            <div className="py-12 text-center space-y-3">
              <Sparkles className="w-10 h-10 text-violet-400 mx-auto animate-pulse" />
              <div className="text-[15px] font-semibold text-slate-800">
                Claude is generating creative variations…
              </div>
              <div className="text-sm text-slate-400">
                Analyzing your inventory, winning patterns, and dealership voice.
              </div>
            </div>
          )}

          {step === "review" && generated && (
            <>
              {/* Rationale */}
              {(generated as { rationale?: string }).rationale && (
                <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-xs text-violet-800">
                  <span className="font-semibold">Strategy: </span>
                  {(generated as { rationale: string }).rationale}
                </div>
              )}

              {/* Variant previews */}
              <div className="space-y-3">
                {platform === "google_ads"
                  ? (generated.variants as Array<{ name: string; hypothesis: string; headlines: Array<{ text: string }>; descriptions: Array<{ text: string }> }>).map((v, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          {i === 0 && <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded uppercase">Control</span>}
                          <span className="text-[12px] font-bold text-slate-800">{v.name}</span>
                        </div>
                        <div className="text-[11px] text-violet-600 italic">{v.hypothesis}</div>
                        <div className="space-y-1">
                          {v.headlines.slice(0, 5).map((h, j) => (
                            <div key={j} className="text-xs text-blue-700 font-medium">"{h.text}"</div>
                          ))}
                          {v.headlines.length > 5 && <div className="text-[10px] text-slate-400">+{v.headlines.length - 5} more headlines</div>}
                        </div>
                        <div className="text-[10px] text-slate-500">{v.headlines.length} headlines, {v.descriptions?.length ?? 0} descriptions</div>
                      </div>
                    ))
                  : (generated.variants as Array<{ name: string; hypothesis: string; headline: string; primaryText: string; callToAction: string }>).map((v, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          {i === 0 && <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded uppercase">Control</span>}
                          <span className="text-[12px] font-bold text-slate-800">{v.name}</span>
                        </div>
                        <div className="text-[11px] text-violet-600 italic">{v.hypothesis}</div>
                        <div className="text-xs font-semibold text-blue-700">"{v.headline}"</div>
                        <div className="text-xs text-slate-600">{v.primaryText}</div>
                        <div className="text-[10px] text-slate-400">CTA: {v.callToAction}</div>
                      </div>
                    ))
                }
              </div>

              {/* Test config */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Test Name</label>
                  <input value={testName} onChange={(e) => setTestName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Hypothesis</label>
                  <input value={hypothesis} onChange={(e) => setHypothesis(e.target.value)}
                    placeholder="Urgency-focused copy will outperform benefit-led copy by ≥10% CTR"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Primary Metric</label>
                    <select value={primaryMetric} onChange={(e) => setPrimaryMetric(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {Object.entries(METRIC_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Min Impressions</label>
                    <input type="number" value={minImpressions} onChange={(e) => setMinImpressions(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Confidence</label>
                    <div className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50 text-slate-500">
                      95%
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep("config")}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  ← Regenerate
                </button>
                <button onClick={handleCreate}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  Create A/B Test
                </button>
              </div>
            </>
          )}

          {step === "creating" && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-10 h-10 text-indigo-400 mx-auto animate-spin" />
              <div className="text-[15px] font-semibold text-slate-800">Creating test…</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Creative Patterns sidebar
// ---------------------------------------------------------------------------

function PatternsPanel({ patterns }: { patterns: Record<string, unknown>[] }) {
  if (patterns.length === 0) return null;

  return (
    <div className="inst-panel">
      <div className="inst-panel-header">
        <div>
          <div className="inst-panel-title">Creative Learnings</div>
          <div className="inst-panel-subtitle">Patterns distilled from past tests</div>
        </div>
        <span className="chip chip-violet">{patterns.length}</span>
      </div>
      <div className="p-4 space-y-2.5">
        {patterns.map((p, i) => (
          <div key={i} className="p-3 bg-white rounded-[var(--radius)] border border-violet-100 shadow-card">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-violet-700">
                {String(p.title ?? "")}
              </span>
              <div className="w-12 h-1.5 bg-violet-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(Number(p.confidence ?? 0) * 100)}%`,
                    background: "linear-gradient(90deg,#8B5CF6,#7C3AED)",
                  }}
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">{String(p.description ?? "")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AbTestsClient({
  dealershipId: _dealershipId,
  dealershipName,
  tests: rawTests,
  creativePatterns,
  connectedPlatforms,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [tests, setTests]           = useState<AbTest[]>(rawTests as unknown as AbTest[]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [, startTransition] = useTransition();

  async function handleOptimize(testId: string) {
    const res = await fetch(`/api/ads/ab-tests/${testId}/optimize`, { method: "POST" });
    const data = await res.json() as Record<string, unknown>;
    if ((data as { action?: string }).action === "winner_declared") {
      // Reload tests
      const listRes = await fetch("/api/ads/ab-tests");
      const listData = await listRes.json() as { tests: AbTest[] };
      setTests(listData.tests ?? tests);
    }
  }

  function handleCreated() {
    setShowCreate(false);
    startTransition(() => {
      fetch("/api/ads/ab-tests")
        .then((r) => r.json() as Promise<{ tests: AbTest[] }>)
        .then((d) => setTests(d.tests ?? tests))
        .catch(() => null);
    });
  }

  const filtered = filterStatus === "all"
    ? tests
    : tests.filter((t) => t.status === filterStatus);

  const statusCounts = tests.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      {/* Create modal */}
      {showCreate && (
        <CreateTestModal
          connectedPlatforms={connectedPlatforms}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4 px-4 sm:px-6 pt-6 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-violet-500" />
            Dynamic Creative A/B Tests
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {dealershipName} · AI-generated variations auto-optimized by statistical significance
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Generate Creatives
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="px-4 sm:px-6 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Tests",       value: statusCounts.active ?? 0,          icon: Play,      accent: "stat-card-emerald" },
            { label: "Winners Found",      value: statusCounts.winner_declared ?? 0,  icon: Trophy,    accent: "stat-card-violet" },
            { label: "Variants Running",   value: tests.filter((t) => t.status === "active").reduce((s, t) => s + (t.variants as unknown as Variant[]).filter((v) => v.status === "active").length, 0), icon: BarChart2, accent: "stat-card-indigo" },
            { label: "Patterns Learned",   value: creativePatterns.length,            icon: Sparkles,  accent: "stat-card-amber" },
          ].map((k) => (
            <div key={k.label} className={`stat-card ${k.accent} card-lift`}>
              <div className="flex items-start justify-between mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/60">
                  <k.icon className="w-3.5 h-3.5 text-slate-600" />
                </div>
              </div>
              <div className="metric-value">{k.value}</div>
              <div className="metric-label">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 px-4 sm:px-6 pb-8">
        <div className="flex gap-5">
          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1 w-fit">
              {[
                { key: "all",             label: `All (${tests.length})` },
                { key: "active",          label: `Active (${statusCounts.active ?? 0})` },
                { key: "winner_declared", label: `Winners (${statusCounts.winner_declared ?? 0})` },
                { key: "completed",       label: `Done (${statusCounts.completed ?? 0})` },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    filterStatus === f.key
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="inst-panel">
                <div className="p-12 text-center space-y-3">
                  <FlaskConical className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="text-sm font-semibold text-slate-700">No A/B tests yet</div>
                  <div className="text-xs text-slate-400 max-w-sm mx-auto">
                    Generate AI creative variations and launch your first test to start finding winners automatically.
                  </div>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mx-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate First Test
                  </button>
                </div>
              </div>
            ) : (
              filtered.map((test) => (
                <TestCard key={test.id} test={test} onOptimize={handleOptimize} />
              ))
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-72 shrink-0 hidden xl:block space-y-4">
            <PatternsPanel patterns={creativePatterns} />

            {/* How it works */}
            <div className="inst-panel">
              <div className="inst-panel-header">
                <div className="inst-panel-title">How Auto-Optimization Works</div>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { icon: Sparkles, label: "Generate", desc: "Claude creates thematically distinct variants for Google RSA or Meta" },
                  { icon: TrendingUp, label: "Collect Data", desc: "Ads run simultaneously; performance syncs from platform APIs daily" },
                  { icon: Zap, label: "Z-Test Evaluation", desc: "Two-proportion z-test on CTR/CVR; 95% confidence threshold" },
                  { icon: Trophy, label: "Auto-Promote", desc: "Winner's budget scaled +20%, losers paused, pattern saved" },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                      <s.icon className="w-3 h-3 text-violet-600" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-700">{s.label}</div>
                      <div className="text-[10px] text-slate-400 leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
