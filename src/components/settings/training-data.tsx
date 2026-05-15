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

// ── Constants ──────────────────────────────────────────────────

const MAIL_TYPES = [
  { value: "", label: "— select type —" },
  { value: "service_reminder", label: "Service Reminder" },
  { value: "oil_change", label: "Oil Change" },
  { value: "conquest", label: "Conquest / Prospect" },
  { value: "lease_pull", label: "Lease Pull-Ahead" },
  { value: "reactivation", label: "Reactivation" },
  { value: "holiday", label: "Holiday / Seasonal" },
  { value: "vip", label: "VIP Appreciation" },
  { value: "recall", label: "Recall / Safety" },
  { value: "other", label: "Other" },
];

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

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

// ── ExampleCard ────────────────────────────────────────────────

function ExampleCard({ ex, onDelete }: { ex: Example; onDelete: (id: string) => void }) {
  const [expandedCopy, setExpandedCopy]   = useState(false);
  const [showVisual, setShowVisual]       = useState(false);
  const isVisual = ex.source_type !== "text";
  const preview   = ex.example_text.slice(0, 120);
  const isLongCopy = ex.example_text.length > 120;

  return (
    <div className={cn(
      "border rounded-lg bg-white hover:border-slate-300 transition-colors overflow-hidden",
      isVisual ? "border-indigo-200" : "border-slate-200"
    )}>
      {/* Thumbnail row for image uploads */}
      {isVisual && ex.file_url && (
        <div className="flex items-stretch border-b border-indigo-100 bg-indigo-50/40">
          <a
            href={ex.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative w-28 h-20 shrink-0 overflow-hidden bg-slate-100 hover:opacity-90 transition-opacity"
          >
            {ex.source_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ex.file_url}
                alt="Mail piece thumbnail"
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400">
                <FileText className="w-6 h-6" />
                <span className="text-[9px] font-semibold uppercase tracking-wider">PDF</span>
              </div>
            )}
          </a>
          <div className="flex-1 px-3 py-2 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                {ex.source_type === "pdf" ? "PDF scan" : "Image scan"}
              </span>
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-[9px] text-slate-400 font-medium">AI analyzed</span>
            </div>
            {ex.visual_description && (
              <button
                onClick={() => setShowVisual(!showVisual)}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 font-medium"
              >
                {showVisual ? <><EyeOff className="w-3 h-3" /> Hide layout analysis</> : <><Eye className="w-3 h-3" /> View layout analysis</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Visual description panel */}
      {showVisual && ex.visual_description && (
        <div className="px-3.5 py-2.5 bg-amber-50/60 border-b border-amber-100">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">
            AI Visual Layout Analysis
          </p>
          <p className="text-[11px] text-amber-900 leading-relaxed">{ex.visual_description}</p>
        </div>
      )}

      {/* Main content */}
      <div className="p-3.5 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {ex.mail_type && (
              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {MAIL_TYPES.find((t) => t.value === ex.mail_type)?.label ?? ex.mail_type}
              </span>
            )}
            {!isVisual && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wider">
                Text
              </span>
            )}
            {ex.date_sent && (
              <span className="text-[10px] text-slate-400">{ex.date_sent}</span>
            )}
          </div>

          {ex.example_text ? (
            <>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {expandedCopy || !isLongCopy ? ex.example_text : `${preview}…`}
              </p>
              {isLongCopy && (
                <button
                  onClick={() => setExpandedCopy(!expandedCopy)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 mt-1 flex items-center gap-0.5"
                >
                  {expandedCopy
                    ? <><ChevronUp className="w-3 h-3" /> Show less</>
                    : <><ChevronDown className="w-3 h-3" /> Show more</>}
                </button>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Copy text not extracted — the AI will use the visual layout description above.
            </p>
          )}

          {ex.notes && (
            <p className="text-xs text-slate-400 mt-1.5 italic">{ex.notes}</p>
          )}
        </div>

        <button
          onClick={() => onDelete(ex.id)}
          className="shrink-0 text-slate-300 hover:text-red-500 transition-colors p-1 rounded"
          title="Delete example"
        >
          <Trash2 className="w-4 h-4" />
        </button>
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
  mailType, dateSent, notes,
  onSuccess,
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
      setUploadState({ status: "error", message: `Unsupported type: ${file.type}. Use JPEG, PNG, WebP, or PDF.` });
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadState({ status: "error", message: "File exceeds the 10 MB limit." });
      return;
    }

    setUploadState({ status: "uploading", fileName: file.name, progress: 30 });

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (mailType) fd.append("mail_type", mailType);
      if (dateSent) fd.append("date_sent", dateSent);
      if (notes)    fd.append("notes", notes);

      setUploadState({ status: "uploading", fileName: file.name, progress: 60 });

      const res = await fetch("/api/dealership/baseline-examples/upload", {
        method: "POST",
        body: fd,
      });

      setUploadState({ status: "analyzing", fileName: file.name });

      const data = await res.json() as {
        example?: Example;
        error?: string;
        visualAnalyzed?: boolean;
        textExtracted?: boolean;
      };

      if (!res.ok || !data.example) {
        throw new Error(data.error ?? "Upload failed");
      }

      setUploadState({ status: "done", fileName: file.name });
      onSuccess(data.example);

      toast({
        title: "Mail piece analyzed and saved",
        description: data.visualAnalyzed
          ? "Visual layout + copy text extracted. The Creative Agent will reference this design."
          : "Saved (vision analysis unavailable — text extracted only).",
      });

      // Reset after a beat
      setTimeout(() => setUploadState({ status: "idle" }), 2500);
    } catch (err) {
      setUploadState({ status: "error", message: err instanceof Error ? err.message : "Upload failed" });
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
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  }, [processFile]);

  const isProcessing = uploadState.status === "uploading" || uploadState.status === "analyzing";

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && inputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer",
          isDragOver
            ? "border-indigo-400 bg-indigo-50"
            : isProcessing
            ? "border-indigo-200 bg-indigo-50/40 cursor-not-allowed"
            : uploadState.status === "done"
            ? "border-emerald-400 bg-emerald-50/40"
            : uploadState.status === "error"
            ? "border-red-300 bg-red-50/30"
            : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 bg-slate-50/50"
        )}
        style={{ minHeight: "120px" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={handleInputChange}
          disabled={isProcessing}
        />

        {/* Idle state */}
        {uploadState.status === "idle" && (
          <>
            <div className="flex gap-3">
              <ImageIcon className="w-6 h-6 text-slate-300" />
              <FileText className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600 text-center">
              {isDragOver ? "Drop to upload" : "Drag & drop or click to upload"}
            </p>
            <p className="text-xs text-slate-400 text-center">
              JPEG · PNG · WebP · PDF — max 10 MB
            </p>
          </>
        )}

        {/* Uploading */}
        {uploadState.status === "uploading" && (
          <>
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <p className="text-sm font-semibold text-indigo-700">
              Uploading {uploadState.fileName}…
            </p>
            <div className="w-full max-w-[160px] h-1.5 rounded-full bg-indigo-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </>
        )}

        {/* Analyzing */}
        {uploadState.status === "analyzing" && (
          <>
            <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
            <p className="text-sm font-semibold text-amber-700">
              Claude Vision is analyzing the design…
            </p>
            <p className="text-xs text-amber-500 text-center">
              Extracting copy text, layout style, and visual design signals
            </p>
          </>
        )}

        {/* Done */}
        {uploadState.status === "done" && (
          <>
            <CheckCircle className="w-6 h-6 text-emerald-500" />
            <p className="text-sm font-semibold text-emerald-700">Saved successfully</p>
          </>
        )}

        {/* Error */}
        {uploadState.status === "error" && (
          <>
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm font-semibold text-red-600 text-center">{uploadState.message}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setUploadState({ status: "idle" }); }}
              className="text-xs text-red-400 hover:text-red-600 flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Dismiss
            </button>
          </>
        )}
      </div>
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

  // Shared metadata fields (used by both tabs)
  const [mailType, setMailType] = useState("");
  const [dateSent, setDateSent] = useState("");
  const [notes, setNotes]       = useState("");

  // Tab state
  const [activeTab, setActiveTab] = useState<"text" | "upload">("text");

  // Text-paste form state
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

  // Text paste add
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
      toast({ title: "Example saved", description: "The Creative Agent will use it on the next campaign." });
      setText("");
      setMailType("");
      setDateSent("");
      setNotes("");
      setShowForm(false);
      await load();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Image/PDF upload success callback
  const handleUploadSuccess = useCallback((ex: Example) => {
    setExamples((prev) => [ex, ...prev]);
    setMailType("");
    setDateSent("");
    setNotes("");
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

  return (
    <div className="space-y-4">

      {/* ── Explainer ── */}
      <div className="flex items-start gap-3 p-3.5 rounded-lg bg-indigo-50 border border-indigo-100">
        <BookOpen className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
        <div className="text-xs text-indigo-800 leading-relaxed space-y-1.5">
          <p className="font-semibold">How this works</p>
          <p>
            Train the Creative Agent on your dealership's real mail pieces — paste copy text <em>or</em> upload
            a photo/scan of a physical mailer. For uploads, <strong>Claude Vision</strong> reads the design:
            headline treatment, offer placement, coupon style, color palette, urgency elements, and layout hierarchy.
          </p>
          <p>
            Both the copy text and the visual design description are injected into every new campaign as
            style guidelines — so the AI writes and <em>designs</em> new mail that feels like it came from the same
            team, not a template library.
          </p>
          {visualCount > 0 && (
            <p className="text-indigo-600 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {visualCount} scanned design{visualCount > 1 ? "s" : ""} active — vision learning enabled
            </p>
          )}
        </div>
      </div>

      {/* ── Count / toggle ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {loading ? "Loading…" : `${examples.length} example${examples.length !== 1 ? "s" : ""} stored`}
          {examples.length > 0 && !loading && (
            <span className="ml-1 text-emerald-600 font-medium">· baseline active</span>
          )}
        </p>
        <Button
          size="sm"
          variant={showForm ? "ghost" : "outline"}
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : <><Plus className="w-3.5 h-3.5" /> Add Example</>}
        </Button>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="border border-indigo-200 rounded-lg overflow-hidden bg-indigo-50/30">

          {/* Tab bar */}
          <div className="flex border-b border-indigo-200 bg-white">
            <button
              onClick={() => setActiveTab("text")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors",
                activeTab === "text"
                  ? "text-indigo-700 border-b-2 border-indigo-500 bg-indigo-50/60"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Paste Text
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors",
                activeTab === "upload"
                  ? "text-indigo-700 border-b-2 border-indigo-500 bg-indigo-50/60"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Image / PDF
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 leading-none">
                VISION
              </span>
            </button>
          </div>

          <div className="p-4 space-y-3">

            {/* ── TEXT TAB ── */}
            {activeTab === "text" && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mail copy <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste the full text of a past direct mail piece here…"
                  rows={6}
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y bg-white"
                />
              </div>
            )}

            {/* ── UPLOAD TAB ── */}
            {activeTab === "upload" && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-100 text-xs text-amber-800">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <span>
                    Claude Vision will read the design and extract: headline style, offer placement, color palette,
                    urgency treatments, layout hierarchy, and full copy text.
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Mail type</label>
                <select
                  value={mailType}
                  onChange={(e) => setMailType(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {MAIL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Date sent (approx.)</label>
                <input
                  type="date"
                  value={dateSent}
                  onChange={(e) => setDateSent(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Highest response rate — 4.2% return"
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* Save button — only for text tab; upload fires automatically */}
            {activeTab === "text" && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleAddText}
                  disabled={saving || !text.trim()}
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save Example
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Example list ── */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading examples…
        </div>
      ) : examples.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg space-y-1">
          <p>No baseline examples yet.</p>
          <p>Add your first one above — paste text or upload a mailer scan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {examples.map((ex) => (
            <ExampleCard key={ex.id} ex={ex} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* ── Instructions ── */}
      <div className="mt-2 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
        <p className="font-semibold text-slate-700">Getting the most out of AI training</p>
        <ol className="list-decimal list-inside space-y-1 leading-relaxed">
          <li>
            <strong>Upload scans first</strong> — take a photo or export a PDF of each past mailer and upload it.
            Claude Vision extracts both the copy and the full visual design system automatically.
          </li>
          <li>
            <strong>Or paste copy text</strong> — if you don't have scans, paste the body copy from past pieces.
            Select the mail type and add a note about performance.
          </li>
          <li>
            Aim for <strong>5–10 examples</strong> across different mail types for the best style coverage.
          </li>
          <li>
            The AI uses examples at <strong>every campaign</strong> — no further action needed after saving.
          </li>
        </ol>
        <div className="flex items-start gap-2 pt-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-slate-400 italic">
            Pro tip: Upload your highest-performing pieces and note the response rate. The Creative Agent
            will learn the visual design patterns — template style, offer badge shape, urgency treatment —
            that drove real results for your customers, not just the copy tone.
          </p>
        </div>
      </div>
    </div>
  );
}
