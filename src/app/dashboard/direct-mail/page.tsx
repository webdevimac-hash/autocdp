import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignBuilder } from "@/components/direct-mail/campaign-builder";
import { LearnButton } from "@/components/direct-mail/learn-button";
import {
  FileText, Send, Truck, ScanLine, DollarSign,
  Clock, CheckCircle, AlertCircle, Package, MessageSquare, Mail, Info,
} from "lucide-react";
import { formatDate, formatRelativeDate } from "@/lib/utils";
import type { Customer, MailPiece, MailPieceStatus } from "@/types";

export const metadata = { title: "Direct Mail" };

const STATUS_CONFIG: Record<MailPieceStatus, { label: string; badge: string; icon: React.ElementType }> = {
  pending:       { label: "Pending",        badge: "bg-slate-100 text-slate-600",   icon: Clock },
  processing:    { label: "Processing",     badge: "bg-sky-100 text-sky-700",       icon: Clock },
  in_production: { label: "In Production",  badge: "bg-violet-100 text-violet-700", icon: Package },
  in_transit:    { label: "In Transit",     badge: "bg-indigo-100 text-indigo-700", icon: Truck },
  delivered:     { label: "Delivered",      badge: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  returned:      { label: "Returned",       badge: "bg-orange-100 text-orange-700", icon: AlertCircle },
  cancelled:     { label: "Cancelled",      badge: "bg-slate-100 text-slate-400",   icon: AlertCircle },
  error:         { label: "Error",          badge: "bg-red-100 text-red-700",       icon: AlertCircle },
};

const COMM_STATUS_COLOR: Record<string, string> = {
  pending:   "bg-slate-100 text-slate-500",
  queued:    "bg-slate-100 text-slate-600",
  sent:      "bg-sky-100 text-sky-700",
  delivered: "bg-emerald-100 text-emerald-700",
  opened:    "bg-teal-100 text-teal-700",
  clicked:   "bg-emerald-100 text-emerald-700",
  converted: "bg-violet-100 text-violet-700",
  bounced:   "bg-orange-100 text-orange-700",
  failed:    "bg-red-100 text-red-700",
};

const TEMPLATE_LABELS: Record<string, string> = {
  postcard_6x9: "6×9 Postcard",
  letter_6x9: "6×9 Letter",
  "letter_8.5x11": "8.5×11 Letter",
};

const CHANNEL_ICON: Record<string, React.ElementType> = {
  sms: MessageSquare,
  email: Mail,
  direct_mail: FileText,
};

export default async function DirectMailPage() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) redirect("/login");

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  const dealershipId = ud?.dealership_id ?? "";

  const { data: dealership } = await supabase
    .from("dealerships")
    .select("name")
    .eq("id", dealershipId)
    .single();

  const [customersRes, mailPiecesRes, scansRes, testMailsRes, commsRes] = await Promise.all([
    supabase.from("customers").select("*").eq("dealership_id", dealershipId).order("last_visit_date", { ascending: false }).limit(200),
    supabase.from("mail_pieces").select("*, customers (first_name, last_name)").eq("dealership_id", dealershipId).order("created_at", { ascending: false }).limit(50),
    supabase.from("mail_scans").select("id, scanned_at").eq("dealership_id", dealershipId).gte("scanned_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("mail_pieces").select("*, customers (first_name, last_name)").eq("dealership_id", dealershipId).eq("is_test", true).order("created_at", { ascending: false }).limit(5),
    supabase.from("communications").select("*, customers (first_name, last_name)").eq("dealership_id", dealershipId).in("channel", ["sms", "email"]).order("created_at", { ascending: false }).limit(50),
  ]);

  const customers = (customersRes.data ?? []) as Customer[];
  const mailPieces = (mailPiecesRes.data ?? []) as Array<MailPiece & { customers: { first_name: string; last_name: string } | null }>;
  const scansThisMonth = scansRes.data?.length ?? 0;
  const testMailPieces = (testMailsRes.data ?? []) as Array<MailPiece & { customers: { first_name: string; last_name: string } | null }>;
  const communications = (commsRes.data ?? []) as Array<{
    id: string;
    channel: "sms" | "email";
    status: string;
    subject: string | null;
    content: string;
    provider_id: string | null;
    sent_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    created_at: string;
    customers: { first_name: string; last_name: string } | null;
  }>;

  const sentThisMonth = mailPieces.filter((mp) => mp.created_at && new Date(mp.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length;
  const inTransitCount = mailPieces.filter((mp) => mp.status === "in_transit").length;
  const totalCostCents = mailPieces.reduce((s, mp) => s + (mp.cost_cents ?? 0), 0);
  const customersWithAddress = customers.filter((c) => c.address?.street && c.address?.city && c.address?.state);
  const smsSent = communications.filter((c) => c.channel === "sms").length;
  const emailSent = communications.filter((c) => c.channel === "email").length;

  const stats = [
    { title: "Mail Sent (30d)", value: sentThisMonth, icon: Send, iconBg: "bg-indigo-50", iconColor: "text-indigo-600" },
    { title: "In Transit", value: inTransitCount, icon: Truck, iconBg: "bg-violet-50", iconColor: "text-violet-600" },
    { title: "QR Scans (30d)", value: scansThisMonth, icon: ScanLine, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { title: "Mail Spend", value: `$${(totalCostCents / 100).toFixed(0)}`, icon: DollarSign, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  ];

  const isTestMode = process.env.POSTGRID_API_KEY?.startsWith("test_");

  return (
    <>
      <Header
        title="Direct Mail"
        subtitle={`${customersWithAddress.length} customers with addresses · ${smsSent} SMS · ${emailSent} emails`}
        userEmail={user.email}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1400px]">

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.title} className="card-lift bg-white rounded-xl border border-slate-200 shadow-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                  <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</p>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">{s.title}</p>
            </div>
          ))}
        </div>

        {/* PostGrid status */}
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${isTestMode ? "bg-sky-50 border-sky-200 text-sky-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
          <Info className={`w-4 h-4 mt-0.5 shrink-0 ${isTestMode ? "text-sky-500" : "text-emerald-500"}`} />
          <div className="text-xs leading-relaxed">
            <strong>PostGrid integration active.</strong>{" "}
            {isTestMode
              ? "TEST MODE — mail submitted to PostGrid but never printed or charged."
              : "LIVE MODE — mail pieces will be printed and mailed."}
            <span className={`block mt-1 ${isTestMode ? "text-sky-600" : "text-emerald-600"}`}>
              {customers.length - customersWithAddress.length} of {customers.length} customers have incomplete addresses and will be skipped.
            </span>
          </div>
        </div>

        {/* Recent Test Mails */}
        {testMailPieces.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">TEST</span>
              <h2 className="text-sm font-semibold text-slate-900">Recent Test Mails</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {testMailPieces.map((mp) => {
                const cfg = STATUS_CONFIG[mp.status] ?? STATUS_CONFIG.pending;
                const StatusIcon = cfg.icon;
                const customer = mp.customers;
                return (
                  <div key={mp.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{customer ? `${customer.first_name} ${customer.last_name}` : "—"}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {TEMPLATE_LABELS[mp.template_type] ?? mp.template_type}
                        {mp.postgrid_mail_id && <span className="font-mono ml-2">· {mp.postgrid_mail_id.slice(0, 16)}…</span>}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      <StatusIcon className="w-3 h-3" />{cfg.label}
                    </span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{formatRelativeDate(mp.created_at)}</span>
                    {mp.qr_code_url && (
                      <a href={mp.qr_code_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                        Track →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main tabs */}
        <Tabs defaultValue="builder">
          <TabsList>
            <TabsTrigger value="builder">
              <Send className="w-3.5 h-3.5 mr-1.5" />Campaign Builder
            </TabsTrigger>
            <TabsTrigger value="history">
              <FileText className="w-3.5 h-3.5 mr-1.5" />Mail History ({mailPieces.length})
            </TabsTrigger>
            <TabsTrigger value="communications">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />SMS &amp; Email ({communications.length})
            </TabsTrigger>
          </TabsList>

          {/* Campaign Builder */}
          <TabsContent value="builder" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Campaign Builder</h2>
                <p className="text-xs text-slate-400 mt-0.5">Configure and launch your direct mail, SMS, or email campaign.</p>
              </div>
              <div className="p-6">
                <CampaignBuilder
                  customers={customers}
                  dealershipName={dealership?.name ?? "Your Dealership"}
                />
              </div>
            </div>
          </TabsContent>

          {/* Mail History */}
          <TabsContent value="history" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Mail Piece History</h2>
                  {mailPieces.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {mailPieces.filter((mp) => mp.scanned_count > 0).length} of {mailPieces.length} pieces scanned
                    </p>
                  )}
                </div>
                <LearnButton mailPieceIds={mailPieces.map((mp) => mp.id)} label="Learn from History" />
              </div>

              {mailPieces.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">No mail pieces sent yet</p>
                  <p className="text-xs text-slate-400">Use the Campaign Builder to send your first piece.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        {["Recipient", "Template", "Status", "PostGrid ID", "Scans", "Cost", "Sent", "Est. Delivery"].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {mailPieces.map((mp) => {
                        const cfg = STATUS_CONFIG[mp.status] ?? STATUS_CONFIG.pending;
                        const StatusIcon = cfg.icon;
                        const customer = mp.customers;
                        return (
                          <tr key={mp.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-slate-900">{customer ? `${customer.first_name} ${customer.last_name}` : "—"}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{mp.id.slice(0, 8)}…</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                                {TEMPLATE_LABELS[mp.template_type] ?? mp.template_type}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                <StatusIcon className="w-3 h-3" />{cfg.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                              {mp.postgrid_mail_id ? <span title={mp.postgrid_mail_id}>{mp.postgrid_mail_id.slice(0, 12)}…</span> : "—"}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1 text-xs text-slate-700">
                                <ScanLine className="w-3.5 h-3.5 text-slate-400" />
                                {mp.scanned_count}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-xs font-medium text-slate-900">
                              {mp.cost_cents ? `$${(mp.cost_cents / 100).toFixed(2)}` : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{formatRelativeDate(mp.sent_at ?? mp.created_at)}</td>
                            <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                              {mp.estimated_delivery ? formatDate(mp.estimated_delivery, { month: "short", day: "numeric" }) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* SMS & Email */}
          <TabsContent value="communications" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">SMS &amp; Email History</h2>
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-violet-500" />
                    {smsSent} SMS
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-sky-500" />
                    {emailSent} Email
                  </span>
                </div>
              </div>

              {communications.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">No messages sent yet</p>
                  <p className="text-xs text-slate-400">Select SMS or Email in the Campaign Builder to send your first message.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        {["Recipient", "Channel", "Subject / Message", "Status", "Provider ID", "Sent"].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {communications.map((comm) => {
                        const ChanIcon = CHANNEL_ICON[comm.channel] ?? MessageSquare;
                        const customer = comm.customers;
                        const statusColor = COMM_STATUS_COLOR[comm.status] ?? "bg-slate-100 text-slate-500";
                        const preview = comm.channel === "email"
                          ? comm.subject ?? comm.content.replace(/<[^>]+>/g, "").slice(0, 80)
                          : comm.content.slice(0, 80);
                        return (
                          <tr key={comm.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-slate-900">{customer ? `${customer.first_name} ${customer.last_name}` : "—"}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{comm.id.slice(0, 8)}…</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${comm.channel === "sms" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>
                                <ChanIcon className="w-3 h-3" />
                                {comm.channel.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 max-w-[240px]">
                              <p className="text-xs text-slate-600 truncate">{preview || "—"}</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="space-y-0.5">
                                <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                                  {comm.status}
                                </span>
                                {comm.opened_at && (
                                  <p className="text-[10px] text-teal-600">Opened {formatRelativeDate(comm.opened_at)}</p>
                                )}
                                {comm.clicked_at && (
                                  <p className="text-[10px] text-emerald-600">Clicked {formatRelativeDate(comm.clicked_at)}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                              {comm.provider_id ? <span title={comm.provider_id}>{comm.provider_id.slice(0, 14)}…</span> : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                              {formatRelativeDate(comm.sent_at ?? comm.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
