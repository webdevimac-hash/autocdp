import {
  TrendingUp, Wrench, Car, DollarSign,
  Mail, MessageSquare, Inbox, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

interface DmsRoiPanelProps {
  directMailSent: number;
  smsSent: number;
  emailSent: number;
  campaignCount: number;
}

const fmtC = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}k`
                 : `$${Math.round(n)}`;

const fmtN = (n: number) => Math.round(n).toLocaleString();

export function DmsRoiPanel({ directMailSent, smsSent, emailSent, campaignCount }: DmsRoiPanelProps) {
  const totalSent = directMailSent + smsSent + emailSent;
  if (totalSent === 0) return null;

  // ── Response estimates ──────────────────────────────────────────
  const dmRespLo  = directMailSent * 0.02;  const dmRespHi  = directMailSent * 0.05;
  const smsRespLo = smsSent        * 0.08;  const smsRespHi = smsSent        * 0.15;
  const emlRespLo = emailSent      * 0.05;  const emlRespHi = emailSent      * 0.12;

  const totalRespLo = dmRespLo  + smsRespLo + emlRespLo;
  const totalRespHi = dmRespHi  + smsRespHi + emlRespHi;

  // ── Service revenue by channel ──────────────────────────────────
  const dmSvcLo  = dmRespLo  * 385;  const dmSvcHi  = dmRespHi  * 385;
  const smsSvcLo = smsRespLo * 285;  const smsSvcHi = smsRespHi * 285;
  const emlSvcLo = emlRespLo * 320;  const emlSvcHi = emlRespHi * 320;

  const svcRevLo = dmSvcLo + smsSvcLo + emlSvcLo;
  const svcRevHi = dmSvcHi + smsSvcHi + emlSvcHi;

  // ── Vehicle sales (1 per 200–400 responses, $3k avg gross) ─────
  const carsLo   = Math.floor(totalRespLo / 400);
  const carsHi   = Math.max(carsLo, Math.ceil(totalRespHi / 200));
  const carRevLo = carsLo * 3_000;
  const carRevHi = carsHi * 3_000;

  const totalRevLo = svcRevLo + carRevLo;
  const totalRevHi = svcRevHi + carRevHi;

  // ── Cost & ROI ──────────────────────────────────────────────────
  const dmCost      = directMailSent * 1.35;
  const smsCost     = smsSent        * 0.02;
  const totalCost   = dmCost + smsCost;
  const costPerPiece = totalSent > 0 ? totalCost / totalSent : 0;

  const midRev  = (totalRevLo + totalRevHi) / 2;
  const roiPct  = totalCost > 0 ? Math.round(((midRev - totalCost) / totalCost) * 100) : 0;
  const roiStr  = roiPct >= 10_000 ? `${(roiPct / 1_000).toFixed(0)}k%`
                : roiPct >=  1_000 ? `${(roiPct / 1_000).toFixed(1)}k%`
                                   : `${roiPct}%`;

  // ── Channel breakdown rows ──────────────────────────────────────
  type ChannelRow = {
    icon: typeof Mail;
    label: string;
    count: number;
    revLo: number;
    revHi: number;
    cost: number;
    iconBg: string;
    iconColor: string;
    barBg: string;
  };

  const channels: ChannelRow[] = (
    [
      directMailSent > 0 && {
        icon: Mail, label: "Direct Mail", count: directMailSent,
        revLo: dmSvcLo, revHi: dmSvcHi, cost: dmCost,
        iconBg: "bg-indigo-50", iconColor: "text-indigo-600",
        barBg: "linear-gradient(90deg,#6366F1,#818cf8)",
      },
      smsSent > 0 && {
        icon: MessageSquare, label: "SMS", count: smsSent,
        revLo: smsSvcLo, revHi: smsSvcHi, cost: smsCost,
        iconBg: "bg-violet-50", iconColor: "text-violet-600",
        barBg: "linear-gradient(90deg,#8B5CF6,#a78bfa)",
      },
      emailSent > 0 && {
        icon: Inbox, label: "Email", count: emailSent,
        revLo: emlSvcLo, revHi: emlSvcHi, cost: 0,
        iconBg: "bg-sky-50", iconColor: "text-sky-600",
        barBg: "linear-gradient(90deg,#0EA5E9,#38bdf8)",
      },
    ] as (ChannelRow | false)[]
  ).filter(Boolean) as ChannelRow[];

  const maxChannelRev = Math.max(...channels.map((c) => c.revHi), 1);

  return (
    <div className="inst-panel panel-glow-emerald">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="inst-panel-header">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="inst-panel-title">DMS ROI Dashboard</div>
            <div className="inst-panel-subtitle">
              {totalSent.toLocaleString()} pieces sent across{" "}
              {campaignCount} campaign{campaignCount !== 1 ? "s" : ""} — 30-day window
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/analytics"
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors shrink-0"
        >
          Full analytics <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Metric tiles ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">

          {/* Revenue Lift — hero tile */}
          <div className="col-span-2 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-emerald-50 to-white p-5 relative overflow-hidden">
            {/* decorative ring */}
            <div
              className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 pointer-events-none"
              style={{ background: "radial-gradient(circle, #10B981, transparent 70%)" }}
            />
            <div className="relative">
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-2">
                Estimated Revenue Lift
              </p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-[2rem] font-extrabold text-emerald-700 tracking-tight leading-none">
                  {fmtC(totalRevLo)}
                </span>
                <span className="text-xl font-bold text-emerald-300">–</span>
                <span className="text-[2rem] font-extrabold text-emerald-700 tracking-tight leading-none">
                  {fmtC(totalRevHi)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-600/80 mt-1.5">
                Service revenue + estimated vehicle gross profit
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold">
                +{roiStr} estimated ROI
              </div>
            </div>
          </div>

          {/* Service Appointments */}
          <div className="rounded-xl border border-slate-100 bg-white p-4 flex flex-col">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
              <Wrench className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">
              {fmtN(totalRespLo)}–{fmtN(totalRespHi)}
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
              Service Appts
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-snug">
              Based on 2–15% response rate by channel
            </div>
          </div>

          {/* Cars Sold */}
          <div className="rounded-xl border border-slate-100 bg-white p-4 flex flex-col">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
              <Car className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">
              {carsLo === carsHi ? String(carsHi) : `${carsLo}–${carsHi}`}
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
              Cars Sold (Est.)
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-snug">
              $3,000 avg gross · surfaces during service visits
            </div>
          </div>

          {/* Cost per piece */}
          <div className="rounded-xl border border-slate-100 bg-white p-4 flex flex-col">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center mb-3">
              <DollarSign className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">
              ${costPerPiece.toFixed(2)}
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
              Cost / Piece
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-1">
              {fmtC(totalCost)} total campaign spend
            </div>
          </div>

        </div>

        {/* ── Campaign Impact Summary ──────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-semibold text-slate-700">Campaign Impact Summary</span>
            <span className="text-[10px] text-slate-400 font-medium">
              Projected service revenue by channel
            </span>
          </div>

          <div className="space-y-2">
            {channels.map((ch) => {
              const Icon = ch.icon;
              const barPct = Math.max(4, Math.round((ch.revHi / maxChannelRev) * 100));
              return (
                <div
                  key={ch.label}
                  className="flex items-center gap-3 p-3.5 rounded-lg border border-slate-100 bg-slate-50/50"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ch.iconBg}`}>
                    <Icon className={`w-3.5 h-3.5 ${ch.iconColor}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-semibold text-slate-700">{ch.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          {ch.count.toLocaleString()} sent
                        </span>
                        <span className="text-[12px] font-bold text-slate-800">
                          {fmtC(ch.revLo)}–{fmtC(ch.revHi)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${barPct}%`, background: ch.barBg }}
                      />
                    </div>
                  </div>

                  <div className="text-right shrink-0 min-w-[56px]">
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">cost</div>
                    <div className="text-[12px] font-bold text-slate-600">
                      {ch.cost > 0 ? fmtC(ch.cost) : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Disclaimer ───────────────────────────────────────────── */}
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Estimates based on automotive industry benchmarks: 2–5% direct mail response, 8–15% SMS, 5–12% email.
          Avg service tickets: $385 (mail) · $285 (SMS) · $320 (email). Vehicle sales: 1 per 200–400 responses at $3,000 avg gross profit.
          Actual results vary by market, offer, and timing. Not a guarantee.
        </p>

      </div>
    </div>
  );
}
