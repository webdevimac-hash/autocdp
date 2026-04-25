"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Loader2, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

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

type Example = {
  id: string;
  example_text: string;
  mail_type: string | null;
  date_sent: string | null;
  notes: string | null;
  created_at: string;
};

function ExampleCard({ ex, onDelete }: { ex: Example; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const preview = ex.example_text.slice(0, 120);
  const isLong = ex.example_text.length > 120;

  return (
    <div className="border border-slate-200 rounded-lg p-3.5 bg-white hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {ex.mail_type && (
              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {MAIL_TYPES.find((t) => t.value === ex.mail_type)?.label ?? ex.mail_type}
              </span>
            )}
            {ex.date_sent && (
              <span className="text-[10px] text-slate-400">{ex.date_sent}</span>
            )}
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {expanded || !isLong ? ex.example_text : `${preview}…`}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 mt-1 flex items-center gap-0.5"
            >
              {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
            </button>
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

export function TrainingDataSection() {
  const { toast } = useToast();
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New example form state
  const [text, setText] = useState("");
  const [mailType, setMailType] = useState("");
  const [dateSent, setDateSent] = useState("");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);

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

  const handleAdd = async () => {
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

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <div className="flex items-start gap-3 p-3.5 rounded-lg bg-indigo-50 border border-indigo-100">
        <BookOpen className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
        <div className="text-xs text-indigo-800 leading-relaxed">
          <p className="font-semibold mb-0.5">How this works</p>
          <p>
            Paste your best historical direct mail pieces here. The Creative Agent loads the 8 most
            recent examples and uses them as style guidelines when writing new campaigns — matching
            your tone, sentence length, offer structure, and sign-off style automatically.
          </p>
        </div>
      </div>

      {/* Example count / status */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {loading ? "Loading…" : `${examples.length} example${examples.length !== 1 ? "s" : ""} stored`}
          {examples.length > 0 && !loading && (
            <span className="ml-1 text-emerald-600 font-medium">
              · baseline active
            </span>
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

      {/* Add form */}
      {showForm && (
        <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/40 space-y-3">
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

          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleAdd} disabled={saving || !text.trim()}>
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save Example
            </Button>
          </div>
        </div>
      )}

      {/* Example list */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading examples…
        </div>
      ) : examples.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
          No baseline examples yet. Add your first one above to start shaping the AI&apos;s writing style.
        </div>
      ) : (
        <div className="space-y-2">
          {examples.map((ex) => (
            <ExampleCard key={ex.id} ex={ex} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Bryant instructions */}
      <div className="mt-2 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
        <p className="font-semibold text-slate-700">How to upload Bryant&apos;s compiled list</p>
        <ol className="list-decimal list-inside space-y-1 leading-relaxed">
          <li>Open each historical mail piece (PDF, Word doc, or printed scan).</li>
          <li>Copy the full text of each piece.</li>
          <li>Click <span className="font-medium">Add Example</span> above, paste the text, select the mail type, and add the approximate send date.</li>
          <li>Repeat for each piece — aim for at least 5–10 examples across different mail types.</li>
          <li>The AI will automatically use these on every new campaign. No further action needed.</li>
        </ol>
        <p className="text-slate-400 italic pt-0.5">
          Pro tip: Include your highest-performing pieces and note the response rate in the Notes field.
          The Creative Agent will learn what worked best.
        </p>
      </div>
    </div>
  );
}
