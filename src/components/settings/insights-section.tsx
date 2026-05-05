"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RefreshCw, Loader2, ChevronDown, ChevronUp, Pencil, Check, X,
  TrendingUp, Car, Palette, BarChart2, MessageSquare, Star, Lightbulb,
} from "lucide-react";
import type { InsightType } from "@/lib/insights";
import { INSIGHT_TITLES, INSIGHT_DESCRIPTIONS } from "@/lib/insights";

interface Insight {
  id: string;
  insight_type: InsightType;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  dealer_notes: string | null;
  refreshed_at: string;
  is_active: boolean;
}

const INSIGHT_ICONS: Record<InsightType, React.ReactNode> = {
  trade_in_lines:       <TrendingUp className="w-4 h-4" />,
  top_vehicles:         <Car className="w-4 h-4" />,
  popular_colors:       <Palette className="w-4 h-4" />,
  inventory_turnover:   <BarChart2 className="w-4 h-4" />,
  sentiment_patterns:   <MessageSquare className="w-4 h-4" />,
  google_review_trends: <Star className="w-4 h-4" />,
};

const INSIGHT_COLORS: Record<InsightType, string> = {
  trade_in_lines:       "text-blue-600 bg-blue-50 border-blue-200",
  top_vehicles:         "text-emerald-600 bg-emerald-50 border-emerald-200",
  popular_colors:       "text-violet-600 bg-violet-50 border-violet-200",
  inventory_turnover:   "text-amber-600 bg-amber-50 border-amber-200",
  sentiment_patterns:   "text-rose-600 bg-rose-50 border-rose-200",
  google_review_trends: "text-yellow-600 bg-yellow-50 border-yellow-200",
};

const TYPE_ORDER: InsightType[] = [
  "top_vehicles",
  "trade_in_lines",
  "popular_colors",
  "inventory_turnover",
  "sentiment_patterns",
  "google_review_trends",
];

function InsightDataView({ type, data }: { type: InsightType; data: Record<string, unknown> }) {
  switch (type) {
    case "trade_in_lines":
    case "top_vehicles": {
      type Item = { make: string; model: string; count: number; pct: number; service_count?: number };
      const items = (data.items as Item[] ?? []).slice(0, 10);
      if (!items.length) return <p className="text-xs text-slate-400 italic">No data yet.</p>;
      return (
        <ol className="space-y-1.5 mt-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">{item.make} {item.model}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-current rounded-full opacity-40"
                    style={{ width: `${Math.min(item.pct, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{item.pct.toFixed(0)}%</span>
              </div>
            </li>
          ))}
        </ol>
      );
    }

    case "popular_colors": {
      type ColorItem = { color: string; count: number; pct: number };
      const items = (data.items as ColorItem[] ?? []).slice(0, 10);
      if (!items.length) return <p className="text-xs text-slate-400 italic">No color data in inventory.</p>;
      return (
        <ol className="space-y-1.5 mt-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 w-4 shrink-0">{i + 1}</span>
              <span className="text-xs font-medium text-slate-700 w-20 shrink-0">{item.color}</span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-current rounded-full opacity-40"
                  style={{ width: `${Math.min(item.pct, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">{item.pct.toFixed(0)}%</span>
            </li>
          ))}
        </ol>
      );
    }

    case "inventory_turnover": {
      type TurnItem = { make: string; model: string; avg_days: number; unit_count: number; status: "fast" | "normal" | "slow" };
      const items = (data.items as TurnItem[] ?? []).slice(0, 12);
      if (!items.length) return <p className="text-xs text-slate-400 italic">No inventory data yet.</p>;

      const statusColor: Record<string, string> = {
        fast:   "text-emerald-600 bg-emerald-50",
        normal: "text-slate-500 bg-slate-50",
        slow:   "text-red-500 bg-red-50",
      };

      return (
        <div className="mt-2 space-y-1">
          {data.overall_avg_days != null && (
            <p className="text-[11px] text-slate-500 mb-2">
              Avg days on lot: <strong>{String(data.overall_avg_days)}</strong> · {String(data.total_available ?? 0)} available units
            </p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[11px] font-medium text-slate-700 flex-1 min-w-0 truncate">
                  {item.make} {item.model}
                </span>
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", statusColor[item.status])}>
                  {item.avg_days}d
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "sentiment_patterns": {
      type Theme = { theme: string; sentiment: "positive" | "neutral" | "negative"; example_phrases: string[]; frequency: string };
      const themes = data.themes as Theme[] ?? [];
      if (!themes.length) return <p className="text-xs text-slate-400 italic">Not enough service notes yet.</p>;

      const sentimentBadge: Record<string, string> = {
        positive: "text-emerald-700 bg-emerald-50 border-emerald-200",
        neutral:  "text-slate-500 bg-slate-50 border-slate-200",
        negative: "text-red-600 bg-red-50 border-red-200",
      };
      const freqDot: Record<string, string> = { high: "bg-rose-400", medium: "bg-amber-400", low: "bg-slate-300" };

      return (
        <div className="mt-2 space-y-2">
          {data.overall && (
            <p className="text-[11px] text-slate-500">
              Overall: <span className={cn("font-semibold", data.overall === "positive" ? "text-emerald-600" : data.overall === "negative" ? "text-red-500" : "text-slate-600")}>{String(data.overall)}</span>
              {data.analyzed_notes && ` · ${String(data.analyzed_notes)} notes analyzed`}
            </p>
          )}
          {themes.slice(0, 6).map((theme, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={cn("shrink-0 w-2 h-2 rounded-full mt-1.5", freqDot[theme.frequency] ?? "bg-slate-300")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-slate-700">{theme.theme}</span>
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", sentimentBadge[theme.sentiment] ?? sentimentBadge.neutral)}>
                    {theme.sentiment}
                  </span>
                  <span className="text-[10px] text-slate-400">{theme.frequency} freq.</span>
                </div>
                {theme.example_phrases?.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5 italic">
                    &ldquo;{theme.example_phrases[0]}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "google_review_trends": {
      if (!data.available) {
        return (
          <p className="text-xs text-slate-400 italic mt-1">
            {data.gmb_url
              ? "Could not fetch review data from the configured URL."
              : "Configure google_reviews_url in dealership settings to enable this."}
          </p>
        );
      }
      type ReviewTheme = { theme: string; sentiment: string; count: number };
      const themes = data.themes as ReviewTheme[] ?? [];
      return (
        <div className="mt-2 space-y-1.5">
          {data.avg_rating && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <strong>{String(data.avg_rating)}</strong> avg rating
              {data.review_count ? ` · ${String(data.review_count)} reviews` : ""}
            </p>
          )}
          {themes.slice(0, 6).map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="text-[10px] font-bold text-slate-400 w-3 shrink-0">{i + 1}</span>
              <span className="flex-1">{t.theme}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-medium",
                t.sentiment === "positive" ? "text-emerald-700 bg-emerald-50" :
                t.sentiment === "negative" ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-50"
              )}>
                {t.sentiment}
              </span>
            </div>
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}

function InsightCard({ insight, onNotesUpdate }: {
  insight: Insight;
  onNotesUpdate: (id: string, notes: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(insight.dealer_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const colorClass = INSIGHT_COLORS[insight.insight_type];

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/dealership/insights/${insight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealer_notes: notesDraft.trim() || null }),
      });
      if (res.ok) {
        onNotesUpdate(insight.id, notesDraft.trim() || null);
        setEditingNotes(false);
      }
    } finally {
      setSavingNotes(false);
    }
  }

  const refreshedAt = new Date(insight.refreshed_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors text-left"
      >
        <span className={cn("p-1.5 rounded-lg border shrink-0", colorClass)}>
          {INSIGHT_ICONS[insight.insight_type]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{insight.title}</span>
            {insight.dealer_notes && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded font-medium">
                Notes added
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{insight.summary}</p>
        </div>
        <span className="text-[10px] text-slate-400 shrink-0 hidden sm:block">{refreshedAt}</span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        }
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/30">
          {/* Summary */}
          <p className="text-[11px] text-slate-600 pt-3 pb-1">{insight.summary}</p>

          {/* Data breakdown */}
          <div className={cn("rounded-lg p-3 border mt-2", colorClass.replace("text-", "border-").replace(" bg-", " bg-").split(" bg-")[0] + " bg-white")}>
            <InsightDataView type={insight.insight_type} data={insight.data} />
          </div>

          {/* GM Notes */}
          <div className="mt-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              <span className="text-[11px] font-semibold text-slate-600">GM / Team Notes</span>
              <span className="text-[10px] text-slate-400">(injected into swarm alongside this insight)</span>
            </div>

            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Add context the AI should know — e.g. 'We started pushing Tacos hard this spring' or 'White is mostly fleet vehicles, ignore for personal outreach'"
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 bg-white"
                />
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={saveNotes} disabled={savingNotes} className="h-7 text-xs gap-1">
                    {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditingNotes(false); setNotesDraft(insight.dealer_notes ?? ""); }}
                    className="h-7 text-xs gap-1"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingNotes(true)}
                className={cn(
                  "group flex items-start gap-2 min-h-[2.5rem] px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors",
                  insight.dealer_notes
                    ? "border-amber-200 bg-amber-50/40 hover:border-amber-300"
                    : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20"
                )}
              >
                <p className={cn("text-[11px] flex-1 mt-0.5", insight.dealer_notes ? "text-slate-700" : "text-slate-400 italic")}>
                  {insight.dealer_notes ?? "Click to add notes…"}
                </p>
                <Pencil className="w-3 h-3 text-slate-300 group-hover:text-slate-500 shrink-0 mt-0.5 transition-colors" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function InsightsSection() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshResult, setLastRefreshResult] = useState<string | null>(null);

  const fetchInsights = useCallback(() => {
    setLoading(true);
    fetch("/api/dealership/insights")
      .then((r) => r.ok ? r.json() : { insights: [] })
      .then((d: { insights: Insight[] }) => setInsights(d.insights ?? []))
      .catch(() => setInsights([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  async function runRefresh() {
    setRefreshing(true);
    setLastRefreshResult(null);
    try {
      const res = await fetch("/api/dealership/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const data = await res.json() as {
        insightsRefreshed?: number;
        tokensUsed?: number;
        errors?: Array<{ type: string; message: string }>;
      };

      const msg = res.ok
        ? `Refreshed ${data.insightsRefreshed ?? 0} insights${data.errors?.length ? ` (${data.errors.length} skipped)` : ""}.`
        : "Refresh failed — check console.";

      setLastRefreshResult(msg);
      if (res.ok) fetchInsights();
    } catch {
      setLastRefreshResult("Refresh failed — network error.");
    } finally {
      setRefreshing(false);
    }
  }

  function handleNotesUpdate(id: string, notes: string | null) {
    setInsights((prev) => prev.map((ins) => ins.id === id ? { ...ins, dealer_notes: notes } : ins));
  }

  // Sort insights by canonical order
  const sorted = [...insights].sort(
    (a, b) => TYPE_ORDER.indexOf(a.insight_type) - TYPE_ORDER.indexOf(b.insight_type)
  );

  // Insights that haven't been generated yet (show as placeholder cards)
  const presentTypes = new Set(insights.map((i) => i.insight_type));
  const missing = TYPE_ORDER.filter((t) => !presentTypes.has(t));

  const activeNotes = insights.filter((i) => i.dealer_notes).length;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span className="text-xs text-slate-500 font-medium">
            {loading
              ? "Loading insights…"
              : insights.length
              ? `${insights.length} insight${insights.length !== 1 ? "s" : ""} active${activeNotes ? ` · ${activeNotes} with team notes` : ""}`
              : "No insights yet — run a refresh to generate."}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={runRefresh}
          disabled={refreshing || loading}
          className="h-8 text-xs gap-1.5 shrink-0"
        >
          {refreshing
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Refreshing…</>
            : <><RefreshCw className="w-3.5 h-3.5" /> Refresh Insights</>
          }
        </Button>
      </div>

      {/* Refresh result */}
      {lastRefreshResult && (
        <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {lastRefreshResult}
        </p>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading insights…
        </div>
      ) : (
        <div className="space-y-2">
          {/* Existing insights */}
          {sorted.map((insight) => (
            <InsightCard key={insight.id} insight={insight} onNotesUpdate={handleNotesUpdate} />
          ))}

          {/* Placeholder cards for not-yet-generated insight types */}
          {missing.map((type) => (
            <div
              key={type}
              className="border border-dashed border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3 opacity-50"
            >
              <span className={cn("p-1.5 rounded-lg border shrink-0", INSIGHT_COLORS[type])}>
                {INSIGHT_ICONS[type]}
              </span>
              <div>
                <p className="text-sm font-medium text-slate-600">{INSIGHT_TITLES[type]}</p>
                <p className="text-[11px] text-slate-400">{INSIGHT_DESCRIPTIONS[type]} Run a refresh to generate.</p>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {insights.length === 0 && missing.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              No insights yet.
              <br />
              <button className="mt-1 text-indigo-500 font-medium hover:underline" onClick={runRefresh}>
                Run your first refresh →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer note */}
      {insights.length > 0 && (
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Insights are read by the Data, Targeting, Creative, and Orchestrator agents before every campaign.
          They act as soft guidance — not rules. Add team notes to any insight to give the swarm extra context.
        </p>
      )}
    </div>
  );
}
