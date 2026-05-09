"use client";

import { useState } from "react";
import {
  Sparkles, RefreshCw, Check, X, Mail, MessageSquare, AtSign,
  ChevronDown, ChevronUp, Copy, Trash2, Plus, BookOpen,
} from "lucide-react";
import type { TemplateSuggestion } from "@/lib/anthropic/agents/template-agent";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  goal: string | null;
  tone: string;
  credit_tiers: string[];
  lifecycle_stages: string[];
  is_ai_suggested: boolean;
  ai_rationale: string | null;
  times_used: number;
  avg_response_rate: number | null;
  created_at: string;
}

interface TemplatesClientProps {
  initialTemplates: SavedTemplate[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_CONFIG = {
  direct_mail: { label: "Direct Mail", icon: Mail, chip: "chip-indigo" },
  sms: { label: "SMS", icon: MessageSquare, chip: "chip-emerald" },
  email: { label: "Email", icon: AtSign, chip: "chip-violet" },
} as const;

const GOAL_LABELS: Record<string, string> = {
  service_reminder: "Service Reminder",
  win_back: "Win-Back",
  aged_inventory: "Aged Inventory",
  vip_appreciation: "VIP Appreciation",
  seasonal: "Seasonal",
  financing: "Financing",
  general: "General",
};

const CREDIT_TIER_LABELS: Record<string, string> = {
  excellent: "Excellent (740+)",
  good: "Good (670–739)",
  fair: "Fair (580–669)",
  poor: "Poor (<580)",
};

function ChannelChip({ channel }: { channel: string }) {
  const cfg = CHANNEL_CONFIG[channel as keyof typeof CHANNEL_CONFIG];
  if (!cfg) return <span className="chip chip-slate text-[10px]">{channel}</span>;
  const Icon = cfg.icon;
  return (
    <span className={`chip ${cfg.chip} text-[10px] inline-flex items-center gap-1`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onSave,
  onDismiss,
  saving,
}: {
  suggestion: TemplateSuggestion;
  onSave: (s: TemplateSuggestion) => void;
  onDismiss: () => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyBody() {
    await navigator.clipboard.writeText(suggestion.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="inst-panel border-indigo-100">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="chip chip-indigo text-[10px] inline-flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />AI
              </span>
              <ChannelChip channel={suggestion.channel} />
              {suggestion.goal && (
                <span className="chip chip-slate text-[10px]">{GOAL_LABELS[suggestion.goal] ?? suggestion.goal}</span>
              )}
              <span className="chip chip-slate text-[10px] capitalize">{suggestion.tone}</span>
            </div>
            <p className="text-[13px] font-semibold text-slate-900">{suggestion.name}</p>
            {suggestion.subject && (
              <p className="text-[11px] text-slate-500 mt-0.5">Subject: <span className="italic">{suggestion.subject}</span></p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button onClick={copyBody} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors" title="Copy body">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onSave(suggestion)}
              disabled={saving}
              className="flex items-center gap-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors"
            >
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Save
            </button>
            <button onClick={onDismiss} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors" title="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body preview */}
        <div className={`mt-3 ${expanded ? "" : "max-h-20 overflow-hidden"} relative`}>
          <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
            {suggestion.body}
          </pre>
          {!expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          )}
        </div>

        {expanded && (
          <div className="mt-3 space-y-1.5">
            {suggestion.credit_tiers.length > 0 && (
              <p className="text-[11px] text-slate-500">
                <span className="font-semibold">Target tiers:</span>{" "}
                {suggestion.credit_tiers.map((t) => CREDIT_TIER_LABELS[t] ?? t).join(", ")}
              </p>
            )}
            {suggestion.lifecycle_stages.length > 0 && (
              <p className="text-[11px] text-slate-500">
                <span className="font-semibold">Lifecycle:</span>{" "}
                {suggestion.lifecycle_stages.map((s) => s.replace("_", "-")).join(", ")}
              </p>
            )}
            <p className="text-[11px] text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 mt-2 leading-relaxed">
              {suggestion.ai_rationale}
            </p>
            {suggestion.performance_basis && (
              <p className="text-[10px] text-slate-400 italic">{suggestion.performance_basis}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Saved template card ──────────────────────────────────────────────────────

function SavedTemplateCard({
  template,
  onDelete,
}: {
  template: SavedTemplate;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function copyBody() {
    await navigator.clipboard.writeText(template.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${template.name}"?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      onDelete(template.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="inst-panel">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {template.is_ai_suggested && (
                <span className="chip chip-indigo text-[10px] inline-flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />AI
                </span>
              )}
              <ChannelChip channel={template.channel} />
              {template.goal && (
                <span className="chip chip-slate text-[10px]">{GOAL_LABELS[template.goal] ?? template.goal}</span>
              )}
              {template.times_used > 0 && (
                <span className="text-[10px] text-emerald-600 font-semibold">{template.times_used}× used</span>
              )}
              {template.avg_response_rate != null && (
                <span className="text-[10px] text-indigo-600 font-semibold">{template.avg_response_rate}% response</span>
              )}
            </div>
            <p className="text-[13px] font-semibold text-slate-900">{template.name}</p>
            {template.subject && (
              <p className="text-[11px] text-slate-500 mt-0.5">Subject: <span className="italic">{template.subject}</span></p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setExpanded((e) => !e)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button onClick={copyBody} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400" title="Copy body">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg disabled:opacity-50"
              title="Delete template"
            >
              {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2">
            <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
              {template.body}
            </pre>
            {template.credit_tiers.length > 0 && (
              <p className="text-[11px] text-slate-500">
                <span className="font-semibold">Target tiers:</span>{" "}
                {template.credit_tiers.map((t) => CREDIT_TIER_LABELS[t] ?? t).join(", ")}
              </p>
            )}
            {template.lifecycle_stages.length > 0 && (
              <p className="text-[11px] text-slate-500">
                <span className="font-semibold">Lifecycle:</span>{" "}
                {template.lifecycle_stages.map((s) => s.replace("_", "-")).join(", ")}
              </p>
            )}
            {template.ai_rationale && (
              <p className="text-[11px] text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 leading-relaxed">
                {template.ai_rationale}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function TemplatesClient({ initialTemplates }: TemplatesClientProps) {
  const [templates, setTemplates] = useState<SavedTemplate[]>(initialTemplates);
  const [suggestions, setSuggestions] = useState<TemplateSuggestion[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<string[]>(["direct_mail", "sms", "email"]);
  const [filterChannel, setFilterChannel] = useState<string>("all");

  const allChannels = ["direct_mail", "sms", "email"];

  async function generateSuggestions() {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const res = await fetch("/api/templates/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      if (!res.ok) throw new Error("Suggestion failed");
      const data = await res.json() as {
        suggestions: TemplateSuggestion[];
        performanceSummary: string;
      };
      setSuggestions(data.suggestions);
      setPerformanceSummary(data.performanceSummary);
    } catch {
      setError("Could not generate suggestions. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSuggestion(suggestion: TemplateSuggestion, index: number) {
    setSavingId(index);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...suggestion, is_ai_suggested: true }),
      });
      if (!res.ok) throw new Error("Save failed");
      const { template } = await res.json() as { template: SavedTemplate };
      setTemplates((prev) => [template, ...prev]);
      setSuggestions((prev) => prev.filter((_, i) => i !== index));
    } catch {
      setError("Failed to save template.");
    } finally {
      setSavingId(null);
    }
  }

  function dismissSuggestion(index: number) {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  }

  function deleteTemplate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  const filtered = filterChannel === "all"
    ? templates
    : templates.filter((t) => t.channel === filterChannel);

  return (
    <div className="space-y-5">

      {/* ── AI Suggestion Panel ─────────────────────────────────── */}
      <div className="inst-panel">
        <div className="inst-panel-header">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <div className="inst-panel-title">AI Template Suggestions</div>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-slate-500 mb-3">
            The AI analyzes your highest-performing campaigns to suggest new templates optimized for your audience.
          </p>

          {/* Channel selector */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-semibold text-slate-500">Generate for:</span>
            {allChannels.map((ch) => {
              const cfg = CHANNEL_CONFIG[ch as keyof typeof CHANNEL_CONFIG];
              const Icon = cfg.icon;
              const active = channels.includes(ch);
              return (
                <button
                  key={ch}
                  onClick={() => setChannels((prev) =>
                    prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
                  )}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </button>
              );
            })}
            <button
              onClick={generateSuggestions}
              disabled={loading || channels.length === 0}
              className="ml-auto flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Analyzing…" : "Generate"}
            </button>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

          {loading && (
            <div className="py-8 text-center">
              <div className="w-8 h-8 mx-auto rounded-full border-2 border-indigo-100 border-t-indigo-500 animate-spin mb-3" />
              <p className="text-xs text-slate-500">Analyzing your campaigns and generating templates…</p>
            </div>
          )}

          {performanceSummary && !loading && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 mb-3">
              <p className="text-[11px] font-semibold text-indigo-800 mb-0.5 flex items-center gap-1">
                <BookOpen className="w-3 h-3" />Performance Insights
              </p>
              <p className="text-[11px] text-indigo-700 leading-relaxed">{performanceSummary}</p>
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="border-t border-slate-50 px-5 py-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {suggestions.length} Suggestions — click Save to add to your library
            </p>
            {suggestions.map((s, i) => (
              <SuggestionCard
                key={i}
                suggestion={s}
                onSave={(s) => saveSuggestion(s, i)}
                onDismiss={() => dismissSuggestion(i)}
                saving={savingId === i}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Saved Templates ─────────────────────────────────────── */}
      <div className="inst-panel">
        <div className="inst-panel-header">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <div className="inst-panel-title">Saved Templates</div>
          </div>
          <div className="flex items-center gap-1.5">
            {["all", ...allChannels].map((ch) => (
              <button
                key={ch}
                onClick={() => setFilterChannel(ch)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors capitalize ${
                  filterChannel === ch
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                {ch === "all" ? "All" : CHANNEL_CONFIG[ch as keyof typeof CHANNEL_CONFIG]?.label ?? ch}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <BookOpen className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600 mb-1">No templates yet</p>
            <p className="text-xs text-slate-400">Generate AI suggestions above to populate your library.</p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            {filtered.map((t) => (
              <SavedTemplateCard key={t.id} template={t} onDelete={deleteTemplate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
