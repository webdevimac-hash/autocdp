"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Trash2, Plus, Loader2, BookOpen, ChevronDown, ChevronUp,
  Upload, FileText, Image as ImageIcon, Eye, EyeOff, Sparkles,
  CheckCircle, AlertCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Keyframe styles ────────────────────────────────────────────

const KEYFRAMES = `
@keyframes tdScaleIn {
  from { opacity: 0; transform: scale(0.6); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes tdPulseRing {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes tdSlideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

// ── Constants ──────────────────────────────────────────────────

const MAIL_TYPES = [
  { value: "", label: "— select type —" },
  { value: "service_reminder", label: "Service Reminder" },
  { value: "oil_change",       label: "Oil Change" },
  { value: "conquest",         label: "Conquest / Prospect" },
  { value: "lease_pull",       label: "Lease Pull-Ahead" },
  { value: "reactivation",     label: "Reactivation" },
  { value: "holiday",          label: "Holiday / Seasonal" },
  { value: "vip",              label: "VIP Appreciation" },
  { value: "recall",           label: "Recall / Safety" },
  { value: "other",            label: "Other" },
];

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

// ── Palette tokens ─────────────────────────────────────────────
const C = {
  navy:         "#0f172a",
  navyMid:      "#1e3a5f",
  navyLight:    "#334155",
  emerald:      "#10b981",
  emeraldDark:  "#059669",
  emeraldGlow:  "rgba(16,185,129,0.12)",
  emeraldRing:  "rgba(16,185,129,0.18)",
  amber:        "#f59e0b",
  amberLight:   "#fef3c7",
} as const;

// ── Types ──────────────────────────────────────────────────────

type Example = {
  id: string;
  example_text: string;
  mail_type: string | null;
  date_sent: string | null;
  notes: string | null;
  source_type: "text" | "image" | "pdf";
  file_url: string | null;
  visual_description: string | null;
  created_at: string;
};

// ── Source badge ───────────────────────────────────────────────

function SourceBadge({ type }: { type: "text" | "image" | "pdf" }) {
  if (type === "image") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
        📸 Image
      </span>
    );
  }
  if (type === "pdf") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
        📄 PDF
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
      ✍️ Text
    </span>
  );
}

// ── ExampleCard ────────────────────────────────────────────────

function ExampleCard({ ex, onDelete }: { ex: Example; onDelete: (id: string) => void }) {
  const [expandedCopy, setExpandedCopy] = useState(false);
  const [showVisual, setShowVisual]     = useState(false);
  const isVisual   = ex.source_type !== "text";
  const preview    = ex.example_text.slice(0, 140);
  const isLongCopy = ex.example_text.length > 140;

  return (
    <div
      className="rounded-xl overflow-hidden bg-white transition-all duration-200 hover:shadow-md"
      style={{
        border: isVisual ? `1px solid rgba(16,185,129,0.25)` : "1px solid #e2e8f0",
        boxShadow: isVisual ? "0 1px 4px rgba(16,185,129,0.06)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Thumbnail + meta strip for visual uploads ── */}
      {isVisual && ex.file_url && (
        <div
          className="flex items-stretch"
          style={{ borderBottom: "1px solid rgba(16,185,129,0.15)", background: "linear-gradient(to right, #f0fdf4, #f8fafc)" }}
        >
          {/* Thumbnail */}
          <a
            href={ex.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative shrink-0 overflow-hidden group"
            style={{ width: "128px", height: "96px" }}
          >
            {ex.source_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ex.file_url}
                alt="Mail piece thumbnail"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  (e.currentTarget.parentElement as HTMLElement).style.background = "#f1f5f9";
                }}
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center gap-1.5"
                style={{ background: "#f1f5f9" }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#dbeafe", border: "1px solid #bfdbfe" }}
                >
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <span
                  className="text-[9px] font-black uppercase tracking-widest"
                  style={{ color: "#3b82f6" }}
                >
                  PDF
                </span>
              </div>
            )}
            {/* Overlay hover hint */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>

          {/* Meta + AI badge */}
          <div className="flex-1 px-3.5 py-2.5 min-w-0 flex flex-col justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <SourceBadge type={ex.source_type} />
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                style={{ background: C.amberLight, color: "#92400e" }}
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                AI analyzed
              </span>
            </div>

            {ex.visual_description ? (
              <button
                onClick={() => setShowVisual(!showVisual)}
                className="mt-1.5 self-start flex items-center gap-1 text-[11px] font-semibold transition-colors"
                style={{ color: showVisual ? C.emeraldDark : C.emerald }}
              >
                {showVisual
                  ? <><EyeOff className="w-3.5 h-3.5" /> Hide layout analysis</>
                  : <><Eye className="w-3.5 h-3.5" /> View AI layout analysis</>}
              </button>
            ) : (
              <p className="text-[10px] text-slate-400 italic mt-1.5">Vision analysis pending</p>
            )}
          </div>
        </div>
      )}

      {/* ── Collapsible visual analysis panel ── */}
      {showVisual && ex.visual_description && (
        <div
          className="px-4 py-3"
          style={{
            background: "linear-gradient(135deg, #fffbeb 0%, #fefce8 100%)",
            borderBottom: "1px solid #fde68a",
            animation: "tdSlideDown 0.2s ease",
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
              AI Visual Layout Analysis
            </p>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "#78350f" }}>
            {ex.visual_description}
          </p>
        </div>
      )}

      {/* ── Main content row ── */}
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Tags row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {!isVisual && <SourceBadge type="text" />}
            {ex.mail_type && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                style={{ background: "rgba(15,23,42,0.04)", borderColor: "rgba(15,23,42,0.12)", color: C.navyLight }}
              >
                {MAIL_TYPES.find((t) => t.value === ex.mail_type)?.label ?? ex.mail_type}
              </span>
            )}
            {ex.date_sent && (
              <span className="text-[10px] text-slate-400 font-medium">{ex.date_sent}</span>
            )}
          </div>

          {/* Copy text */}
          {ex.example_text ? (
            <>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {expandedCopy || !isLongCopy ? ex.example_text : `${preview}…`}
              </p>
              {isLongCopy && (
                <button
                  onClick={() => setExpandedCopy(!expandedCopy)}
                  className="mt-1.5 flex items-center gap-0.5 text-[11px] font-semibold transition-colors hover:opacity-80"
                  style={{ color: C.emerald }}
                >
                  {expandedCopy
                    ? <><ChevronUp className="w-3 h-3" /> Show less</>
                    : <><ChevronDown className="w-3 h-3" /> Show more</>}
                </button>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Copy not extracted — the AI will use the visual layout description above.
            </p>
          )}

          {ex.notes && (
            <p className="text-xs text-slate-400 mt-2 italic border-l-2 border-slate-200 pl-2">{ex.notes}</p>
          )}
        </div>

        <button
          onClick={() => onDelete(ex.id)}
          className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Delete example"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── SVG progress ring ──────────────────────────────────────────

function ProgressRing({ progress }: { progress: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress / 100);
  return (
    <div className="relative w-14 h-14">
      <svg className="w-14 h-14" style={{ transform: "rotate(-90deg)" }} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke={C.emerald} strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black" style={{ color: C.navyMid }}>{progress}%</span>
      </div>
    </div>
  );
}

// ── File drop zone ─────────────────────────────────────────────

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string; progress: number }
  | { status: "analyzing"; fileName: string }
  | { status: "done"; fileName: string }
  | { status: "error"; message: string };

function FileDropZone({
  mailType, dateSent, notes, onSuccess,
}: {
  mailType: string;
  dateSent: string;
  notes: string;
  onSuccess: (ex: Example) => void;
}) {
  const { toast } = useToast();
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [isDragOver, setIsDragOver]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadState({ status: "error", message: `Unsupported format: ${file.type}. Use JPEG, PNG, WebP, or PDF.` });
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadState({ status: "error", message: "File exceeds the 10 MB limit." });
      return;
    }

    setUploadState({ status: "uploading", fileName: file.name, progress: 20 });

    // Simulate progress ticks during upload
    const tickTimer = setInterval(() => {
      setUploadState((prev) =>
        prev.status === "uploading" && prev.progress < 70
          ? { ...prev, progress: prev.progress + 10 }
          : prev
      );
    }, 400);

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (mailType) fd.append("mail_type", mailType);
      if (dateSent) fd.append("date_sent", dateSent);
      if (notes)    fd.append("notes", notes);

      const res = await fetch("/api/dealership/baseline-examples/upload", {
        method: "POST",
        body: fd,
      });

      clearInterval(tickTimer);
      setUploadState({ status: "uploading", fileName: file.name, progress: 90 });

      // Brief pause so the ring visibly completes to 90 before transitioning
      await new Promise((r) => setTimeout(r, 300));
      setUploadState({ status: "analyzing", fileName: file.name });

      const data = await res.json() as {
        example?: Example;
        error?: string;
        visualAnalyzed?: boolean;
        textExtracted?: boolean;
      };

      if (!res.ok || !data.example) throw new Error(data.error ?? "Upload failed");

      setUploadState({ status: "done", fileName: file.name });
      onSuccess(data.example);

      toast({
        title: "Mail piece analyzed and saved ✓",
        description: data.visualAnalyzed
          ? "Visual layout + copy text extracted. The Creative Agent will use this design."
          : "Saved — copy text extracted. Visual analysis was unavailable.",
      });

      setTimeout(() => setUploadState({ status: "idle" }), 3000);
    } catch (err) {
      clearInterval(tickTimer);
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadState({ status: "error", message: msg });
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    }
  }, [mailType, dateSent, notes, onSuccess, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  }, [processFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }, [processFile]);

  const isProcessing = uploadState.status === "uploading" || uploadState.status === "analyzing";

  // Dynamic zone styles
  const zoneStyle: React.CSSProperties = (() => {
    if (isDragOver) return {
      borderColor: C.emerald,
      background:  "rgba(16,185,129,0.06)",
      boxShadow:   `0 0 0 4px ${C.emeraldRing}`,
    };
    if (isProcessing) return {
      borderColor: "rgba(15,23,42,0.15)",
      background:  "#f8fafc",
      cursor:      "not-allowed",
    };
    if (uploadState.status === "done") return {
      borderColor: C.emerald,
      background:  "rgba(16,185,129,0.04)",
      boxShadow:   `0 0 0 4px ${C.emeraldRing}`,
    };
    if (uploadState.status === "error") return {
      borderColor: "#fca5a5",
      background:  "#fff1f2",
    };
    return {
      borderColor: "rgba(15,23,42,0.2)",
      background:  "#fafbfc",
    };
  })();

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !isProcessing && inputRef.current?.click()}
      className="relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-all duration-200"
      style={{ minHeight: "168px", padding: "28px 24px", ...zoneStyle }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        className="hidden"
        onChange={handleInputChange}
        disabled={isProcessing}
      />

      {/* ── Idle ── */}
      {uploadState.status === "idle" && (
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex gap-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200"
              style={{
                background:  isDragOver ? C.emeraldGlow : "rgba(15,23,42,0.06)",
                border:      isDragOver ? `1px solid ${C.emerald}` : "1px solid rgba(15,23,42,0.1)",
                transform:   isDragOver ? "scale(1.1)" : "scale(1)",
              }}
            >
              <ImageIcon className="w-5 h-5" style={{ color: isDragOver ? C.emerald : "#94a3b8" }} />
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200"
              style={{
                background:  isDragOver ? C.emeraldGlow : "rgba(15,23,42,0.06)",
                border:      isDragOver ? `1px solid ${C.emerald}` : "1px solid rgba(15,23,42,0.1)",
                transform:   isDragOver ? "scale(1.1)" : "scale(1)",
              }}
            >
              <FileText className="w-5 h-5" style={{ color: isDragOver ? C.emerald : "#94a3b8" }} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: C.navy }}>
              {isDragOver ? "Drop to upload & analyze" : "Drag & drop a mailer, or click to browse"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              JPEG · PNG · WebP · PDF &nbsp;·&nbsp; max 10 MB
            </p>
          </div>
        </div>
      )}

      {/* ── Uploading ── */}
      {uploadState.status === "uploading" && (
        <div className="flex flex-col items-center gap-3">
          <ProgressRing progress={uploadState.progress} />
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: C.navyMid }}>Uploading…</p>
            <p className="text-xs text-slate-400 truncate max-w-[200px]">{uploadState.fileName}</p>
          </div>
        </div>
      )}

      {/* ── Analyzing ── */}
      {uploadState.status === "analyzing" && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: C.amberLight, border: "2px solid #fde68a" }}
            >
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
            </div>
            <div
              className="absolute -inset-1.5 rounded-full border-2 border-amber-300"
              style={{ animation: "tdPulseRing 1.4s ease-out infinite" }}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-amber-700">Analyzing with Claude Vision…</p>
            <p className="text-xs text-amber-500/80">Extracting copy, layout style &amp; design signals</p>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {uploadState.status === "done" && (
        <div
          className="flex flex-col items-center gap-2"
          style={{ animation: "tdScaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        >
          <div
            className="w-13 h-13 rounded-full flex items-center justify-center"
            style={{
              width: "52px", height: "52px",
              background: C.emerald,
              boxShadow: `0 0 0 8px ${C.emeraldRing}, 0 4px 16px rgba(16,185,129,0.35)`,
            }}
          >
            <CheckCircle className="w-7 h-7 text-white" />
          </div>
          <p className="text-sm font-bold" style={{ color: C.emeraldDark }}>Analyzed &amp; saved!</p>
          <p className="text-xs text-slate-400">{uploadState.fileName}</p>
        </div>
      )}

      {/* ── Error ── */}
      {uploadState.status === "error" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "#fee2e2", border: "2px solid #fca5a5" }}
          >
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-sm font-semibold text-red-600 max-w-[220px]">{uploadState.message}</p>
          <button
            onClick={(e) => { e.stopPropagation(); setUploadState({ status: "idle" }); }}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors mt-0.5"
          >
            <X className="w-3 h-3" /> Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export function TrainingDataSection() {
  const { toast } = useToast();
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Shared metadata fields
  const [mailType, setMailType] = useState("");
  const [dateSent, setDateSent] = useState("");
  const [notes, setNotes]       = useState("");

  // Tab state
  const [activeTab, setActiveTab] = useState<"text" | "upload">("text");

  // Text-paste form
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dealership/baseline-examples");
      if (res.ok) {
        const d = await res.json() as { examples: Example[] };
        setExamples(d.examples);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAddText = async () => {
    if (!text.trim()) {
      toast({ title: "Example text is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dealership/baseline-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          example_text: text.trim(),
          mail_type: mailType || null,
          date_sent: dateSent || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Example saved ✓", description: "The Creative Agent will use it on the next campaign." });
      setText(""); setMailType(""); setDateSent(""); setNotes("");
      setShowForm(false);
      await load();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadSuccess = useCallback((ex: Example) => {
    setExamples((prev) => [ex, ...prev]);
    setMailType(""); setDateSent(""); setNotes("");
    setShowForm(false);
  }, []);

  const handleDelete = async (id: string) => {
    const prev = examples;
    setExamples((e) => e.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/dealership/baseline-examples?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Example removed" });
    } catch {
      setExamples(prev);
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const visualCount = examples.filter((ex) => ex.visual_description).length;

  // Input shared class
  const inputCls = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60 transition-shadow";

  return (
    <>
      {/* Inject keyframes once */}
      <style>{KEYFRAMES}</style>

      <div className="space-y-5">

        {/* ── Explainer ── */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{
            background:  "linear-gradient(135deg, #f0f9ff 0%, #ecfdf5 100%)",
            border:      `1px solid rgba(16,185,129,0.2)`,
            boxShadow:   "0 1px 4px rgba(16,185,129,0.07)",
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: C.navy }}
          >
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div className="text-xs leading-relaxed space-y-1.5" style={{ color: C.navyMid }}>
            <p className="font-bold text-sm" style={{ color: C.navy }}>How AI Training works</p>
            <p>
              Upload photos or PDFs of past mailers — <strong>Claude Vision</strong> reads the design:
              headline treatment, offer placement, coupon style, color palette, urgency elements, and
              layout hierarchy. The Creative Agent uses both the copy text and visual design description
              in every new campaign.
            </p>
            <p>
              Or paste copy text directly if you don&apos;t have scans — either way, the AI learns your
              dealership&apos;s proven direct mail voice and visual style.
            </p>
            {visualCount > 0 && (
              <p className="font-bold flex items-center gap-1.5" style={{ color: C.emeraldDark }}>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {visualCount} scanned design{visualCount > 1 ? "s" : ""} active — vision learning enabled
              </p>
            )}
          </div>
        </div>

        {/* ── Count / toggle ── */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {loading
              ? "Loading…"
              : `${examples.length} example${examples.length !== 1 ? "s" : ""} stored`}
            {examples.length > 0 && !loading && (
              <span className="ml-1.5 font-semibold" style={{ color: C.emerald }}>· baseline active</span>
            )}
          </p>
          <Button
            size="sm"
            variant={showForm ? "ghost" : "outline"}
            className="h-8 text-xs gap-1.5 rounded-lg"
            style={showForm ? {} : { borderColor: "rgba(15,23,42,0.2)", color: C.navy }}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Cancel" : <><Plus className="w-3.5 h-3.5" /> Add Example</>}
          </Button>
        </div>

        {/* ── Add form ── */}
        {showForm && (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border:     `1px solid rgba(15,23,42,0.12)`,
              boxShadow:  "0 4px 20px rgba(15,23,42,0.06)",
              animation:  "tdSlideDown 0.2s ease",
            }}
          >
            {/* ── Pill tab switcher ── */}
            <div className="flex p-2 gap-1" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <button
                onClick={() => setActiveTab("text")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200"
                )}
                style={
                  activeTab === "text"
                    ? { background: C.navy, color: "#fff", boxShadow: "0 1px 4px rgba(15,23,42,0.2)" }
                    : { color: "#64748b" }
                }
              >
                <FileText className="w-3.5 h-3.5" />
                Paste Text
              </button>
              <button
                onClick={() => setActiveTab("upload")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200"
                )}
                style={
                  activeTab === "upload"
                    ? { background: C.navy, color: "#fff", boxShadow: "0 1px 4px rgba(15,23,42,0.2)" }
                    : { color: "#64748b" }
                }
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Image / PDF
                {activeTab !== "upload" && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-black"
                    style={{ background: C.amberLight, color: "#92400e" }}
                  >
                    VISION
                  </span>
                )}
              </button>
            </div>

            <div className="p-5 space-y-4 bg-white">

              {/* ── TEXT TAB ── */}
              {activeTab === "text" && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>
                    Mail copy <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste the full text of a past direct mail piece here — headline, body, offer, CTA, fine print…"
                    rows={6}
                    className={cn(inputCls, "resize-y")}
                  />
                </div>
              )}

              {/* ── UPLOAD TAB ── */}
              {activeTab === "upload" && (
                <div className="space-y-3">
                  <div
                    className="flex items-start gap-2 p-3 rounded-lg text-xs"
                    style={{ background: C.amberLight, border: "1px solid #fde68a", color: "#92400e" }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      Claude Vision will extract: headline style, offer placement, color palette,
                      urgency treatments, layout hierarchy, and full copy text — automatically.
                    </span>
                  </div>
                  <FileDropZone
                    mailType={mailType}
                    dateSent={dateSent}
                    notes={notes}
                    onSuccess={handleUploadSuccess}
                  />
                </div>
              )}

              {/* ── Shared metadata ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>Mail type</label>
                  <select
                    value={mailType}
                    onChange={(e) => setMailType(e.target.value)}
                    className={inputCls}
                  >
                    {MAIL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>Date sent (approx.)</label>
                  <input
                    type="date"
                    value={dateSent}
                    onChange={(e) => setDateSent(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Highest response rate — 4.2% return"
                  className={inputCls}
                />
              </div>

              {/* Save — text tab only */}
              {activeTab === "text" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-9 text-xs gap-1.5 rounded-lg px-4"
                    style={{ background: C.navy, color: "#fff" }}
                    onClick={handleAddText}
                    disabled={saving || !text.trim()}
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Example
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Example list ── */}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-6">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading examples…
          </div>
        ) : examples.length === 0 ? (
          <div
            className="text-center py-10 rounded-xl space-y-1.5"
            style={{ border: "2px dashed #e2e8f0" }}
          >
            <div className="text-2xl">📬</div>
            <p className="text-sm font-semibold" style={{ color: C.navyLight }}>No baseline examples yet</p>
            <p className="text-xs text-slate-400">Add your first one above — paste text or upload a mailer scan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {examples.map((ex) => (
              <ExampleCard key={ex.id} ex={ex} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* ── Pro tips ── */}
        <div
          className="p-4 rounded-xl text-xs space-y-2"
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
        >
          <p className="font-bold text-sm" style={{ color: C.navy }}>Getting the most out of AI training</p>
          <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-slate-600">
            <li>
              <strong>Upload scans first</strong> — photo or PDF export of each past mailer.
              Claude Vision extracts copy and the full visual design system automatically.
            </li>
            <li>
              <strong>Or paste copy text</strong> — if you don&apos;t have scans.
              Select the mail type and note the response rate.
            </li>
            <li>
              Aim for <strong>5–10 examples</strong> across different mail types for the best style coverage.
            </li>
            <li>
              The AI uses examples at <strong>every campaign</strong> — no further action needed after saving.
            </li>
          </ol>
          <div className="flex items-start gap-2 pt-1.5 border-t border-slate-200 mt-2.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-slate-400 italic leading-relaxed">
              Pro tip: Upload your highest-performing pieces and note the response rate. The Creative Agent
              learns the visual design patterns — template style, offer badge shape, urgency treatment —
              that drove real results for your customers, not just copy tone.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
