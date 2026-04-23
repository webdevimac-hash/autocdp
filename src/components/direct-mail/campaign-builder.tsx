"use client";

import { useState, useCallback, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { TemplatePreview } from "./template-preview";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Send, Loader2, CheckCircle, AlertCircle,
  ChevronRight, RefreshCw, Zap, Eye, FlaskConical,
  ExternalLink, Mail, MessageSquare, Layers, Phone,
  AtSign, Car, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer, MailTemplateType, CampaignType } from "@/types";

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
    color: "border-slate-200 hover:border-indigo-300 hover:shadow-sm",
    activeColor: "border-indigo-400 bg-indigo-50/60",
  },
  sms: {
    label: "SMS",
    icon: MessageSquare,
    description: "Personalized text message via Twilio. 98% open rate.",
    cost: "~$0.02 / message",
    best: "Urgent offers, appointment reminders",
    color: "border-slate-200 hover:border-violet-300 hover:shadow-sm",
    activeColor: "border-violet-400 bg-violet-50/60",
  },
  email: {
    label: "Email",
    icon: Mail,
    description: "HTML email with personalized subject + body via Resend.",
    cost: "Included in plan",
    best: "Newsletters, detailed offers, follow-ups",
    color: "border-slate-200 hover:border-emerald-300 hover:shadow-sm",
    activeColor: "border-emerald-400 bg-emerald-50/60",
  },
  multi_channel: {
    label: "All Channels",
    icon: Layers,
    description: "Claude picks the best channel per customer (mail + SMS + email).",
    cost: "Variable",
    best: "Re-engagement campaigns, max reach",
    color: "border-slate-200 hover:border-amber-300 hover:shadow-sm",
    activeColor: "border-amber-400 bg-amber-50/60",
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

// ── Lifecycle chip colors ─────────────────────────────────────

const STAGE_CHIP: Record<string, string> = {
  vip:      "chip chip-amber",
  active:   "chip chip-emerald",
  at_risk:  "chip chip-amber",
  lapsed:   "chip chip-red",
  prospect: "chip chip-slate",
};

// ── Step indicator ────────────────────────────────────────────

function StepIndicator({ step, current, label }: { step: number; current: number; label: string }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200",
        done
          ? "bg-emerald-500 text-white shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
          : active
          ? "bg-indigo-600 text-white shadow-[0_0_0_3px_rgba(99,102,241,0.18)]"
          : "bg-white border-2 border-slate-200 text-slate-400"
      )}>
        {done ? <CheckCircle className="w-4 h-4" /> : step}
      </div>
      <span className={cn(
        "text-[10px] font-semibold whitespace-nowrap hidden sm:block",
        active ? "text-indigo-700" : done ? "text-emerald-600" : "text-slate-400"
      )}>{label}</span>
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
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[9px] font-bold">
            {dealershipName.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-medium text-slate-700">{dealershipName}</span>
        </div>
        <div className="bg-white rounded-xl rounded-tl-sm px-3.5 py-2.5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>
        <div className={cn("text-right text-[10px] font-medium", overLimit ? "text-red-500 font-semibold" : "text-slate-400")}>
          {chars}/160 chars{overLimit ? " — too long" : ""}
        </div>
      </div>
    </div>
  );
}

// ── Email preview card ────────────────────────────────────────

function EmailPreview({ subject, body, dealershipName }: { subject: string | null; body: string; dealershipName: string }) {
  return (
    <div className="border border-slate-200 rounded-[var(--radius)] overflow-hidden bg-white shadow-card">
      <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 w-10">From:</span>
          <span className="font-medium text-slate-700">{dealershipName} &lt;hello@dealership.com&gt;</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 w-10">Subject:</span>
          <span className="font-semibold text-slate-900">{subject || "(no subject)"}</span>
        </div>
      </div>
      <div className="p-5 text-sm text-slate-700 leading-relaxed max-h-72 overflow-y-auto">
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
  const [campaignType, setCampaignType] = useState<CampaignType>("standard");

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

  // ── Send Test Mail panel ──────────────────────────────────
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

  // ── Step 1 helpers ────────────────────────────────────────

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

  // ── Step 2 helpers ────────────────────────────────────────

  const selectedCustomers = customers.filter((c) => selectedIds.has(c.id));
  const withPhone = selectedCustomers.filter((c) => !!c.phone).length;
  const withEmail = selectedCustomers.filter((c) => !!c.email).length;
  const withAddress = selectedCustomers.filter((c) => !!c.address?.street).length;

  // ── Step 3: Generate preview ──────────────────────────────

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
          channel: channel === "multi_channel" ? "email" : channel,
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

  // ── Step 5: Send ──────────────────────────────────────────

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
          body: JSON.stringify({ customerIds, templateType, campaignGoal, dryRun, campaignType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Send failed");

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
            includeProspects: true,
            campaignType,
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
    return `~$${(n * 0.62).toFixed(2)}`;
  }

  const needsMailTemplate = channel === "direct_mail" || channel === "multi_channel";

  return (
    <div className="space-y-5">

      {/* ── Send Test Mail panel ───────────────────────────── */}
      <div className={cn(
        "rounded-[var(--radius)] bg-white transition-all duration-200",
        testPanelOpen
          ? "border border-indigo-200 shadow-card"
          : "border border-dashed border-slate-200 hover:border-indigo-200 shadow-card"
      )}>
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-900">Send Test Mail</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Preview a single personalized mail piece end-to-end.</p>
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

        {testPanelOpen && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Test customer</label>
                <select className="w-full border border-slate-200 rounded-[var(--radius)] px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 bg-slate-50/50"
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
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Template</label>
                <select className="w-full border border-slate-200 rounded-[var(--radius)] px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 bg-slate-50/50"
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
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Campaign goal</label>
              <textarea className="w-full border border-slate-200 rounded-[var(--radius)] p-3 text-base sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 h-16 bg-slate-50/50"
                value={testGoal} onChange={(e) => { setTestGoal(e.target.value); setTestPreview(null); setTestLiveResult(null); }} />
            </div>

            {testError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-[var(--radius)]">
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
                <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-[var(--radius)] text-xs text-indigo-800">
                  <strong>AI reasoning:</strong> {testPreview.reasoning}
                </div>
                <TemplatePreview templateType={testTemplateType} content={testPreview.content} dealershipName={dealershipName} vehicle={testPreview.vehicle} qrPreviewUrl={testPreview.previewQrUrl ?? undefined} />
                <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-[var(--radius)] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">
                    <strong>Send Live</strong> submits a real PostGrid job. With a <code>test_sk_…</code> key no mail is printed and there&apos;s no charge.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-9" onClick={runTestPreview} disabled={testLoading}>
                    <RefreshCw className="mr-1.5 w-3.5 h-3.5" />Regenerate
                  </Button>
                  <Button size="sm" className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700" onClick={sendTestLive} disabled={testLoading}>
                    {testLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send Live to PostGrid</>}
                  </Button>
                </div>
              </div>
            )}

            {testLiveResult && (
              <div className={cn("p-4 rounded-[var(--radius)] border", testLiveResult.success ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100")}>
                <div className="flex items-start gap-2">
                  {testLiveResult.success ? <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-semibold", testLiveResult.success ? "text-emerald-800" : "text-red-800")}>
                      {testLiveResult.success ? "Mail piece sent to PostGrid" : "Send failed"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{testLiveResult.message}</p>
                    {testLiveResult.result?.postgrid_id && (
                      <p className="text-xs font-mono text-slate-400 mt-1">ID: {testLiveResult.result.postgrid_id}</p>
                    )}
                    {testLiveResult.result?.tracking_url && (
                      <a href={testLiveResult.result.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1">
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
          </div>
        )}
      </div>

      {/* Step indicators */}
      <div className="flex items-start gap-0">
        {[
          [1, "Customers"], [2, "Channel"], [3, "Goal & Copy"],
          [4, "Preview"], [5, "Send"],
        ].map(([step, label], i, arr) => (
          <Fragment key={step as number}>
            <StepIndicator step={step as number} current={currentStep} label={label as string} />
            {i < arr.length - 1 && (
              <div
                className="flex-1 h-px mt-4 mx-1 transition-colors duration-300"
                style={{ background: currentStep > (step as number) ? "#10B981" : "#E2E8F0" }}
              />
            )}
          </Fragment>
        ))}
      </div>

      <div className="border-t border-slate-100" />

      {/* ── STEP 1: Customer Selection ─────────────────────── */}
      {currentStep >= 1 && (
        <div className="inst-panel">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              currentStep === 1 ? "bg-indigo-600 text-white" : "bg-emerald-500 text-white")}>
              {currentStep > 1 ? <CheckCircle className="w-3.5 h-3.5" /> : "1"}
            </div>
            <p className="text-[13px] font-semibold text-slate-900 flex-1">Select Customers</p>
            {selectedCount > 0 && <span className="chip chip-indigo">{selectedCount} selected</span>}
          </div>
          <div className="p-5 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {["all", "lapsed", "at_risk", "active", "vip"].map((stage) => (
                <button key={stage} onClick={() => setFilterStage(stage)}
                  className={cn("text-xs px-3 py-2 rounded-[var(--radius)] border transition-all capitalize min-h-[44px] font-medium",
                    filterStage === stage
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-slate-800")}>
                  {stage === "at_risk" ? "At Risk" : stage === "all" ? "All" : stage}
                </button>
              ))}
              <button onClick={toggleSelectAll}
                className="text-xs px-3 py-2 rounded-[var(--radius)] border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-slate-800 ml-auto min-h-[44px] font-medium transition-all">
                {selectAll ? "Deselect All" : `Select All (${filteredCustomers.length})`}
              </button>
            </div>

            <div className="border border-slate-100 rounded-[var(--radius)] divide-y divide-slate-50 max-h-64 overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No customers match this filter.</div>
              ) : (
                filteredCustomers.slice(0, 20).map((customer) => (
                  <label key={customer.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 cursor-pointer min-h-[52px] transition-colors">
                    <input type="checkbox" checked={selectedIds.has(customer.id)} onChange={() => toggleCustomer(customer.id)} className="rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-slate-900 truncate">{customer.first_name} {customer.last_name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{customer.total_visits}v · ${customer.total_spend.toFixed(0)}</span>
                        {customer.phone && <span className="flex items-center gap-0.5 text-emerald-600 font-medium"><Phone className="w-2.5 h-2.5" />SMS</span>}
                        {customer.email && <span className="flex items-center gap-0.5 text-indigo-600 font-medium"><AtSign className="w-2.5 h-2.5" />Email</span>}
                        {!customer.address?.street && <span className="text-amber-600 font-medium">No address</span>}
                      </div>
                    </div>
                    <span className={cn("text-[10px] capitalize", STAGE_CHIP[customer.lifecycle_stage] ?? "chip chip-slate")}>
                      {customer.lifecycle_stage?.replace("_", " ")}
                    </span>
                  </label>
                ))
              )}
              {filteredCustomers.length > 20 && (
                <div className="px-4 py-2.5 text-xs text-slate-400 bg-slate-50/60 text-center">
                  Showing 20 of {filteredCustomers.length} — use filters to narrow down
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-1">
              <p className="text-xs text-slate-400">
                {selectedCount > 0 ? (
                  <>{selectedCount} selected · <span className="text-emerald-600 font-medium">{withPhone} have phone</span> · <span className="text-indigo-600 font-medium">{withEmail} have email</span> · {withAddress} have address</>
                ) : "Select customers to continue"}
              </p>
              <Button size="sm" className="h-12 sm:h-8 w-full sm:w-auto" disabled={selectedCount === 0} onClick={() => setCurrentStep(2)}>
                Next <ChevronRight className="ml-1 w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Channel & Format ───────────────────────── */}
      {currentStep >= 2 && (
        <div className="inst-panel">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              currentStep === 2 ? "bg-indigo-600 text-white" : currentStep > 2 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
              {currentStep > 2 ? <CheckCircle className="w-3.5 h-3.5" /> : "2"}
            </div>
            <p className="text-[13px] font-semibold text-slate-900">Channel &amp; Format</p>
          </div>
          <div className="p-5 space-y-4">

            {/* Campaign type toggle */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Campaign Type</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setCampaignType("standard");
                    setCampaignGoal("Win back customers who haven't visited in 6–18 months with a personalized service reminder and discount offer.");
                  }}
                  className={cn(
                    "text-left p-4 rounded-[var(--radius)] border-2 transition-all",
                    campaignType === "standard"
                      ? "border-indigo-400 bg-indigo-50/60"
                      : "bg-white border-slate-200 hover:border-indigo-300"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Zap className={cn("w-4 h-4", campaignType === "standard" ? "text-indigo-600" : "text-slate-400")} />
                    <p className="text-[13px] font-semibold text-slate-900">Standard</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">Service reminders, reactivation, VIP appreciation, and general outreach.</p>
                </button>
                <button
                  onClick={() => {
                    setCampaignType("aged_inventory");
                    setCampaignGoal("Move aged inventory by matching specific vehicles (45+ days on lot) to customers with matching make/model service history.");
                  }}
                  className={cn(
                    "text-left p-4 rounded-[var(--radius)] border-2 transition-all relative overflow-hidden",
                    campaignType === "aged_inventory"
                      ? "border-amber-400 bg-amber-50/60"
                      : "bg-white border-slate-200 hover:border-amber-300"
                  )}
                >
                  {campaignType === "aged_inventory" && (
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-400" />
                  )}
                  <div className="flex items-center gap-2 mb-1.5">
                    <Car className={cn("w-4 h-4", campaignType === "aged_inventory" ? "text-amber-600" : "text-slate-400")} />
                    <p className="text-[13px] font-semibold text-slate-900">Aged Inventory</p>
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">vAuto</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">AI matches customers to specific aging vehicles based on their service history and model interest.</p>
                  {campaignType === "aged_inventory" && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-700 font-medium">
                      <Clock className="w-3 h-3" /> Vehicles 45+ days on lot prioritized
                    </div>
                  )}
                </button>
              </div>

              {campaignType === "aged_inventory" && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-[var(--radius)] text-xs text-amber-800">
                  <Car className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>The AI will match each selected customer to a specific aged vehicle from your vAuto inventory and write copy that references the exact year/make/model.</span>
                </div>
              )}
            </div>

            {/* Channel selector */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(Object.entries(CHANNEL_CONFIG) as [BuilderChannel, typeof CHANNEL_CONFIG[BuilderChannel]][]).map(([ch, cfg]) => {
                const Icon = cfg.icon;
                const isActive = channel === ch;
                return (
                  <button key={ch} onClick={() => setChannel(ch)}
                    className={cn(
                      "text-left p-4 rounded-[var(--radius)] transition-all min-h-[100px] relative overflow-hidden",
                      isActive
                        ? "bg-white border border-indigo-200 shadow-[0_0_0_2px_rgba(99,102,241,0.16),0_4px_12px_-2px_rgba(99,102,241,0.10)]"
                        : "bg-white border border-slate-200 hover:border-slate-300 hover:shadow-card"
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{
                        background: ch === "direct_mail" ? "#6366F1"
                                  : ch === "sms" ? "#8B5CF6"
                                  : ch === "email" ? "#0EA5E9"
                                  : "#F59E0B"
                      }} />
                    )}
                    <Icon className={cn("w-5 h-5 mb-2 mt-1", isActive ? "text-indigo-600" : "text-slate-400")} />
                    <p className="text-[13px] font-semibold text-slate-900">{cfg.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{cfg.description}</p>
                    <p className="text-[10px] font-bold text-emerald-700 mt-1.5">{cfg.cost}</p>
                  </button>
                );
              })}
            </div>

            {/* Channel availability warnings */}
            {(channel === "sms" || channel === "multi_channel") && withPhone < selectedCount && (
              <div className="flex items-start gap-2 p-3.5 bg-amber-50 border border-amber-100 rounded-[var(--radius)] text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span><strong>{selectedCount - withPhone} of {selectedCount} customers</strong> have no phone number and will be skipped for SMS.</span>
              </div>
            )}
            {(channel === "email" || channel === "multi_channel") && withEmail < selectedCount && (
              <div className="flex items-start gap-2 p-3.5 bg-amber-50 border border-amber-100 rounded-[var(--radius)] text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span><strong>{selectedCount - withEmail} of {selectedCount} customers</strong> have no email address and will be skipped for email.</span>
              </div>
            )}
            {(channel === "direct_mail" || channel === "multi_channel") && withAddress < selectedCount && (
              <div className="flex items-start gap-2 p-3.5 bg-amber-50 border border-amber-100 rounded-[var(--radius)] text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span><strong>{selectedCount - withAddress} of {selectedCount} customers</strong> have no mailing address and will be skipped for direct mail.</span>
              </div>
            )}

            {/* Mail template selector */}
            {needsMailTemplate && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mail Template</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {MAIL_TEMPLATES.map((tmpl) => (
                    <button key={tmpl.type} onClick={() => setTemplateType(tmpl.type)}
                      className={cn("text-left p-4 border-2 rounded-[var(--radius)] transition-all hover:shadow-sm",
                        templateType === tmpl.type ? "border-indigo-400 bg-indigo-50/60" : "bg-white border-slate-200 hover:border-indigo-300")}>
                      <div className="flex items-start justify-between mb-1.5">
                        <FileText className={cn("w-4 h-4", templateType === tmpl.type ? "text-indigo-600" : "text-slate-400")} />
                        <span className="text-[10px] font-bold text-emerald-700">{tmpl.cost}</span>
                      </div>
                      <p className="text-[13px] font-semibold text-slate-900">{tmpl.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-snug">{tmpl.description}</p>
                      <p className="text-[10px] text-indigo-600 font-medium mt-1">Best for: {tmpl.best}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="ghost" size="sm" className="h-12 sm:h-8 flex-1 sm:flex-none" onClick={() => setCurrentStep(1)}>Back</Button>
              <Button size="sm" className="h-12 sm:h-8 flex-1 sm:flex-none" onClick={() => setCurrentStep(3)}>
                Next <ChevronRight className="ml-1 w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Goal & Copy ────────────────────────────── */}
      {currentStep >= 3 && (
        <div className="inst-panel">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                currentStep === 3 ? "bg-indigo-600 text-white" : currentStep > 3 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
                {currentStep > 3 ? <CheckCircle className="w-3.5 h-3.5" /> : "3"}
              </div>
              <p className="text-[13px] font-semibold text-slate-900">Campaign Goal &amp; Copy</p>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 ml-8">
              Claude writes personalized {channelCfg.label.toLowerCase()} copy for each customer using their visit history
              {channel !== "direct_mail" ? " and contact data" : ""}.
              {campaignType === "aged_inventory" && " Aged inventory vehicles are automatically matched per customer."}
            </p>
          </div>
          <div className="p-5 space-y-4">
            {campaignType === "aged_inventory" && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-[var(--radius)] text-xs text-amber-800">
                <Car className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                <span>
                  <strong>Aged Inventory mode:</strong> The AI will query your vAuto inventory for vehicles 45+ days on lot, match each customer to their best-fit vehicle by service history, and write copy that names the exact year/make/model.
                </span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Campaign Goal</label>
              <textarea
                className="w-full border border-slate-200 rounded-[var(--radius)] p-3 text-base sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 h-20 bg-slate-50/50 placeholder:text-slate-400"
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
                placeholder="Describe what you want to achieve — agents personalize the message per customer…"
              />
              <p className="text-[10px] text-slate-400">
                {channel === "sms" && "SMS: Claude writes a 160-character message per customer referencing their last visit."}
                {channel === "email" && "Email: Claude writes a personalized subject + HTML body with a service-history hook and CTA."}
                {channel === "direct_mail" && "Mail: Claude writes a handwritten-style note referencing the customer's vehicle and service history."}
                {channel === "multi_channel" && "Multi: Claude picks the best channel per customer and writes channel-appropriate copy for each."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Preview copy for</label>
              <select
                className="w-full border border-slate-200 rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 bg-slate-50/50"
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
              <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-100 rounded-[var(--radius)]">
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
          </div>
        </div>
      )}

      {/* ── STEP 4: Preview ────────────────────────────────── */}
      {currentStep >= 4 && previewResult && (
        <div className="inst-panel">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                currentStep === 4 ? "bg-indigo-600 text-white" : "bg-emerald-500 text-white")}>
                {currentStep > 4 ? <CheckCircle className="w-3.5 h-3.5" /> : "4"}
              </div>
              <p className="text-[13px] font-semibold text-slate-900">Preview</p>
              <span className="chip chip-slate">{channelCfg.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="chip chip-emerald">{Math.round(previewResult.confidence * 100)}% conf.</span>
              <button onClick={generatePreview} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
                <RefreshCw className="w-3 h-3" />Regenerate
              </button>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-[var(--radius)] text-xs text-indigo-800">
              <strong>AI reasoning:</strong> {previewResult.reasoning}
            </div>

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
              <SmsPreview message={previewResult.smsBody ?? previewResult.content} dealershipName={dealershipName} />
            )}

            {previewResult.channel === "email" && (
              <EmailPreview subject={previewResult.subject} body={previewResult.content} dealershipName={dealershipName} />
            )}

            {previewResult.channel === "multi_channel" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Showing email preview — Claude will write channel-appropriate copy per customer at send time.
                </p>
                <EmailPreview subject={previewResult.subject} body={previewResult.content} dealershipName={dealershipName} />
              </div>
            )}

            {previewResult.channel === "sms" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Edit SMS body:</label>
                <textarea
                  className="w-full border border-slate-200 rounded-[var(--radius)] p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 bg-slate-50/50"
                  rows={3}
                  maxLength={160}
                  value={previewResult.smsBody ?? previewResult.content}
                  onChange={(e) => setPreviewResult({ ...previewResult, smsBody: e.target.value })}
                />
                <p className={cn("text-right text-[10px] font-medium", (previewResult.smsBody ?? previewResult.content).length > 160 ? "text-red-500 font-semibold" : "text-slate-400")}>
                  {(previewResult.smsBody ?? previewResult.content).length}/160
                </p>
              </div>
            ) : previewResult.channel !== "email" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Edit copy before sending:</label>
                <textarea
                  className="w-full border border-slate-200 rounded-[var(--radius)] p-3 text-sm font-handwriting resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                  style={{ fontFamily: "'Caveat', cursive", fontSize: "17px", lineHeight: "1.7" }}
                  rows={6}
                  value={previewResult.content}
                  onChange={(e) => setPreviewResult({ ...previewResult, content: e.target.value })}
                />
              </div>
            )}

            <div className="flex justify-between pt-1">
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setCurrentStep(3)}>Back</Button>
              <Button size="sm" className="h-8" onClick={() => setCurrentStep(5)}>
                <Send className="mr-1.5 w-3.5 h-3.5" />Continue to Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: Send ───────────────────────────────────── */}
      {currentStep >= 5 && (
        <div className="inst-panel">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              currentStep === 5 ? "bg-indigo-600 text-white" : "bg-emerald-500 text-white")}>5</div>
            <p className="text-[13px] font-semibold text-slate-900">Send Campaign</p>
          </div>
          <div className="p-5 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-indigo-50/60 rounded-[var(--radius)] border border-indigo-100 text-center">
                <p className="text-2xl font-bold text-indigo-700 tabular-nums">{selectedCount}</p>
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mt-0.5">Recipients</p>
              </div>
              <div className="p-4 bg-slate-50/60 rounded-[var(--radius)] border border-slate-100 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  {(() => { const Icon = channelCfg.icon; return <Icon className="w-4 h-4 text-slate-600" />; })()}
                  <p className="text-[13px] font-bold text-slate-900">{channelCfg.label}</p>
                </div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Channel</p>
              </div>
              <div className="p-4 bg-emerald-50/60 rounded-[var(--radius)] border border-emerald-100 text-center">
                <p className="text-2xl font-bold text-emerald-700 tabular-nums">{estimateCost()}</p>
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mt-0.5">Est. Cost</p>
              </div>
            </div>

            {/* Dry run toggle */}
            <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-[var(--radius)] cursor-pointer hover:bg-slate-50/60 transition-colors">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="rounded mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-slate-900">
                  Dry Run Mode
                  {dryRun && <span className="chip chip-amber ml-2">Active</span>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate copy for all customers without sending. Toggle off for real sends.
                </p>
              </div>
            </label>

            {!dryRun && (
              <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-[var(--radius)] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-amber-800">Live mode — messages will be sent</p>
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
              <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-100 rounded-[var(--radius)]">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{sendError}</p>
              </div>
            )}

            {/* Results */}
            {sendResults && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
                  <CheckCircle className="w-4 h-4" />
                  {dryRun ? "Dry run" : "Campaign"} complete — {sendResults.filter(r => r.success).length}/{sendResults.length} succeeded
                </div>
                <div className="divide-y divide-slate-50 border border-slate-100 rounded-[var(--radius)] max-h-60 overflow-y-auto">
                  {sendResults.map((r, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                      {r.success ? <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-medium text-slate-900">{r.customerName}</p>
                          <span className="chip chip-slate capitalize">{r.channel.replace("_", " ")}</span>
                        </div>
                        <p className="text-xs text-slate-400">{r.message}</p>
                        {r.result?.postgrid_id && (
                          <p className="text-[10px] text-slate-400 font-mono">PostGrid: {r.result.postgrid_id}</p>
                        )}
                        {r.result?.provider_id && !r.result?.postgrid_id && (
                          <p className="text-[10px] text-slate-400 font-mono">ID: {r.result.provider_id}</p>
                        )}
                      </div>
                      {r.result?.estimated_delivery && (
                        <span className="text-[10px] text-slate-400 shrink-0">
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
                variant={!dryRun ? "emerald" : "default"}
                className="flex-1 h-9"
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
          </div>
        </div>
      )}
    </div>
  );
}
