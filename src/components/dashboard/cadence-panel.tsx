import { createServiceClient } from "@/lib/supabase/server";
import { getCadenceSummary, CADENCE_DAYS } from "@/lib/cadence";
import { Users, Clock, CheckCircle2, CalendarClock } from "lucide-react";

interface CadencePanelProps {
  dealershipId: string;
}

export async function CadencePanel({ dealershipId }: CadencePanelProps) {
  try {
    return await renderCadencePanel(dealershipId);
  } catch {
    return null;
  }
}

async function renderCadencePanel(dealershipId: string) {
  const svc = createServiceClient();

  // Only render if there are customers
  const { count } = await svc
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("dealership_id", dealershipId) as unknown as { count: number | null };

  if (!count || count === 0) return null;

  const summary = await getCadenceSummary(dealershipId);
  const { eligible, suppressed, neverContacted, upcomingBatches } = summary;

  const eligiblePct = count > 0 ? Math.round((eligible / count) * 100) : 0;

  return (
    <div className="inst-panel">
      <div className="inst-panel-header">
        <div>
          <div className="inst-panel-title">Contact Cadence</div>
          <div className="inst-panel-subtitle">{CADENCE_DAYS}-day quiet period enforced automatically</div>
        </div>
        <span className="chip chip-emerald">{eligiblePct}% ready</span>
      </div>

      <div className="p-4 sm:p-6 space-y-5">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: "linear-gradient(135deg, #F0FDF9 0%, #DCFCE7 100%)", border: "1px solid rgba(16,185,129,0.18)" }}>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-[22px] font-bold text-emerald-700 leading-none tabular-nums">{eligible.toLocaleString()}</p>
            <p className="text-[11px] text-emerald-600 mt-1 font-medium">Eligible</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)", border: "1px solid rgba(245,158,11,0.18)" }}>
            <Clock className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <p className="text-[22px] font-bold text-amber-700 leading-none tabular-nums">{suppressed.toLocaleString()}</p>
            <p className="text-[11px] text-amber-600 mt-1 font-medium">In Cooldown</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <Users className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
            <p className="text-[22px] font-bold text-indigo-700 leading-none tabular-nums">{neverContacted.toLocaleString()}</p>
            <p className="text-[11px] text-indigo-600 mt-1 font-medium">Never Contacted</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-500 font-medium">
            <span>Eligible for outreach</span>
            <span>{eligible.toLocaleString()} of {count.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${eligiblePct}%`,
                background: "linear-gradient(90deg, #10B981, #34D399)",
              }}
            />
          </div>
        </div>

        {/* Upcoming waves */}
        {upcomingBatches.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Upcoming Waves</span>
            </div>
            <div className="space-y-2">
              {upcomingBatches.map((b) => {
                const label = new Date(b.date + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short", day: "numeric",
                });
                return (
                  <div key={b.date} className="flex items-center justify-between py-1.5">
                    <span className="text-[12px] text-slate-600 font-medium">Week of {label}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.round((b.count / (suppressed || 1)) * 100))}%`,
                            background: "linear-gradient(90deg, #F59E0B, #FCD34D)",
                          }}
                        />
                      </div>
                      <span className="text-[12px] font-semibold text-amber-600 tabular-nums w-8 text-right">
                        {b.count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {suppressed === 0 && neverContacted > 0 && (
          <p className="text-[12px] text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100 leading-relaxed">
            {neverContacted.toLocaleString()} customers have never been contacted — start with them for the highest response rates.
          </p>
        )}

      </div>
    </div>
  );
}
