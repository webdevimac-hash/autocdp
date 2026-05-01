"use client";

import { useMemo } from "react";
import { ShieldCheck, Info } from "lucide-react";
import type { Customer } from "@/types";

interface CreditInsightPanelProps {
  selectedCustomers: Customer[];
}

type CreditTier = "excellent" | "good" | "fair" | "poor" | "unknown";

interface TierConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  range: string;
  suggestion: string;
}

const TIER_CONFIG: Record<CreditTier, TierConfig> = {
  excellent: {
    label: "Excellent",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    range: "740+",
    suggestion: "Many customers in this group may qualify for 0% financing promotions or loyalty upgrade programs.",
  },
  good: {
    label: "Good",
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
    range: "670–739",
    suggestion: "Many customers with similar profiles qualify for competitive financing rates and special trade-in offers.",
  },
  fair: {
    label: "Fair",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    range: "580–669",
    suggestion: "Consider featuring cash-back offers and flexible payment options — these tend to resonate well with this segment.",
  },
  poor: {
    label: "Building",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    range: "<580",
    suggestion: "Trade-in equity and cash incentives often work better than financing offers for this group.",
  },
  unknown: {
    label: "Unknown",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    range: "—",
    suggestion: "Connect 700Credit in Integrations to enrich customer profiles with credit tier data.",
  },
};

export function CreditInsightPanel({ selectedCustomers }: CreditInsightPanelProps) {
  // FCRA: only show for customers with an established relationship (total_visits > 0)
  const eligibleCustomers = useMemo(
    () => selectedCustomers.filter((c) => c.total_visits > 0),
    [selectedCustomers]
  );

  const tierCounts = useMemo(() => {
    const counts: Record<CreditTier, number> = {
      excellent: 0, good: 0, fair: 0, poor: 0, unknown: 0,
    };
    for (const c of eligibleCustomers) {
      const tier = ((c.metadata as Record<string, unknown>)?.credit_tier as CreditTier) ?? "unknown";
      counts[tier in counts ? tier : "unknown"]++;
    }
    return counts;
  }, [eligibleCustomers]);

  const totalEligible = eligibleCustomers.length;
  const hasRealData = (tierCounts.excellent + tierCounts.good + tierCounts.fair + tierCounts.poor) > 0;
  const dominantTier = (Object.entries(tierCounts) as [CreditTier, number][])
    .filter(([t]) => t !== "unknown")
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? "unknown";

  if (totalEligible === 0) return null;

  const dominantCfg = TIER_CONFIG[hasRealData ? dominantTier : "unknown"];

  return (
    <div className="rounded-[var(--radius)] border border-indigo-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-indigo-50 border-b border-indigo-100">
        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-indigo-900">Credit Insight</p>
          <p className="text-[10px] text-indigo-500 mt-0.5">
            Prescreened profile data for {totalEligible} existing customer{totalEligible !== 1 ? "s" : ""}
          </p>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
          FCRA Compliant
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Tier distribution */}
        {hasRealData && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Credit Tier Distribution</p>
            <div className="space-y-1.5">
              {(["excellent", "good", "fair", "poor"] as CreditTier[]).map((tier) => {
                const count = tierCounts[tier];
                if (count === 0) return null;
                const pct = Math.round((count / totalEligible) * 100);
                const cfg = TIER_CONFIG[tier];
                return (
                  <div key={tier} className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold w-16 shrink-0 ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          tier === "excellent" ? "bg-emerald-500"
                          : tier === "good" ? "bg-sky-500"
                          : tier === "fair" ? "bg-amber-400"
                          : "bg-orange-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 w-14 text-right shrink-0">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Campaign suggestion based on dominant tier */}
        <div className={`rounded-lg border p-3.5 ${dominantCfg.bg} ${dominantCfg.border}`}>
          <p className={`text-[12px] font-semibold mb-1 ${dominantCfg.color}`}>
            {hasRealData ? `Suggestion for ${TIER_CONFIG[dominantTier].label} segment` : "Credit data not yet available"}
          </p>
          <p className="text-[12px] text-slate-700 leading-relaxed">{dominantCfg.suggestion}</p>
        </div>

        {/* Potential impact callout (only when real data exists) */}
        {hasRealData && (tierCounts.excellent + tierCounts.good) > 0 && (
          <div className="flex gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <strong className="text-slate-700">{tierCounts.excellent + tierCounts.good} of {totalEligible} customers</strong>
              {" "}may be strong candidates for financing or upgrade messaging.
              Potential monthly savings of $50–$150 per customer are realistic for qualified buyers who refinance or upgrade.
            </p>
          </div>
        )}

        {/* Compliance note */}
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Credit insight is based on prescreened soft-pull data and shown only for customers with an existing
          dealership relationship (FCRA §604(c)). Not a credit report. Never promise specific approvals or rates in campaign copy.
        </p>
      </div>
    </div>
  );
}
