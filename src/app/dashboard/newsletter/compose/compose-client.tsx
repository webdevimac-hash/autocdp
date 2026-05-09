"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Car, Wrench, CalendarDays, Gift, Sparkles, Plus, Trash2,
  Send, Save, ChevronDown, ChevronUp, Eye, EyeOff, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Newsletter, NewsletterSection, NewsletterSectionType,
  ArrivalsSection, ServiceTipSection, EventSection, OfferSection,
} from "@/lib/newsletter/types";

// ─── Section configs ────────────────────────────────────────────────────────

const SECTION_DEFS: {
  type: NewsletterSectionType;
  label: string;
  icon: React.ElementType;
  color: string;
  defaultData: () => NewsletterSection;
}[] = [
  {
    type: "arrivals",
    label: "New Arrivals",
    icon: Car,
    color: "text-indigo-600 bg-indigo-50",
    defaultData: (): ArrivalsSection => ({
      type: "arrivals",
      title: "Fresh Inventory Just Arrived",
      body: "We have exciting new vehicles arriving this month. Come take a look!",
      vehicles: [],
    }),
  },
  {
    type: "service_tip",
    label: "Service Tip",
    icon: Wrench,
    color: "text-sky-600 bg-sky-50",
    defaultData: (): ServiceTipSection => ({
      type: "service_tip",
      title: "Keep Your Car Running Smoothly",
      tip: "Regular oil changes are one of the simplest ways to extend your vehicle's life.",
      ctaText: "Schedule Service",
      ctaUrl: "",
    }),
  },
  {
    type: "event",
    label: "Event + RSVP",
    icon: CalendarDays,
    color: "text-amber-600 bg-amber-50",
    defaultData: (): EventSection => ({
      type: "event",
      eventKey: `event_${Date.now()}`,
      title: "Customer Appreciation Day",
      date: "",
      time: "",
      location: "",
      description: "Join us for a fun afternoon of food, giveaways, and great deals.",
      rsvpDeadline: "",
    }),
  },
  {
    type: "offer",
    label: "Special Offer",
    icon: Gift,
    color: "text-purple-600 bg-purple-50",
    defaultData: (): OfferSection => ({
      type: "offer",
      title: "Exclusive Customer Offer",
      body: "As a valued customer, you're entitled to a special discount this month.",
      ctaText: "Claim This Offer",
      expiresOn: "",
    }),
  },
];

// ─── Per-section editor components ─────────────────────────────────────────

function SectionCard({
  section,
  onChange,
  onRemove,
  xtimeUrl,
}: {
  section: NewsletterSection;
  onChange: (s: NewsletterSection) => void;
  onRemove: () => void;
  xtimeUrl?: string;
}) {
  const [open, setOpen]       = useState(true);
  const [generating, setGen]  = useState(false);
  const def = SECTION_DEFS.find((d) => d.type === section.type)!;

  async function generateWithAI(hint: string) {
    if (!hint.trim()) return;
    setGen(true);
    try {
      const res = await fetch("/api/newsletter/generate-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionType: section.type, hint }),
      });
      const data = await res.json() as { text?: string };
      if (data.text) {
        if (section.type === "arrivals")    onChange({ ...section, body: data.text } as ArrivalsSection);
        if (section.type === "service_tip") onChange({ ...section, tip:  data.text } as ServiceTipSection);
        if (section.type === "event")       onChange({ ...section, description: data.text } as EventSection);
        if (section.type === "offer")       onChange({ ...section, body: data.text } as OfferSection);
      }
    } finally {
      setGen(false);
    }
  }

  const [aiHint, setAiHint] = useState("");

  const field = (
    label: string,
    value: string,
    onVal: (v: string) => void,
    opts?: { multiline?: boolean; placeholder?: string; type?: string }
  ) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      {opts?.multiline ? (
        <textarea
          value={value}
          onChange={(e) => onVal(e.target.value)}
          placeholder={opts.placeholder}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
        />
      ) : (
        <input
          type={opts?.type ?? "text"}
          value={value}
          onChange={(e) => onVal(e.target.value)}
          placeholder={opts?.placeholder}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        />
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", def.color)}>
          <def.icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[13px] font-semibold text-slate-800 flex-1">{def.label}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-slate-300 hover:text-red-400 transition-colors p-1"
          title="Remove section"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-slate-100">

          {/* Section-specific fields */}
          {section.type === "arrivals" && (() => {
            const s = section as ArrivalsSection;
            return <>
              {field("Section Title", s.title, (v) => onChange({ ...s, title: v }))}
              {field("Body Text", s.body, (v) => onChange({ ...s, body: v }), { multiline: true })}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Vehicles (one per line, optional)
                </label>
                <textarea
                  value={(s.vehicles ?? []).join("\n")}
                  onChange={(e) => onChange({ ...s, vehicles: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })}
                  placeholder="2025 Honda Accord&#10;2025 Toyota Camry"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
                />
              </div>
            </>;
          })()}

          {section.type === "service_tip" && (() => {
            const s = section as ServiceTipSection;
            return <>
              {field("Title", s.title, (v) => onChange({ ...s, title: v }))}
              {field("Tip Text", s.tip, (v) => onChange({ ...s, tip: v }), { multiline: true })}
              <div className="grid grid-cols-2 gap-3">
                {field("CTA Button Text", s.ctaText ?? "", (v) => onChange({ ...s, ctaText: v }), { placeholder: "Schedule Service" })}
                {field("CTA URL", s.ctaUrl ?? "", (v) => onChange({ ...s, ctaUrl: v }), { placeholder: xtimeUrl ?? "https://…" })}
              </div>
            </>;
          })()}

          {section.type === "event" && (() => {
            const s = section as EventSection;
            return <>
              {field("Event Name", s.title, (v) => onChange({ ...s, title: v }))}
              <div className="grid grid-cols-2 gap-3">
                {field("Date", s.date, (v) => onChange({ ...s, date: v }), { placeholder: "June 15, 2026" })}
                {field("Time", s.time, (v) => onChange({ ...s, time: v }), { placeholder: "10:00 AM – 4:00 PM" })}
              </div>
              {field("Location", s.location, (v) => onChange({ ...s, location: v }), { placeholder: "123 Main St, Showroom" })}
              {field("Description", s.description, (v) => onChange({ ...s, description: v }), { multiline: true })}
              {field("RSVP Deadline (optional)", s.rsvpDeadline ?? "", (v) => onChange({ ...s, rsvpDeadline: v }), { placeholder: "June 12" })}
            </>;
          })()}

          {section.type === "offer" && (() => {
            const s = section as OfferSection;
            return <>
              {field("Offer Title", s.title, (v) => onChange({ ...s, title: v }))}
              {field("Offer Details", s.body, (v) => onChange({ ...s, body: v }), { multiline: true })}
              <div className="grid grid-cols-2 gap-3">
                {field("CTA Button Text", s.ctaText, (v) => onChange({ ...s, ctaText: v }), { placeholder: "Claim This Offer" })}
                {field("Expires On (optional)", s.expiresOn ?? "", (v) => onChange({ ...s, expiresOn: v }), { placeholder: "June 30" })}
              </div>
            </>;
          })()}

          {/* AI Generate */}
          <div className="pt-1 flex gap-2">
            <input
              value={aiHint}
              onChange={(e) => setAiHint(e.target.value)}
              placeholder={`e.g. "${
                section.type === "arrivals"    ? "lots of new SUVs and crossovers arriving this week" :
                section.type === "service_tip" ? "summer road trip prep checklist" :
                section.type === "event"       ? "cookout and car show, family friendly" :
                "10% off all service appointments"
              }"`}
              className="flex-1 px-3 py-2 rounded-lg border border-violet-200 bg-violet-50/30 text-[12px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
              onKeyDown={(e) => e.key === "Enter" && generateWithAI(aiHint)}
            />
            <button
              onClick={() => generateWithAI(aiHint)}
              disabled={generating || !aiHint.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Generate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Composer ──────────────────────────────────────────────────────────

interface Props {
  dealerName: string;
  xtimeUrl?: string;
  recipientCount: number;
  draft: Newsletter | null;
}

export function NewsletterComposer({ dealerName, xtimeUrl, recipientCount, draft }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(draft?.subject ?? `${new Date().toLocaleString("default", { month: "long" })} News from ${dealerName}`);
  const [previewText, setPreviewText] = useState(draft?.preview_text ?? "");
  const [sections, setSections] = useState<NewsletterSection[]>(draft?.sections ?? []);
  const [saving, setSaving]   = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus]   = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [draftId, setDraftId] = useState(draft?.id ?? null);

  const addSection = useCallback((type: NewsletterSectionType) => {
    const def = SECTION_DEFS.find((d) => d.type === type)!;
    setSections((prev) => [...prev, def.defaultData()]);
  }, []);

  const updateSection = useCallback((i: number, s: NewsletterSection) => {
    setSections((prev) => prev.map((x, idx) => idx === i ? s : x));
  }, []);

  const removeSection = useCallback((i: number) => {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  async function saveDraft() {
    setSaving(true);
    setStatus(null);
    try {
      if (draftId) {
        await fetch(`/api/newsletter/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, preview_text: previewText, sections }),
        });
      } else {
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, preview_text: previewText, sections }),
        });
        const data = await res.json() as { newsletter?: { id: string } };
        if (data.newsletter?.id) setDraftId(data.newsletter.id);
      }
      setStatus({ type: "success", msg: "Draft saved." });
    } catch {
      setStatus({ type: "error", msg: "Failed to save draft." });
    } finally {
      setSaving(false);
    }
  }

  async function sendNewsletter() {
    if (!subject.trim()) { setStatus({ type: "error", msg: "Please add a subject line." }); return; }
    if (sections.length === 0) { setStatus({ type: "error", msg: "Add at least one section before sending." }); return; }
    if (!draftId) {
      await saveDraft();
      if (!draftId) { setStatus({ type: "error", msg: "Save failed. Please try again." }); return; }
    }

    const confirmed = window.confirm(`Send this newsletter to ${recipientCount.toLocaleString()} customers now?`);
    if (!confirmed) return;

    setSending(true);
    setStatus(null);
    try {
      // Make sure the latest content is saved first
      await fetch(`/api/newsletter/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, preview_text: previewText, sections }),
      });

      const res = await fetch(`/api/newsletter/${draftId}/send`, { method: "POST" });
      const data = await res.json() as { sent?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setStatus({ type: "success", msg: `Sent to ${(data.sent ?? 0).toLocaleString()} customers. ` });
      setTimeout(() => router.push("/dashboard/newsletter"), 1800);
    } catch (err) {
      setStatus({ type: "error", msg: err instanceof Error ? err.message : "Send failed." });
    } finally {
      setSending(false);
    }
  }

  const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <main className="flex-1 p-4 sm:p-6 max-w-[1000px]">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* Left — Editor */}
        <div className="space-y-4">

          {/* Subject + preview */}
          <div className="inst-panel p-4 sm:p-5 space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject Line</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                placeholder="Your subject line…"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Preview Text (optional)</label>
              <input
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                placeholder="Short teaser shown in the inbox below the subject…"
              />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-3">
            {sections.map((s, i) => (
              <SectionCard
                key={i}
                section={s}
                onChange={(updated) => updateSection(i, updated)}
                onRemove={() => removeSection(i)}
                xtimeUrl={xtimeUrl}
              />
            ))}
          </div>

          {/* Add section buttons */}
          <div className="inst-panel p-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Section</p>
            <div className="flex flex-wrap gap-2">
              {SECTION_DEFS.map((def) => (
                <button
                  key={def.type}
                  onClick={() => addSection(def.type)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-semibold transition-colors",
                    "border-slate-200 text-slate-600 hover:bg-slate-50",
                    sections.some((s) => s.type === def.type) && "opacity-50"
                  )}
                >
                  <def.icon className="w-3.5 h-3.5" />
                  {def.label}
                  <Plus className="w-3 h-3" />
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          {status && (
            <div className={cn(
              "rounded-lg px-4 py-3 text-[13px] font-medium",
              status.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
            )}>
              {status.msg}
            </div>
          )}
        </div>

        {/* Right — Actions + preview */}
        <div className="space-y-4">

          {/* Send card */}
          <div className="inst-panel p-5 space-y-3">
            <p className="text-[13px] font-bold text-slate-900">{month} Newsletter</p>
            <p className="text-[12px] text-slate-500 leading-relaxed">
              Will be sent to <strong className="text-slate-800">{recipientCount.toLocaleString()} customers</strong> with email addresses.
            </p>
            <div className="space-y-2 pt-1">
              <button
                onClick={sendNewsletter}
                disabled={sending || saving}
                className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sending ? "Sending…" : "Send Newsletter"}
              </button>
              <button
                onClick={saveDraft}
                disabled={saving || sending}
                className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? "Saving…" : "Save Draft"}
              </button>
            </div>
          </div>

          {/* Preview toggle */}
          <div className="inst-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-semibold text-slate-700">Email Preview</p>
              <button
                onClick={() => setPreviewMode((p) => !p)}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                {previewMode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {previewMode ? "Hide" : "Show"}
              </button>
            </div>
            {previewMode ? (
              <div className="rounded-lg border border-slate-200 overflow-hidden bg-[#F8FAFC] p-2">
                <div className="bg-[#1E3A5F] rounded-lg p-4 text-center mb-2">
                  <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider mb-0.5">{month}</p>
                  <p className="text-[15px] font-extrabold text-white">{dealerName}</p>
                </div>
                <p className="text-[11px] text-slate-600 px-1 mb-2">Hi Customer, here&rsquo;s your monthly update…</p>
                {sections.map((s, i) => {
                  const def = SECTION_DEFS.find((d) => d.type === s.type)!;
                  const sectionTitle = s.type === "arrivals" ? (s as ArrivalsSection).title :
                                       s.type === "service_tip" ? (s as ServiceTipSection).title :
                                       s.type === "event" ? (s as EventSection).title :
                                       (s as OfferSection).title;
                  return (
                    <div key={i} className="rounded-lg bg-white border border-slate-100 px-3 py-2.5 mb-1.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={cn("w-4 h-4 rounded flex items-center justify-center", def.color)}>
                          <def.icon className="w-2.5 h-2.5" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-700">{sectionTitle || def.label}</p>
                      </div>
                      {s.type === "event" && (
                        <div className="flex gap-1.5 mt-1">
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded">✓ Count me in!</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded">Can&rsquo;t make it</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {sections.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-4">Add sections to see preview</p>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-slate-400">Toggle to see a layout preview of your newsletter.</p>
            )}
          </div>

          {/* Tips */}
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 space-y-2">
            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Newsletter Tips</p>
            {[
              "Keep it to 2–3 sections max",
              "Friendly tone — not a sales pitch",
              "Events with RSVPs get the most replies",
              "Service tips build trust over time",
            ].map((tip) => (
              <p key={tip} className="text-[12px] text-amber-700 flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>{tip}
              </p>
            ))}
          </div>

        </div>
      </div>
    </main>
  );
}
