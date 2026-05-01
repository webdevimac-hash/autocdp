"use client";

import { useEffect, useState } from "react";
import { Award, DollarSign, AlertTriangle, CheckCircle2, Info } from "lucide-react";

interface CoopProgram {
  id: string;
  manufacturer: string;
  program_name: string;
  reimbursement_rate: number;
  max_reimbursement_usd: number | null;
  valid_from: string | null;
  valid_through: string | null;
}

interface CoopPanelProps {
  recipientCount: number;
  estimatedCostUsd: number;
}

export function CoopPanel({ recipientCount, estimatedCostUsd }: CoopPanelProps) {
  const [programs, setPrograms] = useState<CoopProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dealership/coop-programs")
      .then((r) => r.ok ? r.json() : { programs: [] })
      .then((d: { programs?: CoopProgram[] }) => setPrograms(d.programs ?? []))
      .catch(() => setPrograms([]))
      .finally(() => setLoading(false));
  }, []);

  const activePrograms = programs.filter((p) => {
    if (!p.valid_through) return true;
    return new Date(p.valid_through) >= new Date();
  });

  const topProgram = activePrograms[0] ?? null;
  const estReimb = topProgram
    ? Math.min(
        estimatedCostUsd * topProgram.reimbursement_rate,
        topProgram.max_reimbursement_usd ?? Infinity
      )
    : 0;
  const netCost = estimatedCostUsd - estReimb;

  return (
    <div className="rounded-[var(--radius)] border border-violet-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-violet-50 border-b border-violet-100">
        <Award className="w-4 h-4 text-violet-600 shrink-0" />
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-violet-900">Manufacturer Co-op</p>
          <p className="text-[10px] text-violet-500 mt-0.5">
            {loading ? "Checking programs…" : activePrograms.length > 0
              ? `${activePrograms.length} active program${activePrograms.length !== 1 ? "s" : ""} available`
              : "No programs configured yet"}
          </p>
        </div>
        {!loading && activePrograms.length > 0 && (
          <span className="text-[9px] font-bold uppercase tracking-wider bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">
            Eligible
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-slate-400 py-2">
            <div className="w-3.5 h-3.5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
            Checking co-op eligibility…
          </div>
        )}

        {!loading && activePrograms.length === 0 && (
          <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              No co-op programs are configured for your dealership.{" "}
              Add manufacturer programs in <strong>Settings → Co-op Programs</strong> to unlock
              automatic compliance checks and reimbursement tracking.
            </p>
          </div>
        )}

        {!loading && activePrograms.length > 0 && (
          <>
            {/* Program list */}
            <div className="space-y-1.5">
              {activePrograms.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-2.5 bg-violet-50/60 rounded-lg border border-violet-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{p.program_name}</p>
                    <p className="text-[10px] text-slate-400">{p.manufacturer} · {Math.round(p.reimbursement_rate * 100)}% reimb.</p>
                  </div>
                  {p.valid_through && (
                    <span className="text-[9px] text-slate-400 shrink-0">
                      expires {new Date(p.valid_through).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Cost breakdown */}
            {estimatedCostUsd > 0 && topProgram && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { label: "Campaign Cost", value: `$${estimatedCostUsd.toFixed(0)}`, color: "text-slate-700" },
                  { label: "Est. Reimbursement", value: `−$${estReimb.toFixed(0)}`, color: "text-emerald-700" },
                  { label: "Net Cost", value: `$${Math.max(0, netCost).toFixed(0)}`, color: "text-violet-700 font-bold" },
                ].map((m) => (
                  <div key={m.label} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 text-center">
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{m.label}</p>
                    <p className={`text-sm ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Compliance note */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                <strong>Compliance enforced at send time.</strong> The Co-op Agent will verify eligibility,
                inject required manufacturer disclaimers, and apply copy rules automatically before any piece is sent.
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
              <DollarSign className="w-3 h-3" />
              Reimbursement estimates are approximate. Submit invoices per manufacturer program requirements.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
