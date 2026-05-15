"use client";

import { useState, useCallback, useMemo, Fragment, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TemplatePreview } from "./template-preview";
import type { AccentColor } from "./template-preview";
import { useToast } from "@/hooks/use-toast";
import { CreditInsightPanel } from "@/components/campaigns/credit-insight-panel";
import { CampaignImpactPanel } from "@/components/campaigns/campaign-impact-panel";
import { CoopPanel } from "@/components/campaigns/coop-panel";
import {
  FileText, Send, Loader2, CheckCircle, AlertCircle,
  ChevronRight, RefreshCw, Zap, Eye, FlaskConical,
  ExternalLink, Mail, MessageSquare, Layers, Phone,
  AtSign, Car, Clock, Sparkles, ShieldCheck, X, Award,
  BarChart2, TrendingUp, SplitSquareHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer, MailTemplateType, CampaignType, DesignStyle, CampaignScoreResult } from "@/types";

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

// ── Unified template configs (templateType + designStyle) ─────

type TemplateConfig = {
  templateType: MailTemplateType;
  designStyle: DesignStyle;
  label: string;
  description: string;
  cost: string;
  costPerPiece: number;
  bestFor: string;
  bestStages: string[];
  badge: string | null;
  accentDefault: AccentColor;
};

const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    templateType: "postcard_6x9",
    designStyle: "standard",
    label: "Classic Postcard",
    description: "Vehicle photo, handwritten note, QR + detachable coupon strip.",
    cost: "~$1.20",
    costPerPiece: 1.20,
    bestFor: "Reactivation, service reminders",
    bestStages: ["lapsed", "active", "at_risk"],
    badge: null,
    accentDefault: "indigo",
  },
  {
    templateType: "letter_8.5x11",
    designStyle: "standard",
    label: "Premium Letter",
    description: "Branded letterhead, full personalized body with handwritten signature — arrives in envelope.",
    cost: "~$1.60",
    costPerPiece: 1.60,
    bestFor: "VIP appreciation, recalls, formal",
    bestStages: ["vip", "active"],
    badge: "Formal",
    accentDefault: "indigo",
  },
  {
    templateType: "postcard_6x9",
    designStyle: "complex-fold",
    label: "Folded Self-Mailer",
    description: "Tri-fold with cover story, inner personalized message + offer, and mailing panel.",
    cost: "~$1.80",
    costPerPiece: 1.80,
    bestFor: "Lapsed win-back campaigns",
    bestStages: ["lapsed"],
    badge: "Tri-Fold",
    accentDefault: "indigo",
  },
  {
    templateType: "postcard_6x9",
    designStyle: "premium-fluorescent",
    label: "Fluorescent Offer Card",
    description: "Bold dark design with neon ink accents. High-impact — grabs attention immediately.",
    cost: "~$1.40",
    costPerPiece: 1.40,
    bestFor: "VIP events, urgent promotions",
    bestStages: ["vip", "at_risk"],
    badge: "Neon",
    accentDefault: "yellow",
  },
  {
    templateType: "postcard_6x9",
    designStyle: "conquest",
    label: "Conquest Postcard",
    description: "Clean, modern design for new customer acquisition. Bold headline, minimal copy, strong CTA.",
    cost: "~$1.20",
    costPerPiece: 1.20,
    bestFor: "New customer conquest lists",
    bestStages: ["prospect"],
    badge: "New",
    accentDefault: "green",
  },
];

// ── Template thumbnail SVGs ───────────────────────────────────
// Small 80×56 previews rendered inside each selector card

const TEMPLATE_THUMBS: Record<string, ReactNode> = {
  "postcard_6x9-standard": (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="80" height="56" fill="#F8F6F1" />
      <rect x="0" y="0" width="80" height="17" fill="#9CA3AF" />
      <path d="M20 14 L25 9 Q29 7 34 7 L46 7 Q51 7 55 10 L61 14 L62 16 L19 16 Z" fill="white" opacity="0.28" />
      <circle cx="29" cy="16" r="2.2" fill="white" opacity="0.35" />
      <circle cx="52" cy="16" r="2.2" fill="white" opacity="0.35" />
      <rect x="0" y="17" width="80" height="5" fill="#6366F1" />
      <rect x="6" y="3" width="18" height="2" rx="0.5" fill="white" opacity="0.5" />
      <rect x="60" y="3.5" width="14" height="1.5" rx="0.5" fill="white" opacity="0.4" />
      <rect x="6" y="26" width="42" height="1.5" rx="0.6" fill="#C4C9D4" />
      <rect x="6" y="29.5" width="36" height="1.5" rx="0.6" fill="#C4C9D4" />
      <rect x="6" y="33" width="40" height="1.5" rx="0.6" fill="#C4C9D4" />
      <rect x="6" y="36.5" width="28" height="1.5" rx="0.6" fill="#C4C9D4" />
      <rect x="56" y="23" width="18" height="18" rx="2.5" fill="white" stroke="#6366F1" strokeWidth="1.5" />
      <rect x="58" y="25" width="14" height="14" rx="1.5" fill="#EEF2FF" />
      <rect x="59.5" y="26.5" width="4" height="4" fill="#6366F1" />
      <rect x="66" y="26.5" width="4" height="4" fill="#6366F1" />
      <rect x="59.5" y="33.5" width="4" height="3.5" fill="#6366F1" />
      <rect x="63" y="29.5" width="2" height="2" fill="#6366F1" opacity="0.5" />
      <rect x="66" y="32" width="4" height="2" fill="#6366F1" opacity="0.5" />
      <rect x="4" y="44" width="72" height="9" rx="2" fill="white" stroke="#6366F1" strokeWidth="0.75" strokeDasharray="3 2" />
      <rect x="4" y="44" width="16" height="9" fill="#6366F1" rx="2" />
      <rect x="6" y="46" width="12" height="5" rx="1" fill="white" opacity="0.35" />
    </svg>
  ),
  "letter_8.5x11-standard": (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="80" height="56" fill="#FFFFFF" />
      <rect x="0" y="0" width="80" height="12" fill="#6366F1" />
      <rect x="6" y="3.5" width="30" height="5" rx="1" fill="white" opacity="0.45" />
      <rect x="54" y="5" width="20" height="2.5" rx="0.75" fill="white" opacity="0.3" />
      <rect x="0" y="12" width="80" height="3.5" fill="#EEF2FF" />
      <rect x="6" y="18.5" width="24" height="1.5" rx="0.6" fill="#94A3B8" />
      <rect x="6" y="21.5" width="18" height="1.5" rx="0.6" fill="#CBD5E1" />
      <rect x="6" y="27" width="68" height="1.5" rx="0.6" fill="#CBD5E1" />
      <rect x="6" y="30.5" width="62" height="1.5" rx="0.6" fill="#CBD5E1" />
      <rect x="6" y="34" width="68" height="1.5" rx="0.6" fill="#CBD5E1" />
      <rect x="6" y="37.5" width="50" height="1.5" rx="0.6" fill="#CBD5E1" />
      <rect x="6" y="41" width="34" height="1.5" rx="0.6" fill="#CBD5E1" />
      <path d="M6 46.5 Q10 44.5 14 46.5 Q18 48.5 23 46" stroke="#6366F1" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.65" />
      <path d="M6 49 Q9 48 13 49" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" fill="none" />
      <rect x="0" y="53" width="80" height="3" fill="#6366F1" />
    </svg>
  ),
  "postcard_6x9-complex-fold": (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="80" height="56" fill="#F1F5F9" />
      <line x1="27" y1="0" x2="27" y2="56" stroke="#CBD5E1" strokeWidth="0.75" strokeDasharray="2 2" />
      <line x1="54" y1="0" x2="54" y2="56" stroke="#CBD5E1" strokeWidth="0.75" strokeDasharray="2 2" />
      <rect x="0" y="0" width="27" height="56" fill="#0F172A" />
      <rect x="1" y="1" width="25" height="20" fill="#1E293B" />
      <path d="M3 18 L7 12 Q11 10 15 10 L21 10 Q24 10 26 13 L27 17 L26 19 L2 19 Z" fill="white" opacity="0.18" />
      <rect x="3" y="23" width="8" height="2.5" rx="0.75" fill="#60A5FA" opacity="0.75" />
      <rect x="3" y="27.5" width="19" height="1.5" rx="0.5" fill="white" opacity="0.3" />
      <rect x="3" y="31" width="15" height="1.5" rx="0.5" fill="white" opacity="0.22" />
      <rect x="3" y="34.5" width="17" height="1.5" rx="0.5" fill="white" opacity="0.22" />
      <rect x="3" y="38" width="13" height="1.5" rx="0.5" fill="white" opacity="0.22" />
      <rect x="24" y="0" width="3" height="56" fill="#2563EB" opacity="0.85" />
      <rect x="27" y="0" width="27" height="56" fill="#FAFAFA" />
      <rect x="30" y="7" width="14" height="1.5" rx="0.5" fill="#94A3B8" />
      <rect x="29" y="12" width="20" height="1.5" rx="0.5" fill="#CBD5E1" />
      <rect x="29" y="15.5" width="22" height="1.5" rx="0.5" fill="#CBD5E1" />
      <rect x="29" y="19" width="18" height="1.5" rx="0.5" fill="#CBD5E1" />
      <rect x="29" y="22.5" width="21" height="1.5" rx="0.5" fill="#CBD5E1" />
      <rect x="29" y="26" width="16" height="1.5" rx="0.5" fill="#CBD5E1" />
      <path d="M30 34 Q34 32 38 34 Q42 36 46 34" stroke="#6366F1" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6" />
      <rect x="54" y="0" width="26" height="56" fill="white" />
      <rect x="57" y="6" width="20" height="2.5" rx="0.75" fill="#1E293B" />
      <rect x="57" y="13" width="20" height="15" rx="2" fill="#EEF2FF" stroke="#6366F1" strokeWidth="0.75" />
      <rect x="58" y="14.5" width="7" height="2" rx="0.5" fill="#6366F1" />
      <rect x="58" y="18" width="17" height="1.5" rx="0.5" fill="#6366F1" opacity="0.45" />
      <rect x="58" y="21.5" width="13" height="1.5" rx="0.5" fill="#94A3B8" />
      <rect x="58" y="32" width="12" height="12" rx="2" fill="white" stroke="#6366F1" strokeWidth="0.75" />
      <rect x="59.5" y="33.5" width="4" height="4" fill="#6366F1" opacity="0.7" />
      <rect x="64.5" y="33.5" width="4" height="4" fill="#6366F1" opacity="0.7" />
      <rect x="59.5" y="38" width="4" height="3.5" fill="#6366F1" opacity="0.7" />
      <rect x="57" y="47" width="20" height="6" rx="1.5" fill="#6366F1" />
    </svg>
  ),
  "postcard_6x9-premium-fluorescent": (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="80" height="56" fill="#0F172A" />
      <rect x="0" y="0" width="80" height="4" fill="#FFE500" />
      <rect x="0" y="4" width="80" height="19" fill="#1E293B" />
      <path d="M14 19 L20 13 Q24 11 29 11 L44 11 Q49 11 53 14 L60 19 L61 21 L13 21 Z" fill="white" opacity="0.14" />
      <circle cx="24" cy="21" r="2.8" fill="#0F172A" opacity="0.5" />
      <circle cx="52" cy="21" r="2.8" fill="#0F172A" opacity="0.5" />
      <rect x="6" y="4.5" width="16" height="2" rx="0.5" fill="#FFE500" opacity="0.85" />
      <rect x="62" y="5" width="12" height="1.5" rx="0.5" fill="white" opacity="0.35" />
      <rect x="6" y="26" width="52" height="4.5" rx="1" fill="white" opacity="0.88" />
      <rect x="6" y="32.5" width="38" height="3" rx="0.75" fill="white" opacity="0.55" />
      <rect x="6" y="37.5" width="22" height="2.5" rx="1" fill="#FFE500" />
      <rect x="6" y="42" width="46" height="1.5" rx="0.5" fill="#475569" />
      <rect x="6" y="45" width="36" height="1.5" rx="0.5" fill="#475569" />
      <rect x="6" y="49" width="30" height="6" rx="1.5" fill="#FFE500" />
      <rect x="7.5" y="50.5" width="27" height="3" rx="0.75" fill="#1A1A00" opacity="0.35" />
      <rect x="42" y="49" width="11" height="6" rx="1.5" fill="#1E293B" stroke="#FFE500" strokeWidth="0.75" />
      <rect x="58" y="49" width="16" height="6" rx="1.5" fill="#334155" />
    </svg>
  ),
  "postcard_6x9-conquest": (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="80" height="56" fill="white" />
      <rect width="80" height="56" fill="#F9FAFB" />
      <rect x="0" y="0" width="80" height="4.5" fill="#16A34A" />
      <rect x="0" y="4.5" width="80" height="18" fill="#D1D5DB" />
      <path d="M15 19 L21 13 Q25 11 29 11 L44 11 Q49 11 53 13 L59 19 L60 21 L14 21 Z" fill="white" opacity="0.48" />
      <circle cx="25" cy="21" r="2.5" fill="#D1D5DB" />
      <circle cx="51" cy="21" r="2.5" fill="#D1D5DB" />
      <rect x="0" y="22.5" width="80" height="6" fill="#16A34A" />
      <rect x="4" y="24" width="28" height="2.5" rx="0.5" fill="white" opacity="0.7" />
      <rect x="60" y="24.5" width="15" height="1.5" rx="0.5" fill="white" opacity="0.5" />
      <rect x="4" y="31" width="24" height="4.5" rx="1.25" fill="#16A34A" />
      <rect x="5" y="32" width="22" height="2.5" rx="0.75" fill="white" opacity="0.65" />
      <rect x="4" y="38" width="52" height="4" rx="0.75" fill="#0F172A" />
      <rect x="4" y="44" width="36" height="2.5" rx="0.75" fill="#374151" opacity="0.55" />
      <rect x="4" y="48.5" width="44" height="1.5" rx="0.5" fill="#CBD5E1" />
      <rect x="62" y="31" width="14" height="14" rx="1.5" fill="white" stroke="#16A34A" strokeWidth="1" />
      <rect x="63.5" y="32.5" width="4" height="4" fill="#16A34A" opacity="0.8" />
      <rect x="69" y="32.5" width="4" height="4" fill="#16A34A" opacity="0.8" />
      <rect x="63.5" y="38" width="4" height="4" fill="#16A34A" opacity="0.8" />
      <rect x="69" y="38" width="4" height="2" fill="#16A34A" opacity="0.5" />
      <rect x="4" y="52" width="72" height="4" rx="1.25" fill="#16A34A" />
    </svg>
  ),
};

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
  dealershipLogoUrl?: string | null;
  dealershipPhone?: string | null;
  dealershipAddress?: Record<string, string> | null;
  dealershipHours?: Record<string, string> | null;
}

type Step = 1 | 2 | 3 | 4 | 5;

interface LayoutSuggestionParsed {
  templateType?: MailTemplateType;
  designStyle?: DesignStyle;
  heroTreatment?: "full-bleed" | "side-by-side" | "standard";
  couponPlacement?: "below-body" | "perforated" | "none";
  urgencyStyle?: "neon" | "strip" | "none";
  badgeSize?: "oversized" | "standard";
  actionRowLayout?: "side-by-side" | "stacked";
}

function parseLayoutSuggestion(suggestion: string): LayoutSuggestionParsed {
  const s = suggestion.toLowerCase();
  const result: LayoutSuggestionParsed = {};

  // Design style
  if (s.includes("conquest")) result.designStyle = "conquest";
  else if (s.includes("fluorescent") || (s.includes("neon") && !s.includes("neon urgency") && !s.includes("neon strip"))) result.designStyle = "premium-fluorescent";
  else if (s.includes("tri-fold") || s.includes("complex-fold") || s.includes("trifold") || s.includes("folded letter")) result.designStyle = "complex-fold";
  else if (s.includes("multi-panel") || s.includes("multipanel")) result.designStyle = "multi-panel";

  // Template type
  if (s.includes("8.5x11") || s.includes("8.5 x 11") || s.includes("letter 8.5")) result.templateType = "letter_8.5x11";
  else if (s.includes("letter") && !s.includes("folded letter")) result.templateType = "letter_6x9";

  // Hero treatment
  if (s.includes("full-bleed") || s.includes("full bleed")) result.heroTreatment = "full-bleed";
  else if (s.includes("side-by-side") || s.includes("side by side")) result.heroTreatment = "side-by-side";

  // Coupon placement
  if (s.includes("perforated coupon") || s.includes("perforated")) result.couponPlacement = "perforated";
  else if (s.includes("coupon below") || s.includes("coupon at bottom") || s.includes("coupon strip")) result.couponPlacement = "below-body";

  // Urgency style
  if (s.includes("neon urgency") || s.includes("neon strip") || s.includes("fluorescent urgency")) result.urgencyStyle = "neon";
  else if (s.includes("urgency strip") || s.includes("urgency bar") || s.includes("urgency band")) result.urgencyStyle = "strip";

  // Badge size
  if (s.includes("oversized") || s.includes("large badge") || s.includes("offerbadge") || s.includes("offer badge")) result.badgeSize = "oversized";

  // Action row
  if (s.includes("side-by-side cta") || s.includes("side-by-side qr") || s.includes("qr + cta")) result.actionRowLayout = "side-by-side";

  return result;
}

export function CampaignBuilder({ customers, dealershipName, dealershipLogoUrl, dealershipPhone, dealershipAddress, dealershipHours }: CampaignBuilderProps) {
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
  const [accentColor, setAccentColor] = useState<AccentColor>("indigo");
  const [designStyle, setDesignStyle] = useState<DesignStyle>("standard");
  const [includeBookNow, setIncludeBookNow] = useState(false);
  const [xtimeUrl, setXtimeUrl] = useState<string | null>(null);
  const [baselineCount, setBaselineCount] = useState<number | null>(null);

  // Load X-Time URL, baseline example count, and trigger opportunities on mount
  useState(() => {
    fetch("/api/integrations/xtime/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { xtime_url?: string | null } | null) => { if (d?.xtime_url) setXtimeUrl(d.xtime_url); })
      .catch(() => null);
    fetch("/api/dealership/baseline-examples")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { examples?: unknown[] } | null) => { if (d?.examples) setBaselineCount(d.examples.length); })
      .catch(() => null);
    fetch("/api/ai/triggers")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { opportunities?: TriggerOpportunity[] } | null) => { if (d?.opportunities?.length) setTriggers(d.opportunities); })
      .catch(() => null);
  });

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
    vehiclePhotoUrl: string | null;
    customerName: string | null;
    channel: BuilderChannel;
    designStyle?: DesignStyle;
    layoutSpec?: import("@/types").LayoutSpec;
    offer: string | null;
    headline: string | null;
    subHeadline: string | null;
    ctaText: string | null;
    urgencyLine: string | null;
    expiresText: string | null;
    conditionsText: string | null;
    layoutSuggestion: string | null;
  } | null>(null);
  const [layoutBannerDismissed, setLayoutBannerDismissed] = useState(false);
  const [showWhyTooltip, setShowWhyTooltip] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Variations
  type VariationResult = {
    customerId: string;
    customerName: string;
    variantLabel?: string;   // "Relationship" | "Bold Offer" | "Urgency Hook"
    variantFocus?: string;
    accentHue?: string;      // "relationship" | "offer" | "urgency"
    content: string;
    smsBody: string | null;
    subject: string | null;
    previewQrUrl: string | null;
    vehicle: string | null;
    confidence: number;
    designStyle?: DesignStyle;
    // Structured fields — drive TemplatePreview per variant
    headline: string | null;
    subHeadline: string | null;
    offer: string | null;
    ctaText: string | null;
    urgencyLine: string | null;
    expiresText: string | null;
    conditionsText: string | null;
    layoutSuggestion: string | null;
  };
  const [variations, setVariations] = useState<VariationResult[]>([]);
  const [generatingVariations, setGeneratingVariations] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null);

  // A/B test config
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [abTestVariantBIndex, setAbTestVariantBIndex] = useState(1);
  const [abTestSplitRatio, setAbTestSplitRatio] = useState(0.5);

  // Campaign score (Step 5)
  const [campaignScore, setCampaignScore] = useState<CampaignScoreResult | null>(null);
  const [campaignScoreLoading, setCampaignScoreLoading] = useState(false);

  // Test batch
  const [testBatchSize, setTestBatchSize] = useState<5 | 10>(5);
  const [testBatchLoading, setTestBatchLoading] = useState(false);
  const [testBatchResults, setTestBatchResults] = useState<Array<{
    customerId: string; customerName: string; success: boolean; message: string;
    result?: { postgrid_id?: string };
  }> | null>(null);

  // Step 5 — send
  const [sending, setSending] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [sendResults, setSendResults] = useState<ChannelResult[] | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // AI Trigger Opportunities (loaded on mount)
  type TriggerOpportunity = {
    id: string; type: string; urgency: "high" | "medium" | "low"; title: string;
    description: string; customerCount: number; suggestedGoal: string;
    suggestedChannel: string; estimatedROI: string; customerIds: string[];
  };
  const [triggers, setTriggers] = useState<TriggerOpportunity[]>([]);
  const [triggersDismissed, setTriggersDismissed] = useState<Set<string>>(new Set());

  // Predictive score (from preview result)
  type PredictiveScore = {
    expectedScanRatePct: number; expectedBookingLiftPct: number;
    roiEstimate: string; confidence: "high" | "medium" | "low";
    sampleSize: number; breakdown: string[];
  };
  const [predictiveScore, setPredictiveScore] = useState<PredictiveScore | null>(null);

  // Sequence preview (after send)
  type SequenceStep = { stepIndex: number; channel: string; dayOffset: number; condition: string; messageHint: string; estimatedCostLabel: string };
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);

  // GM Approval flow
  type ApprovalUiState = "idle" | "input_gm" | "submitting" | "sent" | "error";
  const [approvalState, setApprovalState] = useState<ApprovalUiState>("idle");
  const [gmEmail, setGmEmail] = useState("");
  const [approvalSentTo, setApprovalSentTo] = useState("");

  // ── Send Test Mail panel ──────────────────────────────────
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testCustomerId, setTestCustomerId] = useState<string>("");
  const [testOverrideAddress, setTestOverrideAddress] = useState<string>("");
  const [testTemplateType, setTestTemplateType] = useState<MailTemplateType>("postcard_6x9");
  const [testGoal, setTestGoal] = useState("Win back this customer with a personalized service reminder and special offer.");
  const [testLoading, setTestLoading] = useState(false);
  const [testPreview, setTestPreview] = useState<{ content: string; previewQrUrl: string | null; vehicle: string | null; vehiclePhotoUrl: string | null; reasoning: string; offer: string | null; headline: string | null; subHeadline: string | null; ctaText: string | null; urgencyLine: string | null; expiresText: string | null; conditionsText: string | null } | null>(null);
  const [testLiveResult, setTestLiveResult] = useState<ChannelResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const testCustomer = customers.find((c) => c.id === testCustomerId) ?? customers[0] ?? null;

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
      setTestPreview({ content: data.content, previewQrUrl: data.previewQrUrl, vehicle: data.vehicle, vehiclePhotoUrl: data.vehiclePhotoUrl ?? null, reasoning: data.reasoning, offer: data.offer ?? null, headline: data.headline ?? null, subHeadline: data.structured?.subHeadline ?? null, ctaText: data.structured?.ctaText ?? null, urgencyLine: data.structured?.urgencyLine ?? null, expiresText: data.structured?.couponBlock?.expiresText ?? null, conditionsText: data.structured?.couponBlock?.conditionsText ?? null });
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

  async function sendTestBatch() {
    if (selectedIds.size === 0) return;
    setTestBatchLoading(true);
    setTestBatchResults(null);
    setTestError(null);
    try {
      const res = await fetch("/api/mail/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: Array.from(selectedIds),
          templateType: testTemplateType,
          campaignGoal: testGoal,
          designStyle,
          batchSize: testBatchSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Batch send failed");
      const results = (data.results ?? []) as Array<{
        customerId: string; customerName: string;
        result: { success: boolean; message: string; postgrid_id?: string };
      }>;
      setTestBatchResults(results.map((r) => ({
        customerId: r.customerId,
        customerName: r.customerName,
        success: r.result.success,
        message: r.result.message,
        result: { postgrid_id: r.result.postgrid_id },
      })));
      toast({
        title: `Test batch dispatched`,
        description: `${data.successCount ?? 0} of ${data.totalProcessed ?? 0} pieces submitted to PostGrid`,
      });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Batch send failed");
    } finally {
      setTestBatchLoading(false);
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
    setPredictiveScore(null);
    setSequenceSteps([]);
    setLayoutBannerDismissed(false);
    setShowWhyTooltip(false);

    try {
      const res = await fetch("/api/mail/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: targetId,
          templateType: channel === "direct_mail" || channel === "multi_channel" ? templateType : undefined,
          campaignGoal,
          channel: channel === "multi_channel" ? "email" : channel,
          designStyle: channel === "direct_mail" ? designStyle : undefined,
          audienceSize: selectedIds.size || 1,
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
        vehiclePhotoUrl: data.vehiclePhotoUrl ?? null,
        customerName: data.customerName ?? null,
        channel,
        designStyle: data.designStyle ?? designStyle,
        layoutSpec: data.layoutSpec,
        offer: data.offer ?? null,
        headline: data.headline ?? null,
        subHeadline: data.structured?.subHeadline ?? null,
        ctaText: data.structured?.ctaText ?? null,
        urgencyLine: data.structured?.urgencyLine ?? null,
        expiresText: data.structured?.couponBlock?.expiresText ?? null,
        conditionsText: data.structured?.couponBlock?.conditionsText ?? null,
        layoutSuggestion: data.structured?.layoutSuggestion ?? null,
      });
      if (data.predictiveScore) setPredictiveScore(data.predictiveScore as PredictiveScore);
      setCurrentStep(4);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGeneratingPreview(false);
    }
  }, [previewCustomerId, customers, selectedIds, templateType, campaignGoal, channel]);

  // ── Generate style variations (3 creative approaches for the same customer) ─

  const generateVariations = useCallback(async () => {
    const targetId = previewCustomerId
      || Array.from(selectedIds)[0]
      || "";
    if (!targetId) return;

    setGeneratingVariations(true);
    setVariations([]);
    setSelectedVariation(null);
    setAbTestEnabled(false);

    try {
      const res = await fetch("/api/mail/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: targetId,
          templateType: channel === "direct_mail" ? templateType : undefined,
          campaignGoal,
          designStyle: channel === "direct_mail" ? designStyle : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.variants?.length) return;

      const built: VariationResult[] = (data.variants as Array<{
        variantLabel: string; variantFocus: string; accentHue?: string;
        content: string; reasoning: string; confidence: number;
        previewQrUrl: string | null; vehicle: string | null;
        headline: string | null; subHeadline: string | null; offer: string | null;
        ctaText: string | null; urgencyLine: string | null;
        expiresText: string | null; conditionsText: string | null;
        layoutSuggestion: string | null;
      }>).map((v) => ({
        customerId: targetId,
        customerName: data.customerName ?? "",
        variantLabel: v.variantLabel,
        variantFocus: v.variantFocus,
        accentHue: v.accentHue,
        content: v.content,
        smsBody: null,
        subject: null,
        previewQrUrl: v.previewQrUrl,
        vehicle: v.vehicle,
        confidence: v.confidence,
        designStyle,
        headline: v.headline,
        subHeadline: v.subHeadline,
        offer: v.offer,
        ctaText: v.ctaText,
        urgencyLine: v.urgencyLine,
        expiresText: v.expiresText,
        conditionsText: v.conditionsText,
        layoutSuggestion: v.layoutSuggestion,
      }));

      setVariations(built);
      if (built.length > 0) setSelectedVariation(0);
    } catch {
      // silent — user can retry
    } finally {
      setGeneratingVariations(false);
    }
  }, [previewCustomerId, selectedIds, templateType, campaignGoal, channel, designStyle]);

  // ── Campaign Score ────────────────────────────────────────

  const fetchCampaignScore = useCallback(async (content?: string) => {
    if (selectedIds.size === 0) return;
    setCampaignScoreLoading(true);
    try {
      const res = await fetch("/api/mail/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: Array.from(selectedIds),
          templateType: channel === "direct_mail" ? templateType : undefined,
          campaignGoal,
          channel: channel === "multi_channel" ? "direct_mail" : channel,
          previewContent: content ?? previewResult?.content,
        }),
      });
      if (res.ok) setCampaignScore(await res.json());
    } catch { /* non-fatal */ }
    finally { setCampaignScoreLoading(false); }
  }, [selectedIds, templateType, campaignGoal, channel, previewResult]);

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
          body: JSON.stringify({
            customerIds, templateType, campaignGoal, dryRun, campaignType, accentColor, includeBookNow, designStyle,
            abTestConfig: abTestEnabled && variations[abTestVariantBIndex]
              ? {
                  enabled: true,
                  variantALabel: variations[0]?.variantLabel ?? "Control",
                  variantBLabel: variations[abTestVariantBIndex]?.variantLabel ?? "Variant B",
                  variantBStyle: variations[abTestVariantBIndex]?.variantFocus ?? "",
                  splitRatio: abTestSplitRatio,
                }
              : undefined,
          }),
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

      // Build sequence preview locally (mirrors sequence-planner logic, no API call needed)
      if (channel === "direct_mail" && !dryRun) {
        const steps: SequenceStep[] = [];
        if (withPhone > 0) steps.push({ stepIndex: 1, channel: "sms", dayOffset: 14, condition: "no_scan_14d", messageHint: "SMS nudge for customers who haven't scanned the postcard yet.", estimatedCostLabel: "$0.02 / SMS" });
        if (withEmail > 0) steps.push({ stepIndex: 2, channel: "email", dayOffset: 21, condition: "no_scan_21d", messageHint: "Email follow-up with fresh angle for non-responders.", estimatedCostLabel: "$0.001 / email" });
        setSequenceSteps(steps);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }

  async function requestApproval() {
    if (!gmEmail.trim().includes("@")) { return; }
    setApprovalState("submitting");
    try {
      const res = await fetch("/api/campaign/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmEmail: gmEmail.trim(),
          customerIds: Array.from(selectedIds),
          channel,
          templateType: channel === "direct_mail" || channel === "multi_channel" ? templateType : undefined,
          campaignGoal,
          designStyle: channel === "direct_mail" ? designStyle : undefined,
          accentColor,
          includeBookNow,
          campaignType,
          dealershipName,
          estimatedCost: estimateCost(),
          channelLabel: channelCfg.label,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send approval request");
      setApprovalSentTo(gmEmail.trim());
      setApprovalState("sent");
      toast({
        title: "Approval request sent",
        description: `Email sent to ${gmEmail.trim()}. Campaign will execute only after GM approval.`,
      });
    } catch (err) {
      setApprovalState("error");
      setSendError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const selectedCount = selectedIds.size;
  const channelCfg = CHANNEL_CONFIG[channel];

  const previewCustomer = useMemo(() => {
    const targetId = previewCustomerId || Array.from(selectedIds)[0];
    return customers.find((c) => c.id === targetId) ?? null;
  }, [previewCustomerId, selectedIds, customers]);

  function estimateCost(): string {
    const n = selectedCount;
    if (channel === "direct_mail") return `$${(n * 1.2).toFixed(2)}`;
    if (channel === "sms") return `$${(n * 0.02).toFixed(2)}`;
    if (channel === "email") return "Free";
    return `~$${(n * 0.62).toFixed(2)}`;
  }

  const needsMailTemplate = channel === "direct_mail" || channel === "multi_channel";

  const suggestedConfig = useMemo((): { config: TemplateConfig; reason: string } | null => {
    if (selectedCount === 0) return null;
    const g = campaignGoal.toLowerCase();
    const sel = customers.filter((c) => selectedIds.has(c.id));
    const stages = new Set(sel.map((c) => c.lifecycle_stage));
    const prospectCount = sel.filter((c) => c.lifecycle_stage === "prospect").length;
    const lapsedCount = sel.filter((c) => c.lifecycle_stage === "lapsed").length;
    const vipCount = sel.filter((c) => c.lifecycle_stage === "vip").length;
    const prospectPct = Math.round((prospectCount / selectedCount) * 100);
    const lapsedPct = Math.round((lapsedCount / selectedCount) * 100);

    if (stages.has("prospect") && !stages.has("vip") && !stages.has("lapsed")) {
      return {
        config: TEMPLATE_CONFIGS.find((c) => c.designStyle === "conquest")!,
        reason: `${prospectPct}% of your audience are new prospects. The Conquest Postcard's clean, high-contrast design is optimized for first impressions — bold headline, clear CTA, no clutter.`,
      };
    }
    if (g.includes("recall") || g.includes("warrant") || g.includes("legal") || g.includes("compli")) {
      return {
        config: TEMPLATE_CONFIGS.find((c) => c.templateType === "letter_8.5x11")!,
        reason: `Your campaign goal mentions a formal or compliance-related topic. A full-page letter in an envelope signals seriousness and is more appropriate than a postcard for legal communications.`,
      };
    }
    if (stages.has("vip") || g.includes("appreciat") || g.includes("event") || g.includes("vip")) {
      const note = vipCount > 0 ? `${vipCount} VIP customer${vipCount > 1 ? "s" : ""} in your audience` : "Event or appreciation keywords detected in your goal";
      return {
        config: TEMPLATE_CONFIGS.find((c) => c.designStyle === "premium-fluorescent")!,
        reason: `${note}. The Fluorescent Offer Card's bold dark design with neon accents commands attention and signals exclusivity — proven to increase callback rates by up to 33%.`,
      };
    }
    if (stages.has("lapsed") && !stages.has("vip") && !stages.has("active")) {
      return {
        config: TEMPLATE_CONFIGS.find((c) => c.designStyle === "complex-fold")!,
        reason: `${lapsedPct}% of your audience are lapsed customers. The Folded Self-Mailer's tri-fold format has more space to re-introduce your dealership — the cover hooks attention while inner panels deliver a personalized win-back offer.`,
      };
    }
    return {
      config: TEMPLATE_CONFIGS.find((c) => c.designStyle === "standard" && c.templateType === "postcard_6x9")!,
      reason: `Your mixed audience (active, at-risk, and returning customers) responds well to a personal touch. The Classic Postcard's handwritten note style drives strong engagement at the lowest cost per piece.`,
    };
  }, [campaignGoal, selectedIds, customers, selectedCount]);

  const selectedTemplateCfg = TEMPLATE_CONFIGS.find(
    (c) => c.templateType === templateType && c.designStyle === designStyle
  ) ?? null;

  return (
    <div className="space-y-5">

      {/* ── Send Test Mail panel ───────────────────────────── */}
      <div
        className={cn(
          "rounded-[var(--radius)] transition-all duration-200",
          testPanelOpen
            ? "shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
            : "hover:shadow-[0_0_0_3px_rgba(16,185,129,0.08)] shadow-card"
        )}
        style={{
          border: testPanelOpen ? "2px solid #10B981" : "2px solid #A7F3D0",
          background: testPanelOpen ? "rgba(236,253,245,0.45)" : "#fff",
        }}
      >
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)" }}>
              <Send className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-bold text-slate-900">Send Test Mail</p>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: "#D1FAE5", color: "#065F46" }}>REAL POSTGRID</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Generate + mail a real piece to any address. No charge in test mode.</p>
            </div>
          </div>
          <Button
            size="sm"
            variant={testPanelOpen ? "outline" : "default"}
            className={cn("h-9 px-4 shrink-0 font-semibold", !testPanelOpen && "bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm")}
            onClick={() => { setTestPanelOpen((o) => !o); setTestPreview(null); setTestLiveResult(null); setTestError(null); setTestOverrideAddress(""); }}
          >
            {testPanelOpen ? <><X className="mr-1.5 w-3.5 h-3.5" />Close</> : <><Send className="mr-1.5 w-3.5 h-3.5" />Open Test Panel</>}
          </Button>
        </div>

        {testPanelOpen && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Test customer</label>
                <select className="w-full border border-slate-200 rounded-[var(--radius)] px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 bg-slate-50/50"
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
                <select className="w-full border border-slate-200 rounded-[var(--radius)] px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 bg-slate-50/50"
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
              <textarea className="w-full border border-slate-200 rounded-[var(--radius)] p-3 text-base sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 h-16 bg-slate-50/50"
                value={testGoal} onChange={(e) => { setTestGoal(e.target.value); setTestPreview(null); setTestLiveResult(null); }} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Override delivery address</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-[var(--radius)] px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 bg-slate-50/50"
                placeholder="123 Main St, Phoenix AZ 85001 (defaults to customer's address)"
                value={testOverrideAddress}
                onChange={(e) => setTestOverrideAddress(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 leading-relaxed">Leave blank to use the customer's address on file. Enter your own address to receive the physical test piece.</p>
            </div>

            {testError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-[var(--radius)]">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{testError}</p>
              </div>
            )}

            {!testPreview && !testLiveResult && !testBatchResults && (
              <div className="space-y-3">
                <Button onClick={runTestPreview} disabled={testLoading || testBatchLoading || customers.length === 0} className="w-full h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 border-0" style={{ boxShadow: "0 1px 3px rgba(5,150,105,0.25), 0 4px 12px rgba(5,150,105,0.15)" }}>
                  {testLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Zap className="mr-2 h-4 w-4" />Generate AI Copy &amp; Preview (1 piece)</>}
                </Button>

                {/* Send Test Batch */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-600">Send Test Batch</p>
                    <div className="flex gap-1.5">
                      {([5, 10] as const).map((n) => (
                        <button key={n} onClick={() => setTestBatchSize(n)}
                          className={cn(
                            "px-2.5 py-1 text-xs font-bold rounded border transition-all",
                            testBatchSize === n ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:border-emerald-300"
                          )}>
                          {n} pieces
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Picks one representative from each lifecycle stage (VIP, lapsed, active, at-risk) and sends real PostGrid test pieces in a single batch.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={sendTestBatch}
                    disabled={testBatchLoading || testLoading || selectedIds.size === 0}
                  >
                    {testBatchLoading
                      ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Sending batch…</>
                      : <><Send className="mr-2 h-3.5 w-3.5" />Send Test Batch ({testBatchSize} pieces)</>}
                  </Button>
                </div>
              </div>
            )}

            {/* Test batch results */}
            {testBatchResults && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Batch sent — {testBatchResults.filter((r) => r.success).length}/{testBatchResults.length} succeeded
                  </p>
                  <button onClick={() => setTestBatchResults(null)} className="text-[10px] text-slate-400 hover:text-slate-700">Reset</button>
                </div>
                <div className="divide-y divide-slate-50 border border-slate-100 rounded-[var(--radius)] max-h-52 overflow-y-auto">
                  {testBatchResults.map((r, i) => (
                    <div key={i} className="px-3 py-2.5 flex items-center gap-3">
                      {r.success ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-slate-900 truncate">{r.customerName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{r.result?.postgrid_id ?? r.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {testPreview && !testLiveResult && (
              <div className="space-y-4">
                <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-[var(--radius)] text-xs text-indigo-800">
                  <strong>AI reasoning:</strong> {testPreview.reasoning}
                </div>
                <TemplatePreview
                  templateType={testTemplateType}
                  content={testPreview.content}
                  dealershipName={dealershipName}
                  customerName={testCustomer ? `${testCustomer.first_name} ${testCustomer.last_name}` : undefined}
                  vehicle={testPreview.vehicle}
                  vehiclePhotoUrl={testPreview.vehiclePhotoUrl ?? null}
                  qrPreviewUrl={testPreview.previewQrUrl ?? undefined}
                  logoUrl={dealershipLogoUrl}
                  accentColor={accentColor}
                  customerAddress={testCustomer?.address ?? null}
                  dealershipAddress={dealershipAddress}
                  dealershipPhone={dealershipPhone}
                  offer={testPreview.offer}
                  headline={testPreview.headline}
                  subHeadline={testPreview.subHeadline}
                  ctaText={testPreview.ctaText}
                  urgencyLine={testPreview.urgencyLine}
                  expiresText={testPreview.expiresText}
                  conditionsText={testPreview.conditionsText}
                  initialMode="realistic"
                />
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

            {/* AI Trigger Suggestions */}
            {triggers.filter((t) => !triggersDismissed.has(t.id)).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-500" /> AI Detected Opportunities
                </p>
                {triggers.filter((t) => !triggersDismissed.has(t.id)).slice(0, 3).map((t) => (
                  <div key={t.id} className={cn(
                    "rounded-[var(--radius)] border p-3 flex items-start gap-3 transition-all",
                    t.urgency === "high" ? "border-red-200 bg-red-50/50" :
                    t.urgency === "medium" ? "border-amber-200 bg-amber-50/50" :
                    "border-slate-200 bg-slate-50/50"
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          t.urgency === "high" ? "bg-red-100 text-red-700" :
                          t.urgency === "medium" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-500")}>{t.urgency}</span>
                        <p className="text-[12px] font-semibold text-slate-900 truncate">{t.title}</p>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">{t.description}</p>
                      <p className="text-[10px] text-emerald-600 font-medium mt-1">{t.estimatedROI}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                        onClick={() => {
                          if (t.customerIds.length > 0) {
                            setSelectedIds(new Set(t.customerIds.filter((id) => customers.some((c) => c.id === id))));
                          }
                          setCampaignGoal(t.suggestedGoal);
                          setCurrentStep(2);
                        }}
                      >Use this →</button>
                      <button
                        className="text-[10px] text-slate-400 hover:text-slate-600"
                        onClick={() => setTriggersDismissed((prev) => new Set([...prev, t.id]))}
                      >Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
              <div className="grid grid-cols-3 gap-3">
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
                <button
                  onClick={() => {
                    setCampaignType("coop");
                    setCampaignGoal("Run a manufacturer co-op campaign with compliant copy, required disclaimers, and reimbursement tracking.");
                  }}
                  className={cn(
                    "text-left p-4 rounded-[var(--radius)] border-2 transition-all relative overflow-hidden",
                    campaignType === "coop"
                      ? "border-violet-400 bg-violet-50/60"
                      : "bg-white border-slate-200 hover:border-violet-300"
                  )}
                >
                  {campaignType === "coop" && (
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-violet-400" />
                  )}
                  <div className="flex items-center gap-2 mb-1.5">
                    <Award className={cn("w-4 h-4", campaignType === "coop" ? "text-violet-600" : "text-slate-400")} />
                    <p className="text-[13px] font-semibold text-slate-900">Co-op</p>
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">OEM</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">Manufacturer-funded campaigns with automatic compliance checking and reimbursement estimation.</p>
                  {campaignType === "coop" && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-violet-700 font-medium">
                      <Award className="w-3 h-3" /> Disclaimers auto-injected
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

            {/* Unified template selector */}
            {needsMailTemplate && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Template Style
                </p>

                {/* AI recommendation banner */}
                {suggestedConfig && (
                  <div className={cn(
                    "flex items-start gap-3 p-3 rounded-[var(--radius)] border transition-all",
                    designStyle === suggestedConfig.config.designStyle && templateType === suggestedConfig.config.templateType
                      ? "bg-emerald-50/70 border-emerald-200"
                      : "bg-indigo-50/60 border-indigo-200"
                  )}>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">AI Recommendation</span>
                        <span className="text-[10px] font-semibold text-slate-700">· {suggestedConfig.config.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-snug">{suggestedConfig.reason}</p>
                    </div>
                    {designStyle !== suggestedConfig.config.designStyle || templateType !== suggestedConfig.config.templateType ? (
                      <button
                        onClick={() => { setTemplateType(suggestedConfig.config.templateType); setDesignStyle(suggestedConfig.config.designStyle); setAccentColor(suggestedConfig.config.accentDefault); }}
                        className="shrink-0 text-[9px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded px-2.5 py-1.5 transition-colors whitespace-nowrap"
                      >
                        Apply
                      </button>
                    ) : (
                      <span className="shrink-0 text-[9px] font-bold text-emerald-700 bg-emerald-100 rounded px-2 py-1 whitespace-nowrap">Applied ✓</span>
                    )}
                  </div>
                )}

                {/* Template cards — horizontal layout with thumbnail */}
                <div className="space-y-2">
                  {TEMPLATE_CONFIGS.map((cfg) => {
                    const isSelected = templateType === cfg.templateType && designStyle === cfg.designStyle;
                    const isSuggested = suggestedConfig?.config.designStyle === cfg.designStyle && suggestedConfig?.config.templateType === cfg.templateType;
                    const thumbKey = `${cfg.templateType}-${cfg.designStyle}`;
                    const totalCost = withAddress > 0 ? `$${(withAddress * cfg.costPerPiece).toFixed(2)} total` : null;
                    return (
                      <button
                        key={thumbKey}
                        onClick={() => { setTemplateType(cfg.templateType); setDesignStyle(cfg.designStyle); if (cfg.accentDefault !== "indigo" || !isSelected) setAccentColor(cfg.accentDefault); }}
                        className={cn(
                          "w-full text-left flex items-center gap-3 p-2.5 border-2 rounded-[var(--radius)] transition-all hover:shadow-sm relative overflow-hidden",
                          isSelected ? "border-indigo-400 bg-indigo-50/60" : "bg-white border-slate-200 hover:border-indigo-300"
                        )}
                      >
                        {isSelected && <div className="absolute top-0 left-0 bottom-0 w-[3px] bg-indigo-500" />}
                        <div className="shrink-0 w-[88px] h-[62px] rounded overflow-hidden border border-slate-200 bg-slate-50">
                          {TEMPLATE_THUMBS[thumbKey]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[12px] font-semibold text-slate-900">{cfg.label}</span>
                            {isSuggested ? (
                              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 whitespace-nowrap">AI ✦</span>
                            ) : cfg.badge ? (
                              <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 whitespace-nowrap">{cfg.badge}</span>
                            ) : null}
                          </div>
                          <p className="text-[10px] text-slate-400 leading-snug line-clamp-2 mb-1.5">{cfg.description}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-700">{cfg.cost}/piece</span>
                            {totalCost && <span className="text-[10px] text-slate-500">· {totalCost}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Live cost estimator */}
                {selectedTemplateCfg && withAddress > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500">{withAddress} addressable customers × {selectedTemplateCfg.cost}/piece</span>
                    <span className="text-[11px] font-bold text-slate-800">${(withAddress * selectedTemplateCfg.costPerPiece).toFixed(2)} estimated</span>
                  </div>
                )}

                {designStyle !== "standard" && (
                  <p className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2.5 py-1.5">
                    AI will output a structured layout spec with panels, colors, and print-house notes in addition to personalized copy.
                  </p>
                )}
              </div>
            )}

            {/* Accent color picker — only for direct mail */}
            {needsMailTemplate && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Offer Accent Color</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { color: "indigo" as AccentColor, swatch: "#6366F1", label: "Indigo", lift: null },
                    { color: "yellow" as AccentColor, swatch: "#EAB308", label: "Yellow", lift: "+33%" },
                    { color: "orange" as AccentColor, swatch: "#F97316", label: "Orange", lift: "+28%" },
                    { color: "pink"   as AccentColor, swatch: "#EC4899", label: "Pink",   lift: "+22%" },
                    { color: "green"  as AccentColor, swatch: "#22C55E", label: "Green",  lift: null },
                  ]).map(({ color, swatch, label, lift }) => (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] border text-xs font-semibold transition-all",
                        accentColor === color
                          ? "bg-white border-slate-300 shadow-sm text-slate-900"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white"
                        style={{ background: swatch, boxShadow: accentColor === color ? `0 0 0 1.5px ${swatch}` : "none" }}
                      />
                      {label}
                      {lift && (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700 whitespace-nowrap">
                          ⚡ {lift} callbacks
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {(accentColor === "yellow" || accentColor === "orange" || accentColor === "pink") && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2.5 py-1.5">
                    Fluorescent offer strips are printed with specialty ink and are proven to increase callback rates by up to 33% vs. standard ink.
                  </p>
                )}
              </div>
            )}


            {/* Book Now / X-Time toggle */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <input
                type="checkbox"
                id="include-book-now"
                checked={includeBookNow}
                onChange={(e) => setIncludeBookNow(e.target.checked)}
                disabled={!xtimeUrl}
                className="mt-0.5 rounded"
              />
              <label htmlFor="include-book-now" className="text-sm cursor-pointer flex-1">
                <span className="font-medium text-slate-800">Include "Book Now" link (X-Time)</span>
                {xtimeUrl ? (
                  <p className="text-xs text-slate-500 mt-0.5">AI will naturally include your X-Time scheduling URL in the call-to-action.</p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Set your X-Time URL in{" "}
                    <a href="/dashboard/integrations" className="text-indigo-600 hover:underline">Integrations → X-Time</a>{" "}
                    to enable this.
                  </p>
                )}
              </label>
            </div>

            {/* Baseline style indicator */}
            {baselineCount !== null && baselineCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                <span className="text-emerald-500 font-bold">✓</span>
                Using dealership baseline style from {baselineCount} past campaign{baselineCount !== 1 ? "s" : ""}
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
              {campaignType === "coop" && " Manufacturer co-op compliance is enforced automatically."}
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
            {campaignType === "coop" && (
              <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-100 rounded-[var(--radius)] text-xs text-violet-800">
                <Award className="w-3.5 h-3.5 mt-0.5 shrink-0 text-violet-600" />
                <span>
                  <strong>Co-op mode:</strong> The Co-op Agent will check active manufacturer programs, verify eligibility, and inject required disclaimers and copy rules before the Creative Agent writes any message.
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
                className="w-full border border-slate-200 rounded-[var(--radius)] px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 bg-slate-50/50"
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

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={generatePreview} disabled={generatingPreview || generatingVariations || selectedCount === 0} className="flex-1 min-w-[160px]">
                {generatingPreview ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Zap className="mr-2 h-4 w-4" />Generate AI Copy</>}
              </Button>
              {channel === "direct_mail" && (
                <Button
                  variant="outline"
                  onClick={generateVariations}
                  disabled={generatingVariations || generatingPreview || selectedCount === 0}
                  className="flex-1 min-w-[160px] border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  {generatingVariations
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
                    : <><Sparkles className="mr-2 h-4 w-4" />Generate {Math.min(3, selectedCount)} Variations</>
                  }
                </Button>
              )}
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

            {/* ── Style Variations Grid ─────────────────────────── */}
            {generatingVariations && (
              <div
                className="rounded-xl p-6 flex flex-col items-center gap-3"
                style={{ background: "linear-gradient(135deg,#09172A,#0E1F3C)", border: "1px solid rgba(99,102,241,0.2)" }}
              >
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">Generating 3 Variations…</p>
                  <p className="text-xs text-slate-400 mt-0.5">Running parallel Claude calls — Relationship · Bold Offer · Urgency Hook</p>
                </div>
              </div>
            )}

            {!generatingVariations && variations.length > 0 && (
              <div className="space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                    </div>
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">
                      {variations.length} Creative Variants — Choose &amp; Apply
                    </p>
                  </div>
                  <button
                    onClick={generateVariations}
                    disabled={generatingVariations}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </button>
                </div>

                {/* 3-card grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {variations.map((v, i) => {
                    const isApplied = selectedVariation === i;
                    const accentColors = [
                      { badge: "bg-violet-100 text-violet-700 border-violet-200", border: "#7c3aed", glow: "rgba(124,58,237,0.12)", applyBg: "#7c3aed" },
                      { badge: "bg-amber-100 text-amber-700 border-amber-200",    border: "#d97706", glow: "rgba(217,119,6,0.12)",  applyBg: "#0f172a" },
                      { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", border: "#059669", glow: "rgba(5,150,105,0.12)", applyBg: "#059669" },
                    ][i] ?? { badge: "bg-slate-100 text-slate-600 border-slate-200", border: "#64748b", glow: "rgba(100,116,139,0.12)", applyBg: "#0f172a" };

                    return (
                      <div
                        key={i}
                        className="rounded-xl overflow-hidden flex flex-col transition-all duration-200"
                        style={{
                          border: `2px solid ${isApplied ? accentColors.border : "#e2e8f0"}`,
                          boxShadow: isApplied ? `0 0 0 3px ${accentColors.glow}, 0 4px 16px rgba(0,0,0,0.06)` : "0 1px 4px rgba(0,0,0,0.04)",
                          background: isApplied ? `${accentColors.glow}` : "#fff",
                        }}
                      >
                        {/* Card header */}
                        <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border", accentColors.badge)}>
                            {v.variantLabel ?? `Variant ${i + 1}`}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600">{Math.round(v.confidence * 100)}% conf</span>
                        </div>

                        {/* Focus line */}
                        {v.variantFocus && (
                          <p className="px-3 pb-2 text-[10px] text-slate-400 italic leading-snug">{v.variantFocus}</p>
                        )}

                        {/* Headline */}
                        {v.headline && (
                          <p className="px-3 pb-1 text-[12px] font-bold text-slate-900 leading-snug line-clamp-2">{v.headline}</p>
                        )}

                        {/* Body excerpt */}
                        <p className="px-3 pb-2 text-[11px] text-slate-600 leading-relaxed line-clamp-4 flex-1">{v.content}</p>

                        {/* Offer pill */}
                        {v.offer && (
                          <div className="px-3 pb-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              🎁 {v.offer}
                            </span>
                          </div>
                        )}

                        {/* Layout suggestion */}
                        {v.layoutSuggestion && (
                          <div className="mx-3 mb-2 px-2.5 py-2 rounded-lg text-[10px] leading-relaxed"
                            style={{ background: "linear-gradient(135deg,#09172A,#0E1F3C)", color: "#34D399" }}>
                            <span className="font-bold text-[9px] uppercase tracking-widest text-emerald-400 block mb-0.5">AI Layout</span>
                            <span className="text-slate-300 line-clamp-3">{v.layoutSuggestion}</span>
                          </div>
                        )}

                        {/* Apply button */}
                        <div className="px-3 pb-3">
                          {isApplied ? (
                            <div className="h-8 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-bold"
                              style={{ background: accentColors.glow, color: accentColors.border, border: `1px solid ${accentColors.border}` }}>
                              <CheckCircle className="w-3.5 h-3.5" /> Applied
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedVariation(i);
                                setLayoutBannerDismissed(false);
                                setPreviewResult({
                                  content:          v.content,
                                  subject:          v.subject,
                                  smsBody:          v.smsBody,
                                  reasoning:        v.variantFocus ?? previewResult.reasoning,
                                  confidence:       v.confidence,
                                  previewQrUrl:     v.previewQrUrl,
                                  vehicle:          v.vehicle,
                                  vehiclePhotoUrl:  null,
                                  customerName:     previewResult.customerName,
                                  channel:          previewResult.channel,
                                  designStyle:      v.designStyle ?? previewResult.designStyle,
                                  layoutSpec:       previewResult.layoutSpec,
                                  offer:            v.offer,
                                  headline:         v.headline,
                                  subHeadline:      v.subHeadline,
                                  ctaText:          v.ctaText,
                                  urgencyLine:      v.urgencyLine,
                                  expiresText:      v.expiresText,
                                  conditionsText:   v.conditionsText,
                                  layoutSuggestion: v.layoutSuggestion,
                                });
                              }}
                              className="w-full h-8 rounded-lg text-[11px] font-bold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                              style={{ background: accentColors.applyBg }}
                            >
                              Apply This Variant
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* A/B test configuration */}
                {variations.length >= 2 && (
                  <div className={cn(
                    "rounded-[var(--radius)] border-2 transition-all",
                    abTestEnabled ? "border-violet-300 bg-violet-50/40" : "border-slate-200 bg-white hover:border-slate-300"
                  )}>
                    <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={abTestEnabled}
                        onChange={(e) => setAbTestEnabled(e.target.checked)}
                        className="rounded"
                      />
                      <SplitSquareHorizontal className={cn("w-4 h-4 shrink-0", abTestEnabled ? "text-violet-600" : "text-slate-400")} />
                      <div>
                        <p className="text-[13px] font-semibold text-slate-900">A/B Test this campaign</p>
                        <p className="text-xs text-slate-400">Split your audience and measure which creative style performs better.</p>
                      </div>
                    </label>
                    {abTestEnabled && (
                      <div className="border-t border-violet-100 px-4 pb-4 pt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Variant A (control)</p>
                            <div className="p-2.5 rounded-lg bg-violet-50 border border-violet-100 text-xs text-violet-800 font-medium">
                              {variations[0]?.variantLabel ?? "First variation"}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Variant B (challenger)</p>
                            <select
                              value={abTestVariantBIndex}
                              onChange={(e) => setAbTestVariantBIndex(Number(e.target.value))}
                              className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                            >
                              {variations.slice(1).map((v, i) => (
                                <option key={i + 1} value={i + 1}>{v.variantLabel ?? `Variation ${i + 2}`}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Split ratio</p>
                          <div className="flex gap-2">
                            {([0.5, 0.67, 0.75] as const).map((ratio) => (
                              <button
                                key={ratio}
                                onClick={() => setAbTestSplitRatio(ratio)}
                                className={cn(
                                  "flex-1 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all",
                                  abTestSplitRatio === ratio
                                    ? "border-violet-400 bg-violet-50 text-violet-800"
                                    : "border-slate-200 text-slate-500 hover:border-violet-300"
                                )}
                              >
                                {ratio === 0.5 ? "50/50" : ratio === 0.67 ? "67/33" : "75/25"}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {Math.round(selectedCount * abTestSplitRatio)} customers → Variant A &nbsp;·&nbsp; {Math.round(selectedCount * (1 - abTestSplitRatio))} → Variant B
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* AI Layout Recommendation Banner — premium institutional */}
            {previewResult.layoutSuggestion && !layoutBannerDismissed && (
              <div style={{
                background: "linear-gradient(135deg, #09172A 0%, #0E1F3C 100%)",
                border: "1px solid rgba(16,185,129,0.22)",
                borderLeft: "3px solid #10B981",
                borderRadius: "var(--radius, 8px)",
                boxShadow: "0 0 0 1px rgba(16,185,129,0.07), 0 6px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}>
                {/* Sparkle icon */}
                <div style={{
                  marginTop: "1px", width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0,
                  background: "linear-gradient(135deg, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0.10) 100%)",
                  border: "1px solid rgba(16,185,129,0.30)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: "#34D399" }} />
                </div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "9.5px", fontWeight: 800, color: "#34D399", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
                      AI Autonomous Designer
                    </p>
                    {/* Why this? tooltip trigger */}
                    <div className="relative">
                      <button
                        onMouseEnter={() => setShowWhyTooltip(true)}
                        onMouseLeave={() => setShowWhyTooltip(false)}
                        onFocus={() => setShowWhyTooltip(true)}
                        onBlur={() => setShowWhyTooltip(false)}
                        style={{ width: "14px", height: "14px", borderRadius: "50%", border: "1px solid rgba(52,211,153,0.35)", background: "rgba(52,211,153,0.10)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}
                        aria-label="Why this layout?"
                      >
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 800, color: "#34D399", lineHeight: 1 }}>?</span>
                      </button>
                      {showWhyTooltip && (
                        <div style={{
                          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                          width: "260px", background: "#0A1628", border: "1px solid rgba(16,185,129,0.28)",
                          borderRadius: "8px", padding: "10px 12px",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.40), 0 0 0 1px rgba(16,185,129,0.08)",
                          zIndex: 50,
                        }}>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "9px", fontWeight: 800, color: "#34D399", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: "5px" }}>Based on performance history</p>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(226,232,240,0.85)", lineHeight: 1.5, margin: 0 }}>
                            {previewResult.reasoning.length > 180 ? previewResult.reasoning.slice(0, 180) + "…" : previewResult.reasoning}
                          </p>
                          {/* Arrow */}
                          <div style={{ position: "absolute", bottom: "-5px", left: "50%", transform: "translateX(-50%) rotate(45deg)", width: "8px", height: "8px", background: "#0A1628", borderRight: "1px solid rgba(16,185,129,0.28)", borderBottom: "1px solid rgba(16,185,129,0.28)" }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 500, color: "rgba(226,232,240,0.92)", lineHeight: 1.45, margin: 0 }}>
                    {previewResult.layoutSuggestion}
                  </p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "10.5px", color: "rgba(148,163,184,0.70)", marginTop: "4px", margin: "4px 0 0" }}>
                    Recommended based on your dealership's highest-response campaigns
                  </p>
                </div>

                {/* Action area */}
                <div className="flex items-center gap-1.5 shrink-0" style={{ marginTop: "2px" }}>
                  {(() => {
                    const parsed = parseLayoutSuggestion(previewResult.layoutSuggestion!);
                    const hasChange = parsed.templateType || parsed.designStyle;
                    return hasChange ? (
                      <button
                        onClick={() => {
                          if (parsed.templateType) setTemplateType(parsed.templateType);
                          if (parsed.designStyle) setDesignStyle(parsed.designStyle);
                          setLayoutBannerDismissed(true);
                        }}
                        style={{
                          fontFamily: "'Inter', sans-serif", fontSize: "11.5px", fontWeight: 700,
                          color: "#09172A", background: "#34D399",
                          borderRadius: "6px", padding: "6px 12px", border: "none", cursor: "pointer",
                          whiteSpace: "nowrap", transition: "all 0.15s ease",
                          boxShadow: "0 2px 8px rgba(52,211,153,0.30)",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#6EE7B7"; e.currentTarget.style.boxShadow = "0 0 16px rgba(52,211,153,0.55), 0 4px 12px rgba(0,0,0,0.20)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#34D399"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(52,211,153,0.30)"; e.currentTarget.style.transform = "translateY(0)"; }}
                      >
                        Apply Layout
                      </button>
                    ) : null;
                  })()}
                  <button
                    onClick={() => setLayoutBannerDismissed(true)}
                    style={{ width: "22px", height: "22px", borderRadius: "5px", border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(148,163,184,0.60)", transition: "color 0.12s, background 0.12s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(226,232,240,0.80)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(148,163,184,0.60)"; e.currentTarget.style.background = "transparent"; }}
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {previewResult.channel === "direct_mail" && previewResult.previewQrUrl && (
              <TemplatePreview
                templateType={templateType}
                content={previewResult.content}
                dealershipName={dealershipName}
                customerName={previewResult.customerName ?? undefined}
                vehicle={previewResult.vehicle}
                vehiclePhotoUrl={previewResult.vehiclePhotoUrl}
                qrPreviewUrl={previewResult.previewQrUrl}
                logoUrl={dealershipLogoUrl}
                accentColor={accentColor}
                designStyle={previewResult.designStyle ?? designStyle}
                layoutSpec={previewResult.layoutSpec}
                customerAddress={previewCustomer?.address ?? null}
                dealershipAddress={dealershipAddress}
                dealershipPhone={dealershipPhone}
                offer={previewResult.offer}
                headline={previewResult.headline}
                subHeadline={previewResult.subHeadline}
                ctaText={previewResult.ctaText}
                urgencyLine={previewResult.urgencyLine}
                expiresText={previewResult.expiresText}
                conditionsText={previewResult.conditionsText}
                layoutSuggestion={previewResult.layoutSuggestion}
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

            {/* Predictive Performance Score */}
            {predictiveScore && channel === "direct_mail" && (
              <div className="rounded-[var(--radius)] border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
                  <p className="text-[12px] font-semibold text-slate-900 flex-1">Predicted Performance</p>
                  <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                    predictiveScore.confidence === "high" ? "bg-emerald-100 text-emerald-700" :
                    predictiveScore.confidence === "medium" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-500"
                  )}>{predictiveScore.confidence} confidence · {predictiveScore.sampleSize} samples</span>
                </div>
                <div className="px-4 py-3 grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-[22px] font-bold text-indigo-600">{predictiveScore.expectedScanRatePct}%</p>
                    <p className="text-[10px] text-slate-400 font-medium">Expected scan rate</p>
                  </div>
                  <div className="text-center border-x border-slate-100">
                    <p className="text-[22px] font-bold text-emerald-600">+{predictiveScore.expectedBookingLiftPct}%</p>
                    <p className="text-[10px] text-slate-400 font-medium">Booking lift</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-bold text-slate-900 leading-tight mt-1">{predictiveScore.roiEstimate}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Est. ROI</p>
                  </div>
                </div>
                {predictiveScore.breakdown.length > 0 && (
                  <div className="px-4 pb-3 space-y-1">
                    {predictiveScore.breakdown.map((b, i) => (
                      <p key={i} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                        <span className="text-indigo-400 mt-0.5 shrink-0">•</span>{b}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Credit Insight — shown for existing customers only (FCRA) */}
            <CreditInsightPanel
              selectedCustomers={customers.filter((c) => selectedIds.has(c.id))}
            />

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
              <Button variant="ghost" size="sm" className="h-11 sm:h-8" onClick={() => setCurrentStep(3)}>Back</Button>
              <Button size="sm" className="h-11 sm:h-8" onClick={() => { setCurrentStep(5); fetchCampaignScore(previewResult?.content); }}>
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

            {/* ── Campaign Score panel ─────────────────────────── */}
            {channel === "direct_mail" && (
              <div className={cn(
                "rounded-[var(--radius)] border-2 overflow-hidden transition-all",
                campaignScore
                  ? campaignScore.riskLevel === "high"
                    ? "border-red-200 bg-red-50/30"
                    : campaignScore.riskLevel === "medium"
                    ? "border-amber-200 bg-amber-50/30"
                    : "border-emerald-200 bg-emerald-50/30"
                  : "border-slate-200 bg-white"
              )}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BarChart2 className={cn("w-4 h-4", campaignScore
                      ? campaignScore.riskLevel === "high" ? "text-red-500"
                      : campaignScore.riskLevel === "medium" ? "text-amber-500"
                      : "text-emerald-600"
                      : "text-slate-400")} />
                    <p className="text-[13px] font-semibold text-slate-900">Campaign Score</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaignScore && (
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full",
                        campaignScore.riskLevel === "high" ? "bg-red-100 text-red-700"
                        : campaignScore.riskLevel === "medium" ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                      )}>
                        {campaignScore.riskLevel} risk
                      </span>
                    )}
                    <button
                      onClick={() => fetchCampaignScore(previewResult?.content)}
                      disabled={campaignScoreLoading}
                      className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                    >
                      {campaignScoreLoading
                        ? <><Loader2 className="w-3 h-3 animate-spin" />Scoring…</>
                        : <><RefreshCw className="w-3 h-3" />Rescore</>}
                    </button>
                  </div>
                </div>

                {campaignScoreLoading && !campaignScore && (
                  <div className="px-4 py-4 flex items-center gap-2 text-slate-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />Scoring campaign…
                  </div>
                )}

                {campaignScore && (
                  <div className="px-4 py-3 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className={cn(
                          "text-2xl font-bold tabular-nums",
                          campaignScore.overallScore >= 75 ? "text-emerald-600"
                          : campaignScore.overallScore >= 50 ? "text-amber-600"
                          : "text-red-600"
                        )}>{campaignScore.overallScore}</p>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Overall</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-indigo-600 tabular-nums">{campaignScore.estimatedResponseRate}%</p>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Est. Response</p>
                      </div>
                      <div className="text-center">
                        <p className={cn(
                          "text-2xl font-bold tabular-nums",
                          campaignScore.complianceScore >= 90 ? "text-emerald-600"
                          : campaignScore.complianceScore >= 70 ? "text-amber-600"
                          : "text-red-600"
                        )}>{campaignScore.complianceScore}</p>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Compliance</p>
                      </div>
                    </div>
                    {(campaignScore.warnings.length > 0 || campaignScore.suggestions.length > 0) && (
                      <div className="space-y-1.5">
                        {campaignScore.warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-red-700">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-500" />{w}
                          </div>
                        ))}
                        {campaignScore.suggestions.slice(0, 2).map((s, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                            <TrendingUp className="w-3 h-3 mt-0.5 shrink-0 text-indigo-400" />{s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="p-3 sm:p-4 bg-indigo-50/60 rounded-[var(--radius)] border border-indigo-100 text-center">
                <p className="text-xl sm:text-2xl font-bold text-indigo-700 tabular-nums">{selectedCount}</p>
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mt-0.5">Recipients</p>
              </div>
              <div className="p-3 sm:p-4 bg-slate-50/60 rounded-[var(--radius)] border border-slate-100 text-center">
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-0.5 flex-wrap">
                  {(() => { const Icon = channelCfg.icon; return <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />; })()}
                  <p className="text-[11px] sm:text-[13px] font-bold text-slate-900 leading-tight">{channelCfg.label}</p>
                </div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Channel</p>
              </div>
              <div className="p-3 sm:p-4 bg-emerald-50/60 rounded-[var(--radius)] border border-emerald-100 text-center">
                <p className="text-base sm:text-2xl font-bold text-emerald-700 tabular-nums">{estimateCost()}</p>
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mt-0.5">Est. Cost</p>
              </div>
            </div>

            {/* GM Impact metrics */}
            <CampaignImpactPanel
              recipientCount={selectedCount}
              channel={channel}
              estimatedCostStr={estimateCost()}
            />

            {/* Co-op eligibility panel — only for co-op campaigns */}
            {campaignType === "coop" && (
              <CoopPanel
                recipientCount={selectedCount}
                estimatedCostUsd={selectedCount * (channel === "direct_mail" ? 1.35 : channel === "sms" ? 0.02 : 0)}
              />
            )}

            {/* Dry run toggle */}
            <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-[var(--radius)] cursor-pointer hover:bg-slate-50/60 transition-colors">
              <input type="checkbox" checked={dryRun} onChange={(e) => {
                setDryRun(e.target.checked);
                setApprovalState("idle");
                setSendError(null);
              }} className="rounded mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-slate-900">
                  Dry Run Mode
                  {dryRun && <span className="chip chip-amber ml-2">Active</span>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate copy for all customers without sending. Toggle off for live campaigns.
                </p>
              </div>
            </label>

            {sendError && (
              <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-100 rounded-[var(--radius)]">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{sendError}</p>
              </div>
            )}

            {/* Dry run results */}
            {sendResults && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
                  <CheckCircle className="w-4 h-4" />
                  Dry run complete — {sendResults.filter(r => r.success).length}/{sendResults.length} processed
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Autonomous Follow-Up Sequence */}
            {sequenceSteps.length > 0 && !dryRun && (
              <div className="rounded-[var(--radius)] border border-indigo-200 bg-indigo-50/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-indigo-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-indigo-900">Autonomous Follow-Up Sequence Planned</p>
                    <p className="text-[10px] text-indigo-500 mt-0.5">The swarm will automatically fire these touches if customers don't respond.</p>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {sequenceSteps.map((step) => (
                    <div key={step.stepIndex} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full border-2 border-indigo-200 bg-white flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">{step.stepIndex}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("chip text-[10px] capitalize",
                            step.channel === "sms" ? "chip-violet" : step.channel === "email" ? "chip-emerald" : "chip-indigo"
                          )}>{step.channel}</span>
                          <span className="text-[11px] font-semibold text-slate-700">Day {step.dayOffset}</span>
                          <span className="text-[10px] text-slate-400">if {step.condition.replace(/_/g, " ")}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{step.messageHint}</p>
                        <p className="text-[10px] text-slate-400">{step.estimatedCostLabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── GM Approval flow (live sends only) ──────────── */}
            {!dryRun && (
              <div className="rounded-[var(--radius)] border-2 border-indigo-200 bg-indigo-50/40 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-100">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold text-indigo-900">GM Approval Required</p>
                    <p className="text-[10px] text-indigo-500 mt-0.5">
                      Live campaigns require GM sign-off before any messages are sent.
                    </p>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* idle: show request button */}
                  {approvalState === "idle" && (
                    <Button
                      size="sm"
                      className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                      onClick={() => setApprovalState("input_gm")}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Request GM Approval
                    </Button>
                  )}

                  {/* input_gm: enter GM email */}
                  {approvalState === "input_gm" && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        GM / Owner email address
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder="gm@yourdealership.com"
                          value={gmEmail}
                          onChange={(e) => setGmEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && requestApproval()}
                          className="flex-1 border border-slate-200 rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-10 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                          onClick={requestApproval}
                          disabled={!gmEmail.trim().includes("@")}
                        >
                          Send
                        </Button>
                        <button
                          onClick={() => { setApprovalState("idle"); setGmEmail(""); }}
                          className="p-2 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        The GM will receive an email with a secure review link. Campaign executes only after they approve.
                      </p>
                    </div>
                  )}

                  {/* submitting */}
                  {approvalState === "submitting" && (
                    <div className="flex items-center gap-2 py-2 text-indigo-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Sending approval request…</span>
                    </div>
                  )}

                  {/* sent */}
                  {approvalState === "sent" && (
                    <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[13px] font-semibold text-emerald-800">Approval request sent</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Email sent to <strong>{approvalSentTo}</strong>. The campaign will execute automatically after GM approval.
                          The link expires in 24 hours.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* error */}
                  {approvalState === "error" && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {sendError ?? "Failed to send approval request"}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setApprovalState("input_gm")}>
                        Try again
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => setCurrentStep(4)} disabled={sending}>Back</Button>
              {/* Dry run button — always available */}
              {dryRun && (
                <Button
                  size="sm"
                  className="flex-1 h-12 sm:h-9"
                  onClick={sendCampaign}
                  disabled={sending || selectedCount === 0}
                >
                  {sending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running…</>
                    : <><Eye className="mr-2 h-4 w-4" />Run Dry Run ({selectedCount})</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
