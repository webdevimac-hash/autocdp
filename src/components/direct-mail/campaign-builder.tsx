"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TemplatePreview } from "./template-preview";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Send, Loader2, CheckCircle, AlertCircle,
  ChevronRight, RefreshCw, Zap, Eye, FlaskConical,
  ExternalLink, Mail, MessageSquare, Layers, Phone,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer, MailTemplateType } from "@/types";

// ── Channel config ────────────────────────────────────────────

type BuilderChannel = "direct_mail" | "sms" | "email" | "multi_channel";

const CHANNEL_CONFIG: Record<BuilderChannel, {
  label: string;
  icon: React.ElementType;
  description: string;
  cost: string;
  best: string;
  color: string;
  activeColor: string;
}> = {
  direct_mail: {
    label: "Direct Mail",
    icon: FileText,
    description: "Physical postcard or letter via PostGrid. QR tracking included.",
    cost: "~$1.20–$1.60 / piece",
    best: "Lapsed customers, VIP appreciation",
    color: "border-blue-200 hover:border-blue-400",
    activeColor: "border-blue-600 bg-blue-50",
  },
  sms: {
    label: "SMS",
    icon: MessageSquare,
    description: "Personalized text message via Twilio. 98% open rate.",
    cost: "~$0.02 / message",
    best: "Urgent offers, appointment reminders",
    color: "border-purple-200 hover:border-purple-400",
    activeColor: "border-purple-600 bg-purple-50",
  },
  email: {
    label: "Email",
    icon: Mail,
    description: "HTML email with personalized subject + body via Resend.",
    cost: "Included in plan",
    best: "Newsletters, detailed offers, follow-ups",
    color: "border-green-200 hover:border-green-400",
    activeColor: "border-green-600 bg-green-50",
  },
  multi_channel: {
    label: "All Channels",
    icon: Layers,
    description: "Claude picks the best channel per customer (mail + SMS + email).",
    cost: "Variable",
    best: "Re-engagement campaigns, max reach",
    color: "border-amber-200 hover:border-amber-400",
    activeColor: "border-amber-600 bg-amber-50",
  },
};

// ── Mail templates ────────────────────────────────────────────

const MAIL_TEMPLATES: Array<{
  type: MailTemplateType;
  label: string;
  cost: string;
  best: string;
  description: string;
}> = [
  {
    type: "postcard_6x9",
    label: "6×9 Postcard",
    cost: "~$1.20",
    best: "Reactivation, reminders",
    description: "High open rates — no envelope. Handwritten front with QR tracking.",
  },
  {
    type: "letter_6x9",
    label: "6×9 Letter",
    cost: "~$1.40",
    best: "VIP appreciation",
    description: "Self-mailer letter. More premium feel than a postcard.",
  },
  {
    type: "letter_8.5x11",
    label: "8.5×11 Letter",
    cost: "~$1.60",
    best: "Recalls, warranties",
    description: "Full-page letter in envelope. Best for formal communications.",
  },
];

// ── Lifecycle badge colors ────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  vip: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  at_risk: "bg-orange-100 text-orange-800",
  lapsed: "bg-red-100 text-red-800",
  prospect: "bg-gray-100 text-gray-700",
};

// ── Step indicator ────────────────────────────────────────────

function StepIndicator({ step, current, label }: { step: number; current: number; label: string }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all",
        done ? "bg-green-500 text-white" : active ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
      )}>
        {done ? <CheckCircle className="w-3.5 h-3.5" /> : step}
      </div>
      <span className={cn(
        "text-xs font-medium",
        active ? "text-brand-700" : done ? "text-green-700" : "text-muted-foreground"
      )}>
        {label}
      </span>
    </div>
  );
}

// ── SMS preview bubble ────────────────────────────────────────

function SmsPreview({ message, dealershipName }: { message: string; dealershipName: string }) {
  const chars = message.length;
  const overLimit = chars > 160;
  return (
    <div className="mx-auto max-w-xs">
      <div className="bg-slate-100 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-white text-[9px] font-bold">
            {dealershipName.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-medium text-slate-700">{dealershipName}</span>
        </div>
        <div className="bg-white rounded-xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>
        <div className={cn("text-right text-[10px]", overLimit ? "text-red-500 font-semibold" : "text-slate-400")}>
          {chars}/160 chars{overLimit ? " — too long" : ""}
        </div>
      </div>
    </div>
  );
}

// ── Email preview card ────────────────────────────────────────

function EmailPreview({ subject, body, dealershipName }: { subject: string | null; body: string; dealershipName: string }) {
  return (
    <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Mock email header */}
      <div className="bg-slate-50 border-b px-4 py-3 space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground w-10">From:</span>
          <span className="font-medium text-gray-700">{dealershipName} &lt;hello@dealership.com&gt;</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground w-10">Subject:</span>
          <span className="font-medium text-gray-900">{subject || "(no subject)"}</span>
        </div>
      </div>
      {/* Body — render as plain text or sanitized HTML */}
      <div className="p-5 text-sm text-gray-700 leading-relaxed max-h-72 overflow-y-auto">
        {body.includes("<") ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <p className="whitespace-pre-wrap">{body}</p>
        )}
      </div>
    </div>
  );
}

// ── Send result shape ─────────────────────────────────────────

interface ChannelResult {
  customerId: string;
  customerName: string;
  channel: string;
  success: boolean;
  communicationId?: string;
  mailPieceId?: string;
  result?: {
    postgrid_id?: string;
    tracking_url?: string;
    estimated_delivery?: string;
    provider_id?: string;
  };
  message: string;
  error?: string;
  generatedCopy?: string;
}

// ── Main component ────────────────────────────────────────────

interface CampaignBuilderProps {
  customers: Customer[];
  dealershipName: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function CampaignBuilder({ customers, dealershipName }: CampaignBuilderProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Step 1
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [filterStage, setFilterStage] = useState<string>("all");

  // Step 2
  const [channel, setChannel] = useState<BuilderChannel>("direct_mail");
  const [templateType, setTemplateType] = useState<MailTemplateType>("postcard_6x9");

  // Step 3 + 4
  const [campaignGoal, setCampaignGoal] = useState(
    "Win back customers who haven't visited in 6–18 months with a personalized service reminder and discount offer."
  );
  const [previewCustomerId, setPreviewCustomerId] = useState<string>("");
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    content: string;
    subject: string | null;
    smsBody: string | null;
    reasoning: string;
    confidence: number;
    previewQrUrl: string | null;
    vehicle: string | null;
    channel: BuilderChannel;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Step 5
  const [sending, setSending] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [sendResults, setSendResults] = useState<ChannelResult[] | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // ── Send Test Mail panel (direct mail only) ───────────────
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testCustomerId, setTestCustomerId] = useState<string>("");
  const [testTemplateType, setTestTemplateType] = useState<MailTemplateType>("postcard_6x9");
  const [testGoal, setTestGoal] = useState("Win back this customer with a personalized service reminder and special offer.");
  const [testLoading, setTestLoading] = useState(false);
  const [testPreview, setTestPreview] = useState<{ content: string; previewQrUrl: string | null; vehicle: string | null; reasoning: string } | null>(null);
  const [testLiveResult, setTestLiveResult] = useState<ChannelResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function runTestPreview() {
    const targetId = testCustomerId || customers[0]?.id;
    if (!targetId) return;
    setTestLoading(true);
    setTestError(null);
    setTestPreview(null);
    setTestLiveResult(null);
    try {
      const res = await fetch("/api/mail/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: targetId, templateType: testTemplateType, campaignGoal: testGoal, channel: "direct_mail" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setTestPreview({ content: data.content, previewQrUrl: data.previewQrUrl, vehicle: data.vehicle, reasoning: data.reasoning });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTestLoading(false);
    }
  }

  async function sendTestLive() {
    const targetId = testCustomerId || customers[0]?.id;
    if (!targetId || !testPreview) return;
    setTestLoading(true);
    setTestError(null);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: [targetId], templateType: testTemplateType, campaignGoal: testGoal, dryRun: false, isTest: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      const r = data.results?.[0];
      if (r) {
        setTestLiveResult(r);
        if (r.result?.success) {
          toast({ title: "Mail piece sent to PostGrid", description: r.result.postgrid_id ? `ID: ${r.result.postgrid_id}` : r.result.message });
        }
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTestLoading(false);
    }
  }

  // ── Step 1 helpers ─────────────────────────────────────────

  const filteredCustomers = customers.filter(
    (c) => filterStage === "all" || c.lifecycle_stage === filterStage
  );

  function toggleCustomer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectAll) { setSelectedIds(new Set()); setSelectAll(false); }
    else { setSelectedIds(new Set(filteredCustomers.map((c) => c.id))); setSelectAll(true); }
  }

  // ── Step 2 helpers ─────────────────────────────────────────

  const selectedCustomers = customers.filter((c) => selectedIds.has(c.id));
  const withPhone = selectedCustomers.filter((c) => !!c.phone).length;
  const withEmail = selectedCustomers.filter((c) => !!c.email).length;
  const withAddress = selectedCustomers.filter((c) => !!c.address?.street).length;

  // ── Step 3: Generate preview ───────────────────────────────

  const generatePreview = useCallback(async () => {
    const targetId = previewCustomerId
      || customers.find((c) => selectedIds.has(c.id))?.id
      || "";
    if (!targetId) return;

    setGeneratingPreview(true);
    setPreviewError(null);
    setPreviewResult(null);

    try {
      const res = await fetch("/api/mail/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: targetId,
          templateType: channel === "direct_mail" || channel === "multi_channel" ? templateType : undefined,
          campaignGoal,
          channel: channel === "multi_channel" ? "email" : channel, // preview first as email for multi
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");

      setPreviewResult({
        content: data.content,
        subject: data.subject ?? null,
        smsBody: data.smsBody ?? null,
        reasoning: data.reasoning,
        confidence: data.confidence,
        previewQrUrl: data.previewQrUrl ?? null,
        vehicle: data.vehicle ?? null,
        channel,
      });
      setCurrentStep(4);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGeneratingPreview(false);
    }
  }, [previewCustomerId, customers, selectedIds, templateType, campaignGoal, channel]);

  // ── Step 5: Send ───────────────────────────────────────────

  async function sendCampaign() {
    setSending(true);
    setSendError(null);
    setSendResults(null);

    try {
      const customerIds = Array.from(selectedIds);

      if (channel === "direct_mail") {
        const res = await fetch("/api/mail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerIds, templateType, campaignGoal, dryRun }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Send failed");

        // Normalize to ChannelResult shape
        setSendResults((data.results ?? []).map((r: {
          customerId: string;
          customerName: string;
          result: { success: boolean; mail_piece_id?: string; postgrid_id?: string; tracking_url?: string; estimated_delivery?: string; message: string; error?: string };
          generatedCopy?: string;
        }) => ({
          customerId: r.customerId,
          customerName: r.customerName,
          channel: "direct_mail",
          success: r.result.success,
          mailPieceId: r.result.mail_piece_id,
          result: {
            postgrid_id: r.result.postgrid_id,
            tracking_url: r.result.tracking_url,
            estimated_delivery: r.result.estimated_delivery,
          },
          message: r.result.message,
          error: r.result.error,
          generatedCopy: r.generatedCopy,
        })));
      } else {
        // SMS, Email, or Multi-Channel → omnichannel orchestrator
        const channelMap: Record<BuilderChannel, string[]> = {
          direct_mail: ["direct_mail"],
          sms: ["sms"],
          email: ["email"],
          multi_channel: ["multi_channel"],
        };
        const res = await fetch("/api/campaign/omnichannel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerIds,
            channels: channelMap[channel],
            campaignGoal,
            templateType,
            dryRun,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Send failed");
        setSendResults(data.results ?? []);
      }

      setCurrentStep(5);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }

  const selectedCount = selectedIds.size;
  const channelCfg = CHANNEL_CONFIG[channel];

  function estimateCost(): string {
    const n = selectedCount;
    if (channel === "direct_mail") return `$${(n * 1.2).toFixed(2)}`;
    if (channel === "sms") return `$${(n * 0.02).toFixed(2)}`;
    if (channel === "email") return "Free";
    return `~$${(n * 0.62).toFixed(2)}`;  // multi: mail + sms
  }

  const needsMailTemplate = channel === "direct_mail" || channel === "multi_channel";

  return (
    <div className="space-y-6">

      {/* ── Send Test Mail panel ── */}
      <Card className={cn("border-2 transition-all", testPanelOpen ? "border-brand-400 shadow-md" : "border-dashed border-brand-300 hover:border-brand-400")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-brand-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Send Test Mail</CardTitle>
                <CardDescription className="text-xs">Preview a single personalized mail piece end-to-end.</CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant={testPanelOpen ? "outline" : "default"}
              className="h-8 shrink-0"
              onClick={() => { setTestPanelOpen((o) => !o); setTestPreview(null); setTestLiveResult(null); setTestError(null); }}
            >
              {testPanelOpen ? "Close" : <><FlaskConical className="mr-1.5 w-3.5 h-3.5" />Send Test Mail</>}
            </Button>
          </div>
        </CardHeader>

        {testPanelOpen && (
          <CardContent className="space-y-4 pt-0">
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Test customer</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={testCustomerId}
                  onChange={(e) => { setTestCustomerId(e.target.value); setTestPreview(null); setTestLiveResult(null); }}
                >
                  {customers.slice(0, 30).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.lifecycle_stage}){!c.address?.street ? " — no address" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Template</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={testTemplateType}
                  onChange={(e) => { setTestTemplateType(e.target.value as MailTemplateType); setTestPreview(null); setTestLiveResult(null); }}
                >
                  <option value="postcard_6x9">6×9 Postcard (~$1.20)</option>
                  <option value="letter_6x9">6×9 Letter (~$1.40)</option>
                  <option value="letter_8.5x11">8.5×11 Letter (~$1.60)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Campaign goal</label>
              <textarea className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring h-16"
                value={testGoal} onChange={(e) => { setTestGoal(e.target.value); setTestPreview(null); setTestLiveResult(null); }} />
            </div>

            {testError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{testError}</p>
              </div>
            )}

            {!testPreview && !testLiveResult && (
              <Button onClick={runTestPreview} disabled={testLoading || customers.length === 0} className="w-full">
                {testLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Zap className="mr-2 h-4 w-4" />Generate AI Copy &amp; Preview</>}
              </Button>
            )}

            {testPreview && !testLiveResult && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  <strong>AI reasoning:</strong> {testPreview.reasoning}
                </div>
                <TemplatePreview templateType={testTemplateType} content={testPreview.content} dealershipName={dealershipName} vehicle={testPreview.vehicle} qrPreviewUrl={testPreview.previewQrUrl ?? undefined} />
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">
                    <strong>Send Live</strong> submits a real PostGrid job. With a <code>test_sk_…</code> key no mail is printed and there&apos;s no charge.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-9" onClick={runTestPreview} disabled={testLoading}>
                    <RefreshCw className="mr-1.5 w-3.5 h-3.5" />Regenerate
                  </Button>
                  <Button size="sm" className="flex-1 h-9 bg-green-600 hover:bg-green-700" onClick={sendTestLive} disabled={testLoading}>
                    {testLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send Live to PostGrid</>}
                  </Button>
                </div>
              </div>
            )}

            {testLiveResult && (
              <div className={cn("p-4 rounded-lg border", testLiveResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                <div className="flex items-start gap-2">
                  {testLiveResult.success ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", testLiveResult.success ? "text-green-800" : "text-red-800")}>
                      {testLiveResult.success ? "Mail piece sent to PostGrid" : "Send failed"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{testLiveResult.message}</p>
                    {testLiveResult.result?.postgrid_id && (
                      <p className="text-xs font-mono text-muted-foreground mt-1">ID: {testLiveResult.result.postgrid_id}</p>
                    )}
                    {testLiveResult.result?.tracking_url && (
                      <a href={testLiveResult.result.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1">
                        View tracking page <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="mt-3 h-7 text-xs"
                  onClick={() => { setTestPreview(null); setTestLiveResult(null); setTestError(null); }}>
                  Send another test
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Step indicators */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          [1, "Customers"], [2, "Channel"], [3, "Goal & Copy"],
          [4, "Preview"], [5, "Send"],
        ].map(([step, label], i, arr) => (
          <div key={step} className="flex items-center gap-2">
            <StepIndicator step={step as number} current={currentStep} label={label as string} />
            {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          </div>
        ))}
      </div>

      <Separator />

      {/* ── STEP 1: Customer Selection ── */}
      {currentStep >= 1 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                currentStep === 1 ? "bg-brand-600 text-white" : "bg-green-500 text-white")}>
                {currentStep > 1 ? <CheckCircle className="w-3.5 h-3.5" /> : "1"}
              </div>
              <CardTitle className="text-base">Select Customers</CardTitle>
              {selectedCount > 0 && <Badge className="ml-auto">{selectedCount} selected</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {["all", "lapsed", "at_risk", "active", "vip"].map((stage) => (
                <button key={stage} onClick={() => setFilterStage(stage)}
                  className={cn("text-xs px-2.5 py-1 rounded-full border transition-all capitalize",
                    filterStage === stage ? "bg-brand-600 text-white border-brand-600" : "border-gray-200 text-gray-600 hover:border-brand-400")}>
                  {stage === "at_risk" ? "At Risk" : stage === "all" ? "All" : stage}
                </button>
              ))}
              <button onClick={toggleSelectAll}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-brand-400 ml-auto">
                {selectAll ? "Deselect All" : `Select All (${filteredCustomers.length})`}
              </button>
            </div>

            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No customers match this filter.</div>
              ) : (
                filteredCustomers.slice(0, 20).map((customer) => (
                  <label key={customer.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selectedIds.has(customer.id)} onChange={() => toggleCustomer(customer.id)} className="rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{customer.first_name} {customer.last_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{customer.total_visits}v · ${customer.total_spend.toFixed(0)}</span>
                        {customer.phone && <span className="flex items-center gap-0.5 text-green-600"><Phone className="w-2.5 h-2.5" />SMS</span>}
                        {customer.email && <span className="flex items-center gap-0.5 text-blue-600"><AtSign className="w-2.5 h-2.5" />Email</span>}
                        {!customer.address?.street && <span className="text-amber-600">No address</span>}
                      </div>
                    </div>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium capitalize", STAGE_COLORS[customer.lifecycle_stage] ?? "bg-gray-100")}>
                      {customer.lifecycle_stage?.replace("_", " ")}
                    </span>
                  </label>
                ))
              )}
              {filteredCustomers.length > 20 && (
                <div className="px-4 py-2 text-xs text-muted-foreground bg-slate-50 text-center">
                  Showing 20 of {filteredCustomers.length} — use filters to narrow down
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-1">
              <p className="text-xs text-muted-foreground">
                {selectedCount > 0 ? (
                  <>{selectedCount} selected · <span className="text-green-600 font-medium">{withPhone} have phone</span> · <span className="text-blue-600 font-medium">{withEmail} have email</span> · {withAddress} have address</>
                ) : "Select customers to continue"}
              </p>
              <Button size="sm" className="h-8" disabled={selectedCount === 0} onClick={() => setCurrentStep(2)}>
                Next <ChevronRight className="ml-1 w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: Channel & Format ── */}
      {currentStep >= 2 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                currentStep === 2 ? "bg-brand-600 text-white" : currentStep > 2 ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500")}>
                {currentStep > 2 ? <CheckCircle className="w-3.5 h-3.5" /> : "2"}
              </div>
              <CardTitle className="text-base">Channel &amp; Format</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Channel selector */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(Object.entries(CHANNEL_CONFIG) as [BuilderChannel, typeof CHANNEL_CONFIG[BuilderChannel]][]).map(([ch, cfg]) => {
                const Icon = cfg.icon;
                const isActive = channel === ch;
                return (
                  <button key={ch} onClick={() => setChannel(ch)}
                    className={cn("text-left p-3.5 border-2 rounded-xl transition-all hover:shadow-sm",
                      isActive ? cfg.activeColor : `border-gray-200 ${cfg.color}`)}>
                    <Icon className={cn("w-5 h-5 mb-2", isActive ? "text-gray-800" : "text-gray-400")} />
                    <p className="text-sm font-semibold text-gray-900">{cfg.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{cfg.description}</p>
                    <p className="text-[10px] font-semibold text-green-700 mt-1.5">{cfg.cost}</p>
                  </button>
                );
              })}
            </div>

            {/* Channel availability warnings */}
            {(channel === "sms" || channel === "multi_channel") && withPhone < selectedCount && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>{selectedCount - withPhone} of {selectedCount} customers</strong> have no phone number and will be skipped for SMS.
                </span>
              </div>
            )}
            {(channel === "email" || channel === "multi_channel") && withEmail < selectedCount && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>{selectedCount - withEmail} of {selectedCount} customers</strong> have no email address and will be skipped for email.
                </span>
              </div>
            )}
            {(channel === "direct_mail" || channel === "multi_channel") && withAddress < selectedCount && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>{selectedCount - withAddress} of {selectedCount} customers</strong> have no mailing address and will be skipped for direct mail.
                </span>
              </div>
            )}

            {/* Mail template selector (only for mail channels) */}
            {needsMailTemplate && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mail Template</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {MAIL_TEMPLATES.map((tmpl) => (
                    <button key={tmpl.type} onClick={() => setTemplateType(tmpl.type)}
                      className={cn("text-left p-3.5 border-2 rounded-xl transition-all hover:shadow-sm",
                        templateType === tmpl.type ? "border-brand-600 bg-brand-50" : "border-gray-200 hover:border-brand-300")}>
                      <div className="flex items-start justify-between mb-1.5">
                        <FileText className={cn("w-4 h-4", templateType === tmpl.type ? "text-brand-600" : "text-gray-400")} />
                        <span className="text-[10px] font-bold text-green-700">{tmpl.cost}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{tmpl.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{tmpl.description}</p>
                      <p className="text-[10px] text-brand-600 mt-1">Best for: {tmpl.best}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-1">
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setCurrentStep(1)}>Back</Button>
              <Button size="sm" className="h-8" onClick={() => setCurrentStep(3)}>
                Next <ChevronRight className="ml-1 w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 3: Goal & Copy ── */}
      {currentStep >= 3 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                currentStep === 3 ? "bg-brand-600 text-white" : currentStep > 3 ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500")}>
                {currentStep > 3 ? <CheckCircle className="w-3.5 h-3.5" /> : "3"}
              </div>
              <CardTitle className="text-base">Campaign Goal &amp; Copy</CardTitle>
            </div>
            <CardDescription className="text-xs ml-8">
              Claude writes personalized {channelCfg.label.toLowerCase()} copy for each customer using their visit history
              {channel !== "direct_mail" ? " and contact data" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Campaign Goal</label>
              <textarea
                className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring h-20"
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
                placeholder="Describe what you want to achieve — agents personalize the message per customer…"
              />
              {/* Channel-specific hint */}
              <p className="text-[10px] text-muted-foreground">
                {channel === "sms" && "SMS: Claude writes a 160-character message per customer referencing their last visit."}
                {channel === "email" && "Email: Claude writes a personalized subject + HTML body with a service-history hook and CTA."}
                {channel === "direct_mail" && "Mail: Claude writes a handwritten-style note referencing the customer's vehicle and service history."}
                {channel === "multi_channel" && "Multi: Claude picks the best channel per customer and writes channel-appropriate copy for each."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Preview copy for</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={previewCustomerId}
                onChange={(e) => { setPreviewCustomerId(e.target.value); setPreviewResult(null); }}
              >
                <option value="">First selected customer</option>
                {Array.from(selectedIds).map((id) => {
                  const c = customers.find((x) => x.id === id);
                  return c ? <option key={id} value={id}>{c.first_name} {c.last_name} ({c.lifecycle_stage})</option> : null;
                })}
              </select>
            </div>

            {previewError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{previewError}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={generatePreview} disabled={generatingPreview || selectedCount === 0} className="flex-1">
                {generatingPreview ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Zap className="mr-2 h-4 w-4" />Generate AI Copy</>}
              </Button>
              <Button variant="ghost" size="sm" className="h-10" onClick={() => setCurrentStep(2)}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 4: Preview ── */}
      {currentStep >= 4 && previewResult && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  currentStep === 4 ? "bg-brand-600 text-white" : "bg-green-500 text-white")}>
                  {currentStep > 4 ? <CheckCircle className="w-3.5 h-3.5" /> : "4"}
                </div>
                <CardTitle className="text-base">Preview</CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  {channelCfg.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {Math.round(previewResult.confidence * 100)}% confidence
                </Badge>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={generatePreview}>
                  <RefreshCw className="w-3 h-3 mr-1" />Regenerate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <strong>AI reasoning:</strong> {previewResult.reasoning}
            </div>

            {/* Channel-specific preview */}
            {previewResult.channel === "direct_mail" && previewResult.previewQrUrl && (
              <TemplatePreview
                templateType={templateType}
                content={previewResult.content}
                dealershipName={dealershipName}
                vehicle={previewResult.vehicle}
                qrPreviewUrl={previewResult.previewQrUrl}
              />
            )}

            {previewResult.channel === "sms" && (
              <SmsPreview
                message={previewResult.smsBody ?? previewResult.content}
                dealershipName={dealershipName}
              />
            )}

            {previewResult.channel === "email" && (
              <EmailPreview
                subject={previewResult.subject}
                body={previewResult.content}
                dealershipName={dealershipName}
              />
            )}

            {previewResult.channel === "multi_channel" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Showing email preview — Claude will write channel-appropriate copy per customer at send time.
                </p>
                <EmailPreview
                  subject={previewResult.subject}
                  body={previewResult.content}
                  dealershipName={dealershipName}
                />
              </div>
            )}

            {/* Editable copy */}
            {previewResult.channel === "sms" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Edit SMS body:</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring h-20"
                  rows={3}
                  maxLength={160}
                  value={previewResult.smsBody ?? previewResult.content}
                  onChange={(e) => setPreviewResult({ ...previewResult, smsBody: e.target.value })}
                />
                <p className={cn("text-right text-[10px]", (previewResult.smsBody ?? previewResult.content).length > 160 ? "text-red-500 font-semibold" : "text-muted-foreground")}>
                  {(previewResult.smsBody ?? previewResult.content).length}/160
                </p>
              </div>
            ) : previewResult.channel !== "email" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Edit copy before sending:</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm font-handwriting resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  style={{ fontFamily: "'Caveat', cursive", fontSize: "17px", lineHeight: "1.7" }}
                  rows={6}
                  value={previewResult.content}
                  onChange={(e) => setPreviewResult({ ...previewResult, content: e.target.value })}
                />
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setCurrentStep(3)}>Back</Button>
              <Button size="sm" className="h-8" onClick={() => setCurrentStep(5)}>
                <Send className="mr-1.5 w-3.5 h-3.5" />Continue to Send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 5: Send ── */}
      {currentStep >= 5 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                currentStep === 5 ? "bg-brand-600 text-white" : "bg-green-500 text-white")}>5</div>
              <CardTitle className="text-base">Send Campaign</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-lg border">
                <p className="text-xl font-bold">{selectedCount}</p>
                <p className="text-xs text-muted-foreground">Recipients</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center justify-center gap-1.5">
                  {(() => { const Icon = channelCfg.icon; return <Icon className="w-4 h-4 text-gray-600" />; })()}
                  <p className="text-sm font-bold">{channelCfg.label}</p>
                </div>
                <p className="text-xs text-muted-foreground">Channel</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <p className="text-xl font-bold">{estimateCost()}</p>
                <p className="text-xs text-muted-foreground">Est. Cost</p>
              </div>
            </div>

            {/* Dry run toggle */}
            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="rounded mt-0.5" />
              <div>
                <p className="text-sm font-medium">
                  Dry Run Mode
                  {dryRun && <Badge variant="warning" className="ml-2 text-[10px]">Active</Badge>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generate copy for all customers without sending. Toggle off for real sends.
                </p>
              </div>
            </label>

            {!dryRun && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Live mode — messages will be sent</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {channel === "direct_mail" && `PostGrid will print and mail ${selectedCount} piece${selectedCount !== 1 ? "s" : ""}. ~${estimateCost()}.`}
                    {channel === "sms" && `Twilio will send ${withPhone} SMS messages. ~${estimateCost()}.`}
                    {channel === "email" && `Resend will send ${withEmail} emails.`}
                    {channel === "multi_channel" && `Claude will send across SMS, email, and direct mail for all ${selectedCount} customers.`}
                    {" "}This cannot be undone.
                  </p>
                </div>
              </div>
            )}

            {sendError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{sendError}</p>
              </div>
            )}

            {/* Results */}
            {sendResults && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  {dryRun ? "Dry run" : "Campaign"} complete — {sendResults.filter(r => r.success).length}/{sendResults.length} succeeded
                </div>
                <div className="divide-y border rounded-lg max-h-60 overflow-y-auto">
                  {sendResults.map((r, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                      {r.success ? <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">{r.customerName}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                            {r.channel.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.message}</p>
                        {r.result?.postgrid_id && (
                          <p className="text-[10px] text-muted-foreground font-mono">PostGrid: {r.result.postgrid_id}</p>
                        )}
                        {r.result?.provider_id && !r.result?.postgrid_id && (
                          <p className="text-[10px] text-muted-foreground font-mono">ID: {r.result.provider_id}</p>
                        )}
                      </div>
                      {r.result?.estimated_delivery && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          ~{new Date(r.result.estimated_delivery).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="h-9" onClick={() => setCurrentStep(4)} disabled={sending}>Back</Button>
              <Button
                size="sm"
                className={cn("flex-1 h-9", !dryRun && "bg-green-600 hover:bg-green-700")}
                onClick={sendCampaign}
                disabled={sending || selectedCount === 0}
              >
                {sending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{dryRun ? "Running…" : "Sending…"}</>
                ) : dryRun ? (
                  <><Eye className="mr-2 h-4 w-4" />Run Dry Run ({selectedCount})</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" />Send {selectedCount} {channelCfg.label} Message{selectedCount !== 1 ? "s" : ""} — {estimateCost()}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
