"use client";

import { TrendingUp, Users, Wrench, Car, DollarSign, BarChart3 } from "lucide-react";

type ImpactChannel = "direct_mail" | "sms" | "email" | "multi_channel";

interface CampaignImpactPanelProps {
  recipientCount: number;
  channel: ImpactChannel;
  estimatedCostStr: string;
}

interface ChannelRates {
  rateMin: number;
  rateMax: number;
  avgTicket: number;
  ticketLabel: string;
  costPerPiece: number;
}

const CHANNEL_RATES: Record<ImpactChannel, ChannelRates> = {
  direct_mail: { rateMin: 0.02, rateMax: 0.05, avgTicket: 385, ticketLabel: "avg service ticket",  costPerPiece: 1.35 },
  sms:         { rateMin: 0.08, rateMax: 0.15, avgTicket: 285, ticketLabel: "avg service ticket",  costPerPiece: 0.02 },
  email:       { rateMin: 0.05, rateMax: 0.12, avgTicket: 320, ticketLabel: "avg service ticket",  costPerPiece: 0.00 },
  multi_channel:{ rateMin: 0.06, rateMax: 0.12, avgTicket: 350, ticketLabel: "avg service ticket", costPerPiece: 0.70 },
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${fmt(n)}`;
}

function range(lo: number, hi: number, fmtFn: (n: number) => string): string {
  if (Math.abs(hi - lo) < 1) return fmtFn(Math.round((lo + hi) / 2));
  return `${fmtFn(Math.round(lo))}–${fmtFn(Math.round(hi))}`;
}

export function CampaignImpactPanel({ recipientCount, channel, estimatedCostStr }: CampaignImpactPanelProps) {
  const rates = CHANNEL_RATES[channel];
  const n = recipientCount;

  const responsesLo = n * rates.rateMin;
  const responsesHi = n * rates.rateMax;
  const serviceLo   = responsesLo * rates.avgTicket;
  const serviceHi   = responsesHi * rates.avgTicket;
  const totalCost   = n * rates.costPerPiece;

  // Conservative ROI: (mid revenue - cost) / cost
  const midRevenue  = (serviceLo + serviceHi) / 2;
  const roi         = totalCost > 0 ? Math.round(((midRevenue - totalCost) / totalCost) * 100) : 0;
  const roiLabel    = totalCost > 0
    ? `${roi > 0 ? "+" : ""}${roi}% estimated ROI`
    : "No direct cost";

  const metrics = [
    {
      icon: Users,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      label: "Expected Responses",
      value: range(responsesLo, responsesHi, fmt),
      sub: `${Math.round(rates.rateMin * 100)}–${Math.round(rates.rateMax * 100)}% response rate`,
    },
    {
      icon: Wrench,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      label: "Service Revenue",
      value: range(serviceLo, serviceHi, fmtCurrency),
      sub: `${fmtCurrency(rates.avgTicket)} ${rates.ticketLabel}`,
    },
    {
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
      label: "Campaign Cost",
      value: estimatedCostStr,
      sub: rates.costPerPiece > 0
        ? `$${rates.costPerPiece.toFixed(2)}/piece`
        : "Included in plan",
    },
    {
      icon: BarChart3,
      color: roi > 200 ? "text-emerald-700" : roi > 0 ? "text-sky-600" : "text-slate-500",
      bg: roi > 200 ? "bg-emerald-50" : roi > 0 ? "bg-sky-50" : "bg-slate-50",
      label: "Estimated ROI",
      value: roiLabel,
      sub: "Based on industry benchmarks",
    },
  ];

  return (
    <div className="rounded-[var(--radius)] border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-slate-50 border-b border-slate-100">
        <TrendingUp className="w-4 h-4 text-slate-600 shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-slate-900">Campaign Impact Estimate</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Based on industry benchmarks for {n} {channel.replace("_", " ")} recipients
          </p>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/60">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center mb-2 ${m.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                </div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{m.label}</p>
                <p className={`text-base font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{m.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Car sales upsell note */}
        <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <Car className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            <strong>Vehicle sales upside:</strong> Campaigns that reconnect lapsed customers often surface trade-in and upgrade opportunities.
            Even 1–2 sales from {n} contacts could add $3,000–$6,000 in gross profit.
          </p>
        </div>

        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
          Estimates use automotive direct mail / digital benchmarks and are not guaranteed. Actual results depend on offer strength, timing, and market conditions.
        </p>
      </div>
    </div>
  );
}
