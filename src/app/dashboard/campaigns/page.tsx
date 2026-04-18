import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Mail, MessageSquare, FileText, Layers, BarChart2, Play } from "lucide-react";
import { formatDate, calcOpenRate } from "@/lib/utils";
import type { CampaignChannel, CampaignStats } from "@/types";

export const metadata = { title: "Campaigns" };

const CHANNEL_ICONS: Record<CampaignChannel, React.ElementType> = {
  sms: MessageSquare,
  email: Mail,
  direct_mail: FileText,
  multi_channel: Layers,
};

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-slate-100 text-slate-700",
  paused: "bg-amber-100 text-amber-700",
};

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

      <main className="flex-1 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {["All", "Active", "Draft", "Scheduled", "Completed"].map((f) => (
              <Button key={f} variant="outline" size="sm" className="text-xs h-8">{f}</Button>
            ))}
          </div>
          <Button size="sm" className="h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Campaign
          </Button>
        </div>

        {/* Campaign cards */}
        {(campaigns ?? []).length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm font-medium">No campaigns yet</p>
              <p className="text-muted-foreground text-xs mt-1 mb-4">Create your first AI-powered campaign to get started.</p>
              <Button size="sm">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(campaigns ?? []).map((campaign) => {
              const stats = campaign.stats as CampaignStats;
              const Icon = CHANNEL_ICONS[campaign.channel as CampaignChannel] ?? Mail;
              return (
                <Card key={campaign.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-brand-50 rounded-lg">
                          <Icon className="w-4 h-4 text-brand-600" />
                        </div>
                        <div>
                          <CardTitle className="text-sm leading-tight">{campaign.name}</CardTitle>
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">
                            {campaign.channel.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[campaign.status as keyof typeof STATUS_STYLES] ?? "bg-gray-100"}`}>
                        {campaign.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-base font-bold text-gray-900">{stats.sent?.toLocaleString() ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground">Sent</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{calcOpenRate({ opened: stats.opened ?? 0, sent: stats.sent ?? 0 })}</p>
                        <p className="text-[10px] text-muted-foreground">Open Rate</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{stats.converted ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground">Converted</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-muted-foreground">
                        {campaign.scheduled_at
                          ? `Scheduled ${formatDate(campaign.scheduled_at, { month: "short", day: "numeric" })}`
                          : `Created ${formatDate(campaign.created_at, { month: "short", day: "numeric" })}`}
                      </p>
                      {campaign.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <Play className="w-3 h-3 mr-1" /> Launch
                        </Button>
                      )}
                      {campaign.status === "completed" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          <BarChart2 className="w-3 h-3 mr-1" /> Report
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
