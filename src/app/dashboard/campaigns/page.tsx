import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, MessageSquare, FileText, Layers, BarChart2, Play, Megaphone, Download } from "lucide-react";
import { formatDate, calcOpenRate } from "@/lib/utils";
import type { CampaignChannel, CampaignStats } from "@/types";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export const metadata = { title: "Campaigns" };

const CHANNEL_ICONS: Record<CampaignChannel, React.ElementType> = {
  sms: MessageSquare,
  email: Mail,
  direct_mail: FileText,
  multi_channel: Layers,
};

const CHANNEL_COLORS: Record<CampaignChannel, string> = {
  sms: "bg-violet-50 text-violet-600",
  email: "bg-sky-50 text-sky-600",
  direct_mail: "bg-indigo-50 text-indigo-600",
  multi_channel: "bg-amber-50 text-amber-600",
};

const STATUS_STYLES = {
  draft:     "bg-slate-100 text-slate-600",
  scheduled: "bg-sky-100 text-sky-700",
  active:    "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-100 text-slate-500",
  paused:    "bg-amber-100 text-amber-700",
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

  return (
    <>
      <Header title="Campaigns" subtitle="Manage and launch customer outreach" userEmail={user?.email} />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f, i) => (
              <button
                key={f}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  i === 0
                    ? "bg-white border border-slate-200 text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white hover:border-slate-200 border border-transparent"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="w-3.5 h-3.5" /> New Campaign
          </button>
        </div>

        {/* Campaign cards */}
        {(campaigns ?? []).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-card py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
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
              const iconColor = CHANNEL_COLORS[channel] ?? "bg-slate-50 text-slate-500";

              return (
                <div
                  key={campaign.id}
                  className="card-lift bg-white rounded-xl border border-slate-200 shadow-card cursor-pointer group"
                >
                  {/* Card header */}
                  <div className="px-5 pt-5 pb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{campaign.name}</p>
                        <p className="text-xs text-slate-400 capitalize mt-0.5">
                          {campaign.channel.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[campaign.status as keyof typeof STATUS_STYLES] ?? "bg-slate-100"}`}>
                        {campaign.status}
                      </span>
                      <span className="ai-badge">
                        <Sparkles className="w-2.5 h-2.5" />
                        AI Optimized
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-100 mx-5" />

                  {/* Stats */}
                  <div className="px-5 py-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold text-slate-900 tracking-tight">{stats?.sent?.toLocaleString() ?? 0}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Sent</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-900 tracking-tight">
                          {calcOpenRate({ opened: stats?.opened ?? 0, sent: stats?.sent ?? 0 })}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Open Rate</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-600 tracking-tight">{stats?.converted ?? 0}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Converted</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 pb-4 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      {campaign.scheduled_at
                        ? `Scheduled ${formatDate(campaign.scheduled_at, { month: "short", day: "numeric" })}`
                        : `Created ${formatDate(campaign.created_at, { month: "short", day: "numeric" })}`}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {campaign.status === "draft" && (
                        <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 text-[10px] font-semibold hover:bg-indigo-100 transition-colors">
                          <Play className="w-3 h-3" /> Launch
                        </button>
                      )}
                      {campaign.status === "completed" && (
                        <>
                          <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-500 text-[10px] font-semibold hover:bg-slate-50 transition-colors">
                            <BarChart2 className="w-3 h-3" /> Report
                          </button>
                          <a
                            href={`/api/campaigns/${campaign.id}/report`}
                            download
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 text-[10px] font-semibold hover:bg-slate-50 transition-colors"
                            title="Download CSV report"
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
