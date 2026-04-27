"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, RotateCcw, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LimitsData {
  role: string;
  globalDefaults: Record<string, number>;
  limits: Record<string, number>;
  dailyCostLimitCents: number;
  usage: {
    mail_piece_sent: number;
    agent_run: number;
    sms_sent: number;
    email_sent: number;
    estimatedCostCents: number;
    dailyCostLimitCents: number;
  };
}

const FIELD_META: Array<{
  key: keyof LimitsData["limits"];
  usageKey: keyof LimitsData["usage"];
  label: string;
  unit: string;
  description: string;
}> = [
  { key: "mail_piece_sent", usageKey: "mail_piece_sent", label: "Direct Mail", unit: "pieces/day",  description: "PostGrid postcards & letters" },
  { key: "agent_run",       usageKey: "agent_run",       label: "AI Agent Runs", unit: "runs/day",  description: "Orchestrator + creative agent calls" },
  { key: "sms_sent",        usageKey: "sms_sent",        label: "SMS",          unit: "msgs/day",   description: "Twilio outbound messages" },
  { key: "email_sent",      usageKey: "email_sent",      label: "Email",        unit: "emails/day", description: "Resend outbound emails" },
];

function UsageBar({ count, limit }: { count: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{count}/{limit} today</span>
    </div>
  );
}

export function LimitsSection() {
  const [data, setData] = useState<LimitsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state — keyed by field key, value is string for input control
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [costLimit, setCostLimit] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dealership/limits");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load limits");
      setData(json as LimitsData);
      // Seed form from current custom limits
      const initOverrides: Record<string, string> = {};
      for (const f of FIELD_META) {
        initOverrides[f.key] = String(json.limits[f.key] ?? json.globalDefaults[f.key] ?? "");
      }
      setOverrides(initOverrides);
      setCostLimit(json.dailyCostLimitCents > 0 ? String(Math.round(json.dailyCostLimitCents / 100)) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load limits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, number | null> = {};
      for (const f of FIELD_META) {
        const v = overrides[f.key];
        body[f.key] = v === "" ? null : parseInt(v, 10);
      }
      const costCents = costLimit === "" ? 0 : Math.round(parseFloat(costLimit) * 100);
      body.daily_cost_limit_cents = costCents;

      const res = await fetch("/api/dealership/limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    if (!data) return;
    const r: Record<string, string> = {};
    for (const f of FIELD_META) {
      r[f.key] = String(data.globalDefaults[f.key] ?? "");
    }
    setOverrides(r);
    setCostLimit("");
  }

  const canEdit = data?.role === "owner" || data?.role === "admin";

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading limits…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4" id="limits">
      <p className="text-xs text-slate-500">
        Per-dealership daily limits. Leave a field blank to use the global default.
        {!canEdit && <span className="ml-1 font-medium text-amber-700">View-only — contact an owner or admin to edit.</span>}
      </p>

      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        {FIELD_META.map((f) => {
          const limit = parseInt(overrides[f.key] || String(data?.globalDefaults[f.key] ?? 0), 10) || 0;
          const count = (data?.usage[f.usageKey] ?? 0) as number;
          const pct = limit > 0 ? Math.round((count / limit) * 100) : 0;
          return (
            <div key={f.key} className="flex items-center gap-4 px-4 py-3 bg-white">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-slate-900">{f.label}</p>
                  <span className="text-[10px] text-slate-400">{f.unit}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>
                <UsageBar count={count} limit={limit} />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {pct >= 100 ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">AT LIMIT</span>
                ) : pct >= 80 ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{pct}%</span>
                ) : null}
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={overrides[f.key] ?? ""}
                  onChange={(e) => setOverrides((p) => ({ ...p, [f.key]: e.target.value }))}
                  disabled={!canEdit}
                  placeholder={String(data?.globalDefaults[f.key] ?? "")}
                  className={cn(
                    "w-24 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 tabular-nums",
                    !canEdit && "opacity-60 cursor-not-allowed bg-slate-50"
                  )}
                />
              </div>
            </div>
          );
        })}

        {/* Daily spend cap */}
        <div className="flex items-center gap-4 px-4 py-3 bg-white">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-slate-900">Daily Spend Cap</p>
              <span className="text-[10px] text-slate-400">$/day</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Pause all sends when estimated cost exceeds this. 0 = no cap.</p>
            {data && data.usage.dailyCostLimitCents > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", data.usage.estimatedCostCents >= data.usage.dailyCostLimitCents ? "bg-red-500" : "bg-emerald-500")}
                    style={{ width: `${Math.min(100, Math.round((data.usage.estimatedCostCents / data.usage.dailyCostLimitCents) * 100))}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                  ${Math.round(data.usage.estimatedCostCents / 100)}/${Math.round(data.usage.dailyCostLimitCents / 100)} today
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm text-slate-400">$</span>
            <input
              type="number"
              min={0}
              step={1}
              value={costLimit}
              onChange={(e) => setCostLimit(e.target.value)}
              disabled={!canEdit}
              placeholder="0"
              className={cn(
                "w-24 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 tabular-nums",
                !canEdit && "opacity-60 cursor-not-allowed bg-slate-50"
              )}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Limits"}
          </button>
          <button
            onClick={resetToDefaults}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:border-slate-300 disabled:opacity-60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
          </button>
          {saved && (
            <div className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> Saved
            </div>
          )}
        </div>
      )}
    </div>
  );
}
