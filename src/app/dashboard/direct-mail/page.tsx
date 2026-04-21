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

const STATUS_CONFIG: Record<MailPieceStatus, { label: string; chip: string; icon: React.ElementType }> = {
  pending:       { label: "Pending",       chip: "chip chip-slate",   icon: Clock },
  processing:    { label: "Processing",    chip: "chip chip-sky",     icon: Clock },
  in_production: { label: "In Production", chip: "chip chip-violet",  icon: Package },
  in_transit:    { label: "In Transit",    chip: "chip chip-indigo",  icon: Truck },
  delivered:     { label: "Delivered",     chip: "chip chip-emerald", icon: CheckCircle },
  returned:      { label: "Returned",      chip: "chip chip-amber",   icon: AlertCircle },
  cancelled:     { label: "Cancelled",     chip: "chip chip-slate",   icon: AlertCircle },
  error:         { label: "Error",         chip: "chip chip-rose",    icon: AlertCircle },
};

const COMM_CHIP: Record<string, string> = {
  pending:   "chip chip-slate",
  queued:    "chip chip-slate",
  sent:      "chip chip-sky",
  delivered: "chip chip-emerald",
  opened:    "chip chip-emerald",
  clicked:   "chip chip-emerald",
  converted: "chip chip-violet",
  bounced:   "chip chip-amber",
  failed:    "chip chip-rose",
};

const TEMPLATE_LABELS: Record<string, string> = {
  postcard_6x9:    "6×9 Postcard",
  letter_6x9:      "6×9 Letter",
  "letter_8.5x11": "8.5×11 Letter",
};

const CHANNEL_ICON: Record<string, React.ElementType> = {
  sms:         MessageSquare,
  email:       Mail,
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

  const customers       = (customersRes.data ?? []) as Customer[];
  const mailPieces      = (mailPiecesRes.data ?? []) as Array<MailPiece & { customers: { first_name: string; last_name: string } | null }>;
  const scansThisMonth  = scansRes.data?.length ?? 0;
  const testMailPieces  = (testMailsRes.data ?? []) as Array<MailPiece & { customers: { first_name: string; last_name: string } | null }>;
  const communications  = (commsRes.data ?? []) as Array<{
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

  const sentThisMonth          = mailPieces.filter((mp) => mp.created_at && new Date(mp.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length;
  const inTransitCount         = mailPieces.filter((mp) => mp.status === "in_transit").length;
  const totalCostCents         = mailPieces.reduce((s, mp) => s + (mp.cost_cents ?? 0), 0);
  const customersWithAddress   = customers.filter((c) => c.address?.street && c.address?.city && c.address?.state);
  const smsSent                = communications.filter((c) => c.channel === "sms").length;
  const emailSent              = communications.filter((c) => c.channel === "email").length;
  const isTestMode             = process.env.POSTGRID_API_KEY?.startsWith("test_");

  const stats = [
    { title: "Mail Sent (30d)", value: sentThisMonth,                             icon: Send,       iconBg: "bg-indigo-50",  iconColor: "text-indigo-600",  accent: "stat-card-indigo" },
    { title: "In Transit",      value: inTransitCount,                            icon: Truck,      iconBg: "bg-violet-50",  iconColor: "text-violet-600",  accent: "stat-card-violet" },
    { title: "QR Scans (30d)", value: scansThisMonth,                            icon: ScanLine,   iconBg: "bg-emerald-50", iconColor: "text-emerald-600", accent: "stat-card-emerald" },
    { title: "Mail Spend",      value: `$${(totalCostCents / 100).toFixed(0)}`,  icon: DollarSign, iconBg: "bg-amber-50",   iconColor: "text-amber-600",   accent: "stat-card-amber" },
  ];

  return (
    <>
      <Header
        title="Direct Mail"
        subtitle={`${customersWithAddress.length} customers with addresses · ${smsSent} SMS · ${emailSent} emails`}
        userEmail={user.email}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">

        {/* ── Stats ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.title} className={`stat-card ${s.accent} card-lift`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                  <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                </div>
              </div>
              <div className="metric-value">{s.value}</div>
              <div className="metric-label">{s.title}</div>
            </div>
          ))}
        </div>

        {/* ── PostGrid status banner ────────────────────────── */}
        <div
          className="flex items-start gap-3 p-4 rounded-[var(--radius)] border"
          style={isTestMode
            ? { background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }
            : { background: "#ECFDF5", borderColor: "#A7F3D0", color: "#065F46" }
          }
        >
          <Info className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
          <div className="text-xs leading-relaxed flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <strong>PostGrid integration active.</strong>
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={isTestMode
                  ? { background: "#DBEAFE", color: "#1D4ED8" }
                  : { background: "#D1FAE5", color: "#047857" }
                }
              >
                {isTestMode ? "TEST MODE" : "LIVE MODE"}
              </span>
            </div>
            <span className="opacity-80">
              {isTestMode
                ? "Mail submitted to PostGrid but never printed or charged."
                : "Mail pieces will be printed and mailed via USPS First Class."}
            </span>
            {customers.length - customersWithAddress.length > 0 && (
              <span className="block mt-1 opacity-65">
                {customers.length - customersWithAddress.length} of {customers.length} customers have incomplete addresses and will be skipped.
              </span>
            )}
          </div>
        </div>

        {/* ── Recent Test Mails ─────────────────────────────── */}
        {testMailPieces.length > 0 && (
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div className="flex items-center gap-2">
                <span className="chip chip-indigo">TEST</span>
                <span className="inst-panel-title">Recent Test Mails</span>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {testMailPieces.map((mp) => {
                const cfg = STATUS_CONFIG[mp.status] ?? STATUS_CONFIG.pending;
                const StatusIcon = cfg.icon;
                const customer = mp.customers;
                return (
                  <div key={mp.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{customer ? `${customer.first_name} ${customer.last_name}` : "—"}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {TEMPLATE_LABELS[mp.template_type] ?? mp.template_type}
                        {mp.postgrid_mail_id && <span className="font-mono ml-2 opacity-60">· {mp.postgrid_mail_id.slice(0, 16)}…</span>}
                      </p>
                    </div>
                    <span className={cfg.chip}>
                      <StatusIcon className="w-3 h-3" />{cfg.label}
                    </span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{formatRelativeDate(mp.created_at)}</span>
                    {mp.qr_code_url && (
                      <a href={mp.qr_code_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors whitespace-nowrap">
                        Track →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Main tabs ─────────────────────────────────────── */}
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
            <div className="inst-panel">
              <div className="inst-panel-header">
                <div>
                  <div className="inst-panel-title">Campaign Builder</div>
                  <div className="inst-panel-subtitle">Configure and launch your direct mail, SMS, or email campaign.</div>
                </div>
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
            <div className="inst-panel">
              <div className="inst-panel-header">
                <div>
                  <div className="inst-panel-title">Mail Piece History</div>
                  {mailPieces.length > 0 && (
                    <div className="inst-panel-subtitle">
                      {mailPieces.filter((mp) => mp.scanned_count > 0).length} of {mailPieces.length} pieces scanned
                    </div>
                  )}
                </div>
                <LearnButton mailPieceIds={mailPieces.map((mp) => mp.id)} label="Learn from History" />
              </div>

              {mailPieces.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <FileText className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">No mail pieces sent yet</p>
                  <p className="text-xs text-slate-400">Use the Campaign Builder tab to send your first piece.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #F1F5F9", background: "#FAFBFC" }}>
                        {["Recipient", "Template", "Status", "PostGrid ID", "Scans", "Cost", "Sent", "Est. Delivery"].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mailPieces.map((mp) => {
                        const cfg = STATUS_CONFIG[mp.status] ?? STATUS_CONFIG.pending;
                        const StatusIcon = cfg.icon;
                        const customer = mp.customers;
                        return (
                          <tr
                            key={mp.id}
                            className="hover:bg-slate-50/60 transition-colors"
                            style={{ borderBottom: "1px solid #F8FAFC" }}
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-slate-900 text-[13px]">{customer ? `${customer.first_name} ${customer.last_name}` : "—"}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{mp.id.slice(0, 8)}…</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="chip chip-slate">
                                {TEMPLATE_LABELS[mp.template_type] ?? mp.template_type}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={cfg.chip}>
                                <StatusIcon className="w-3 h-3" />{cfg.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                              {mp.postgrid_mail_id ? <span title={mp.postgrid_mail_id}>{mp.postgrid_mail_id.slice(0, 12)}…</span> : "—"}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1 text-[12px] text-slate-700 font-medium">
                                <ScanLine className="w-3.5 h-3.5 text-slate-400" />
                                {mp.scanned_count}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-900">
                              {mp.cost_cents ? `$${(mp.cost_cents / 100).toFixed(2)}` : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-[11px] text-slate-400 whitespace-nowrap">{formatRelativeDate(mp.sent_at ?? mp.created_at)}</td>
                            <td className="px-5 py-3.5 text-[11px] text-slate-400 whitespace-nowrap">
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
            <div className="inst-panel">
              <div className="inst-panel-header">
                <div>
                  <div className="inst-panel-title">SMS &amp; Email History</div>
                  <div className="inst-panel-subtitle">{smsSent} SMS · {emailSent} email messages</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MessageSquare className="w-3.5 h-3.5 text-violet-500" />
                    {smsSent} SMS
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-sky-500" />
                    {emailSent} Email
                  </span>
                </div>
              </div>

              {communications.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <MessageSquare className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">No messages sent yet</p>
                  <p className="text-xs text-slate-400">Select SMS or Email in the Campaign Builder to send your first message.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #F1F5F9", background: "#FAFBFC" }}>
                        {["Recipient", "Channel", "Subject / Message", "Status", "Provider ID", "Sent"].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {communications.map((comm) => {
                        const ChanIcon = CHANNEL_ICON[comm.channel] ?? MessageSquare;
                        const customer = comm.customers;
                        const chipClass = COMM_CHIP[comm.status] ?? "chip chip-slate";
                        const preview = comm.channel === "email"
                          ? comm.subject ?? comm.content.replace(/<[^>]+>/g, "").slice(0, 80)
                          : comm.content.slice(0, 80);
                        return (
                          <tr
                            key={comm.id}
                            className="hover:bg-slate-50/60 transition-colors"
                            style={{ borderBottom: "1px solid #F8FAFC" }}
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-slate-900 text-[13px]">{customer ? `${customer.first_name} ${customer.last_name}` : "—"}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{comm.id.slice(0, 8)}…</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={comm.channel === "sms" ? "chip chip-violet" : "chip chip-sky"}>
                                <ChanIcon className="w-3 h-3" />
                                {comm.channel.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 max-w-[240px]">
                              <p className="text-[12px] text-slate-600 truncate">{preview || "—"}</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="space-y-0.5">
                                <span className={chipClass}>{comm.status}</span>
                                {comm.opened_at && (
                                  <p className="text-[10px] text-emerald-600 font-medium">Opened {formatRelativeDate(comm.opened_at)}</p>
                                )}
                                {comm.clicked_at && (
                                  <p className="text-[10px] text-emerald-600 font-medium">Clicked {formatRelativeDate(comm.clicked_at)}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                              {comm.provider_id ? <span title={comm.provider_id}>{comm.provider_id.slice(0, 14)}…</span> : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-[11px] text-slate-400 whitespace-nowrap">
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
