"use client";

import { useState } from "react";
import { Brain, RefreshCw, TrendingUp, Lightbulb, ChevronRight } from "lucide-react";
import type { HealthAnalysis } from "@/lib/anthropic/agents/health-agent";
import Link from "next/link";

interface HealthClientProps {
  cachedAnalysis: HealthAnalysis | null;
  cachedAt: string | null;
}

const PRIORITY_CONFIG = {
  critical: {
    label: "Critical",
    textColor: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    chip: "chip-red",
  },
  high: {
    label: "High",
    textColor: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    chip: "chip-amber",
  },
  medium: {
    label: "Medium",
    textColor: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    chip: "chip-indigo",
  },
} as const;

function scoreColor(score: number) {
  if (score >= 80) return "#10b981";
  if (score >= 65) return "#6366f1";
  if (score >= 50) return "#f59e0b";
  if (score >= 35) return "#f97316";
  return "#ef4444";
}

function scoreLabelClass(label: string) {
  if (label === "Excellent") return "text-emerald-600";
  if (label === "Good") return "text-indigo-600";
  if (label === "Fair") return "text-amber-600";
  if (label === "Needs Attention") return "text-orange-600";
  return "text-red-600";
}

function ScoreGauge({ score }: { score: number }) {
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const fill = Math.min(score / 100, 1) * circumference;
  const color = scoreColor(score);

  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circumference}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="55" textAnchor="middle" fill={color} fontSize="26" fontWeight="700" fontFamily="system-ui">
        {score}
      </text>
      <text x="60" y="72" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="system-ui">/ 100</text>
    </svg>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80 ? "bg-emerald-500" :
    score >= 65 ? "bg-indigo-500" :
    score >= 50 ? "bg-amber-400" :
    "bg-red-400";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-500 font-medium">{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: scoreColor(score) }}>{score}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function HealthClient({ cachedAnalysis, cachedAt }: HealthClientProps) {
  const [analysis, setAnalysis] = useState<HealthAnalysis | null>(cachedAnalysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(cachedAt);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health/recommendations", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const { analysis: result } = await res.json() as { analysis: HealthAnalysis };
      setAnalysis(result);
      setRefreshedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inst-panel">
      <div className="inst-panel-header">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <div className="inst-panel-title">AI Health Analysis</div>
          {analysis && (
            <span className={`text-[11px] font-bold ${scoreLabelClass(analysis.score_label)}`}>
              {analysis.score_label}
            </span>
          )}
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40 transition-opacity"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing…" : analysis ? "Refresh" : "Analyze Now"}
        </button>
      </div>

      {/* Empty state */}
      {!analysis && !loading && (
        <div className="px-6 py-14 text-center">
          <Brain className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 mb-1">No analysis yet</p>
          <p className="text-xs text-slate-400 mb-5 max-w-xs mx-auto">
            Generate AI-powered recommendations based on your live dealership data. Takes about 15 seconds.
          </p>
          <button
            onClick={runAnalysis}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Brain className="w-3.5 h-3.5" />
            Analyze Dealership Health
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="px-6 py-14 text-center">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-indigo-100 border-t-indigo-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-700 mb-1">Reviewing your dealership…</p>
          <p className="text-xs text-slate-400">
            The AI is reviewing metrics across customers, inventory, campaigns, and service history.
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="px-6 py-3">
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        </div>
      )}

      {/* Results */}
      {analysis && !loading && (
        <div className="p-6 space-y-6">

          {/* Score gauge + component bars */}
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <ScoreGauge score={analysis.overall_score} />
              <p className={`text-xs font-bold ${scoreLabelClass(analysis.score_label)}`}>
                {analysis.score_label}
              </p>
              {refreshedAt && (
                <p className="text-[10px] text-slate-400 tabular-nums">
                  {new Date(refreshedAt).toLocaleString(undefined, {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
            </div>
            <div className="flex-1 w-full space-y-2.5 pt-1">
              <ScoreBar label="Customer Retention" score={analysis.component_scores.customer_retention} />
              <ScoreBar label="Inventory Health" score={analysis.component_scores.inventory_health} />
              <ScoreBar label="Campaign Engagement" score={analysis.component_scores.campaign_engagement} />
              <ScoreBar label="Revenue Health" score={analysis.component_scores.revenue_health} />
            </div>
          </div>

          {/* Recommendations */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {analysis.recommendations.length} Recommendations
            </p>
            {analysis.recommendations.map((rec) => {
              const cfg = PRIORITY_CONFIG[rec.priority];
              return (
                <div key={rec.id} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span className={`chip ${cfg.chip} text-[10px] font-semibold`}>{cfg.label}</span>
                        <span className="chip chip-slate text-[10px]">{rec.category}</span>
                        <span className={`text-[13px] font-semibold ${cfg.textColor}`}>{rec.title}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mb-2">{rec.description}</p>
                      <div className="flex items-start gap-1.5 text-xs text-slate-600 mb-1.5">
                        <Lightbulb className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                        <span className="font-medium">{rec.suggested_action}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-xs text-slate-500">
                        <TrendingUp className="w-3 h-3 shrink-0 mt-0.5 text-emerald-500" />
                        <span>{rec.expected_impact}</span>
                      </div>
                    </div>
                    {rec.action_url && (
                      <Link
                        href={rec.action_url}
                        className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors mt-0.5"
                      >
                        Go <ChevronRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
