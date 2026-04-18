import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignBuilder } from "@/components/direct-mail/campaign-builder";
import { LearnButton } from "@/components/direct-mail/learn-button";
import {
  FileText, Send, Truck, ScanLine, DollarSign,
  Clock, CheckCircle, AlertCircle, Package, MessageSquare, Mail,
} from "lucide-react";
import { formatDate, formatRelativeDate } from "@/lib/utils";
import type { Customer, MailPiece, MailPieceStatus } from "@/types";

export const metadata = { title: "Direct Mail" };

const STATUS_CONFIG: Record<MailPieceStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:       { label: "Pending",        color: "bg-gray-100 text-gray-700",    icon: Clock },
  processing:    { label: "Processing",     color: "bg-blue-100 text-blue-700",    icon: Clock },
  in_production: { label: "In Production",  color: "bg-purple-100 text-purple-700", icon: Package },
  in_transit:    { label: "In Transit",     color: "bg-indigo-100 text-indigo-700", icon: Truck },
  delivered:     { label: "Delivered",      color: "bg-green-100 text-green-700",  icon: CheckCircle },
  returned:      { label: "Returned",       color: "bg-orange-100 text-orange-700", icon: AlertCircle },
  cancelled:     { label: "Cancelled",      color: "bg-gray-100 text-gray-500",    icon: AlertCircle },
  error:         { label: "Error",          color: "bg-red-100 text-red-700",      icon: AlertCircle },
};

const COMM_STATUS_COLOR: Record<string, string> = {
  pending:   "bg-gray-100 text-gray-600",
  queued:    "bg-slate-100 text-slate-600",
  sent:      "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  opened:    "bg-teal-100 text-teal-700",
  clicked:   "bg-emerald-100 text-emerald-700",
  converted: "bg-purple-100 text-purple-700",
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
    supabase
      .from("customers")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("last_visit_date", { ascending: false })
      .limit(200),

    supabase
      .from("mail_pieces")
      .select("*, customers (first_name, last_name)")
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("mail_scans")
      .select("id, scanned_at")
      .eq("dealership_id", dealershipId)
      .gte("scanned_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

    supabase
      .from("mail_pieces")
      .select("*, customers (first_name, last_name)")
      .eq("dealership_id", dealershipId)
      .eq("is_test", true)
      .order("created_at", { ascending: false })
      .limit(5),

    // SMS + Email communications (last 90d)
    supabase
      .from("communications")
      .select("*, customers (first_name, last_name)")
      .eq("dealership_id", dealershipId)
      .in("channel", ["sms", "email"])
      .order("created_at", { ascending: false })
      .limit(50),
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

  const sentThisMonth = mailPieces.filter(
    (mp) => mp.created_at && new Date(mp.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;
  const deliveredCount = mailPieces.filter((mp) => mp.status === "delivered").length;
  const inTransitCount = mailPieces.filter((mp) => mp.status === "in_transit").length;
  const totalCostCents = mailPieces.reduce((s, mp) => s + (mp.cost_cents ?? 0), 0);
  const customersWithAddress = customers.filter((c) => c.address?.street && c.address?.city && c.address?.state);

  const smsSent = communications.filter((c) => c.channel === "sms").length;
  const emailSent = communications.filter((c) => c.channel === "email").length;

  const stats = [
    { title: "Mail Sent (30d)", value: sentThisMonth, icon: Send, color: "text-blue-600 bg-blue-50" },
    { title: "In Transit", value: inTransitCount, icon: Truck, color: "text-purple-600 bg-purple-50" },
    { title: "QR Scans (30d)", value: scansThisMonth, icon: ScanLine, color: "text-green-600 bg-green-50" },
    { title: "Mail Spend", value: `$${(totalCostCents / 100).toFixed(0)}`, icon: DollarSign, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <>
      <Header
        title="Campaigns"
        subtitle={`${customersWithAddress.length} customers with addresses · ${smsSent} SMS sent · ${emailSent} emails sent`}
        userEmail={user.email}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.title} className="border-0 shadow-sm">
              <CardContent className="p-5 flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* PostGrid status notice */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <FileText className="w-5 h-5 mt-0.5 shrink-0 text-blue-600" />
          <div>
            <strong>PostGrid integration active.</strong>{" "}
            {process.env.POSTGRID_API_KEY?.startsWith("test_")
              ? "TEST MODE — mail submitted to PostGrid but never printed or charged."
              : "LIVE MODE — mail pieces will be printed and mailed."}
            {" "}Configure in <code>.env.local</code>.
            <br />
            <span className="text-blue-600">
              {customers.length - customersWithAddress.length} of {customers.length} customers have incomplete addresses and will be skipped for direct mail.
            </span>
          </div>
        </div>

        {/* Recent Test Mails */}
        {testMailPieces.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-medium">Test</span>
                Recent Test Mails
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {testMailPieces.map((mp) => {
                  const cfg = STATUS_CONFIG[mp.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  const customer = mp.customers;
                  return (
                    <div key={mp.id} className="px-5 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {customer ? `${customer.first_name} ${customer.last_name}` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {TEMPLATE_LABELS[mp.template_type] ?? mp.template_type}
                          {mp.postgrid_mail_id && <span className="font-mono ml-2">· {mp.postgrid_mail_id.slice(0, 16)}…</span>}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />{cfg.label}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeDate(mp.created_at)}</span>
                      {mp.qr_code_url && (
                        <a href={mp.qr_code_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline whitespace-nowrap">
                          Track
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
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
            <CampaignBuilder
              customers={customers}
              dealershipName={dealership?.name ?? "Your Dealership"}
            />
          </TabsContent>

          {/* Mail History */}
          <TabsContent value="history" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Mail Piece History</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {mailPieces.length > 0
                        ? `${mailPieces.filter(mp => mp.scanned_count > 0).length} of ${mailPieces.length} scanned`
                        : null}
                    </span>
                    <LearnButton
                      mailPieceIds={mailPieces.map((mp) => mp.id)}
                      label="Learn from History"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {mailPieces.length === 0 ? (
                  <div className="py-16 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No mail pieces sent yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Use the Campaign Builder to send your first piece.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50/50">
                          {["Recipient", "Template", "Status", "PostGrid ID", "Scans", "Cost", "Sent", "Est. Delivery"].map((h) => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {mailPieces.map((mp) => {
                          const cfg = STATUS_CONFIG[mp.status] ?? STATUS_CONFIG.pending;
                          const StatusIcon = cfg.icon;
                          const customer = mp.customers;
                          return (
                            <tr key={mp.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-5 py-3">
                                <p className="font-medium text-gray-900">{customer ? `${customer.first_name} ${customer.last_name}` : "—"}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{mp.id.slice(0, 8)}…</p>
                              </td>
                              <td className="px-5 py-3">
                                <Badge variant="secondary" className="text-[10px] font-normal whitespace-nowrap">
                                  {TEMPLATE_LABELS[mp.template_type] ?? mp.template_type}
                                </Badge>
                              </td>
                              <td className="px-5 py-3">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                                  <StatusIcon className="w-3 h-3" />{cfg.label}
                                </span>
                              </td>
                              <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                                {mp.postgrid_mail_id ? <span title={mp.postgrid_mail_id}>{mp.postgrid_mail_id.slice(0, 12)}…</span> : "—"}
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1 text-sm">
                                  <ScanLine className="w-3.5 h-3.5 text-muted-foreground" />{mp.scanned_count}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-sm">{mp.cost_cents ? `$${(mp.cost_cents / 100).toFixed(2)}` : "—"}</td>
                              <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatRelativeDate(mp.sent_at ?? mp.created_at)}</td>
                              <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                {mp.estimated_delivery ? formatDate(mp.estimated_delivery, { month: "short", day: "numeric" }) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMS & Email Communications */}
          <TabsContent value="communications" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">SMS &amp; Email History</CardTitle>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                      {smsSent} SMS
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-blue-500" />
                      {emailSent} Email
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {communications.length === 0 ? (
                  <div className="py-16 text-center">
                    <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No SMS or email messages sent yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select <strong>SMS</strong> or <strong>Email</strong> in the Campaign Builder to send your first message.
                    </p>
                    {!process.env.TWILIO_PHONE_NUMBER && (
                      <p className="text-xs text-amber-600 mt-2">
                        Add Twilio credentials to .env.local to enable SMS sending.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50/50">
                          {["Recipient", "Channel", "Subject / Message", "Status", "Provider ID", "Sent"].map((h) => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {communications.map((comm) => {
                          const ChanIcon = CHANNEL_ICON[comm.channel] ?? MessageSquare;
                          const customer = comm.customers;
                          const statusColor = COMM_STATUS_COLOR[comm.status] ?? "bg-gray-100 text-gray-600";
                          const preview = comm.channel === "email"
                            ? comm.subject ?? comm.content.replace(/<[^>]+>/g, "").slice(0, 80)
                            : comm.content.slice(0, 80);
                          return (
                            <tr key={comm.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-5 py-3">
                                <p className="font-medium text-gray-900">{customer ? `${customer.first_name} ${customer.last_name}` : "—"}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{comm.id.slice(0, 8)}…</p>
                              </td>
                              <td className="px-5 py-3">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${comm.channel === "sms" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                  <ChanIcon className="w-3 h-3" />
                                  {comm.channel.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-5 py-3 max-w-[240px]">
                                <p className="text-xs text-gray-700 truncate" title={preview}>{preview || "—"}</p>
                              </td>
                              <td className="px-5 py-3">
                                <div className="space-y-0.5">
                                  <span className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
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
                              <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                                {comm.provider_id ? <span title={comm.provider_id}>{comm.provider_id.slice(0, 14)}…</span> : "—"}
                              </td>
                              <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                {formatRelativeDate(comm.sent_at ?? comm.created_at)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
