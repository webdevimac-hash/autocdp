import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import {
  Plus, Mail, MessageSquare, FileText, Layers,
  BarChart2, Play, Megaphone, Download, ArrowUpRight, Sparkles,
} from "lucide-react";
import { formatDate, calcOpenRate } from "@/lib/utils";
import type { CampaignChannel, CampaignStats } from "@/types";
import Link from "next/link";

export const metadata = { title: "Campaigns" };

const CHANNEL_ICONS: Record<CampaignChannel, React.ElementType> = {
  sms:          MessageSquare,
  email:        Mail,
  direct_mail:  FileText,
  multi_channel:Layers,
};

const CHANNEL_COLORS: Record<CampaignChannel, { icon: string; bg: string; dot: string }> = {
  sms:          { icon: "text-violet-600", bg: "bg-violet-50",  dot: "bg-violet-500" },
  email:        { icon: "text-sky-600",    bg: "bg-sky-50",     dot: "bg-sky-500" },
  direct_mail:  { icon: "text-indigo-600", bg: "bg-indigo-50",  dot: "bg-indigo-500" },
  multi_channel:{ icon: "text-amber-600",  bg: "bg-amber-50",   dot: "bg-amber-500" },
};

const STATUS_CHIP: Record<string, string> = {
  draft:     "chip chip-slate",
  scheduled: "chip chip-sky",
  active:    "chip chip-emerald",
  completed: "chip chip-slate",
  paused:    "chip chip-amber",
};

const FILTERS = ["All", "Active", "Draft", "Scheduled", "Completed"];

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user!.id)
    .single();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("dealership_id", ud?.dealership_id ?? "")
    .order("created_at", { ascending: false });

  const active = (campaigns ?? []).filter(c => c.status === "active").length;
  const totalSent = (campaigns ?? []).reduce((s, c) => s + ((c.stats as CampaignStats)?.sent ?? 0), 0);

  return (
    <>
      <Header title="Campaigns" subtitle="Manage and launch customer outreach" userEmail={user?.email} />

      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-[1400px]">

        {/* ── Toolbar ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Summary chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">{(campaigns ?? []).length} campaigns</span>
            <span className="text-slate-300">·</span>
            <span className="chip chip-emerald">{active} active</span>
            <span className="text-slate-300">·</span>
            <span className="text-sm text-slate-500">{totalSent.toLocaleString()} sent total</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter pills */}
            <div className="hidden sm:flex gap-1">
              {FILTERS.map((f, i) => (
                <button
                  key={f}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    i === 0
                      ? "bg-white border border-slate-200 text-slate-900 shadow-card"
                      : "text-slate-500 hover:text-slate-800 hover:bg-white hover:border-slate-200 border border-transparent"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-[0_1px_2px_0_rgb(79_70_229/0.22)] active:scale-[0.98]">
              <Plus className="w-3.5 h-3.5" /> New Campaign
            </button>
          </div>
        </div>

        {/* ── Campaign grid ────────────────────────────────────── */}
        {(campaigns ?? []).length === 0 ? (
          <div className="inst-panel py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Megaphone className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">No campaigns yet</p>
            <p className="text-xs text-slate-400 mb-6 max-w-xs mx-auto">Create your first AI-powered campaign to start reaching customers.</p>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Create Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(campaigns ?? []).map((campaign) => {
              const stats = campaign.stats as CampaignStats;
              const channel = campaign.channel as CampaignChannel;
              const Icon = CHANNEL_ICONS[channel] ?? Mail;
              const colors = CHANNEL_COLORS[channel] ?? { icon: "text-slate-500", bg: "bg-slate-50", dot: "bg-slate-400" };

              return (
                <div
                  key={campaign.id}
                  className="group bg-white rounded-[var(--radius)] border border-slate-200 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col"
                >
                  {/* Card header */}
                  <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}>
                        <Icon className={`w-4 h-4 ${colors.icon}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">{campaign.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          <p className="text-[11px] text-slate-400 capitalize">{campaign.channel.replace("_", " ")}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={STATUS_CHIP[campaign.status] ?? "chip chip-slate"}>
                        {campaign.status}
                      </span>
                      <span className="ai-badge">
                        <Sparkles className="w-2.5 h-2.5" />AI
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-100 mx-5" />

                  {/* Stats */}
                  <div className="px-5 py-4 flex-1">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[17px] font-bold text-slate-900 tabular-nums tracking-tight">
                          {stats?.sent?.toLocaleString() ?? "0"}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5 font-semibold">Sent</p>
                      </div>
                      <div>
                        <p className="text-[17px] font-bold text-slate-900 tabular-nums tracking-tight">
                          {calcOpenRate({ opened: stats?.opened ?? 0, sent: stats?.sent ?? 0 })}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5 font-semibold">Open Rate</p>
                      </div>
                      <div>
                        <p className="text-[17px] font-bold text-emerald-600 tabular-nums tracking-tight">
                          {stats?.converted ?? "0"}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5 font-semibold">Converted</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-100 mx-5" />
                  <div className="px-5 py-3 flex items-center justify-between">
                    <p className="text-[11px] text-slate-400">
                      {campaign.scheduled_at
                        ? `Scheduled ${formatDate(campaign.scheduled_at, { month: "short", day: "numeric" })}`
                        : `Created ${formatDate(campaign.created_at, { month: "short", day: "numeric" })}`}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {campaign.status === "draft" && (
                        <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 transition-colors active:scale-95">
                          <Play className="w-3 h-3" /> Launch
                        </button>
                      )}
                      {campaign.status === "active" && (
                        <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50 transition-colors">
                          <BarChart2 className="w-3 h-3" /> Stats
                        </button>
                      )}
                      {campaign.status === "completed" && (
                        <>
                          <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 text-[11px] font-semibold hover:bg-slate-50 transition-colors">
                            <BarChart2 className="w-3 h-3" /> Report
                          </button>
                          <a
                            href={`/api/campaigns/${campaign.id}/report`}
                            download
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-[11px] font-semibold hover:bg-slate-50 transition-colors"
                          >
                            <Download className="w-3 h-3" /> CSV
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
