"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Loader2, BrainCircuit, ToggleLeft, ToggleRight } from "lucide-react";
import type { MemoryCategory } from "@/lib/memories";

interface Memory {
  id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES: { key: MemoryCategory; label: string; description: string; color: string }[] = [
  { key: "tone",    label: "Tone & Voice",       description: "How the AI should sound — formal, warm, urgent, etc.",       color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  { key: "offers",  label: "Offers to Highlight", description: "Current deals, promos, or services to emphasize.",           color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { key: "avoid",   label: "Things to Avoid",     description: "Topics, phrases, or competitors the AI should never mention.", color: "text-red-600 bg-red-50 border-red-200" },
  { key: "style",   label: "Style Preferences",   description: "Layout, formatting, sign-off preferences, etc.",             color: "text-violet-600 bg-violet-50 border-violet-200" },
  { key: "general", label: "General Guidance",    description: "Anything else Bryant wants the swarm to remember.",         color: "text-amber-600 bg-amber-50 border-amber-200" },
];

export function MemoriesSection() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MemoryCategory>("tone");

  // Add form
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dealership/memories")
      .then((r) => r.ok ? r.json() : { memories: [] })
      .then((d: { memories: Memory[] }) => setMemories(d.memories ?? []))
      .catch(() => setMemories([]))
      .finally(() => setLoading(false));
  }, []);

  async function addMemory() {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/dealership/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: activeTab, title: newTitle.trim(), content: newContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMemories((prev) => [data.memory, ...prev]);
      setNewTitle("");
      setNewContent("");
      setAdding(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/dealership/memories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !current }),
    });
    if (res.ok) {
      setMemories((prev) => prev.map((m) => m.id === id ? { ...m, is_active: !current } : m));
    }
  }

  async function deleteMemory(id: string) {
    const res = await fetch(`/api/dealership/memories/${id}`, { method: "DELETE" });
    if (res.ok) setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  const tabMemories = memories.filter((m) => m.category === activeTab);
  const activeCount = memories.filter((m) => m.is_active).length;
  const activeCat = CATEGORIES.find((c) => c.key === activeTab)!;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-indigo-500" />
          <span className="text-xs text-slate-500 font-medium">
            {loading ? "Loading…" : `${activeCount} active guidance${activeCount !== 1 ? "s" : ""} injected into every campaign`}
          </span>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const count = memories.filter((m) => m.category === cat.key && m.is_active).length;
          return (
            <button
              key={cat.key}
              onClick={() => { setActiveTab(cat.key); setAdding(false); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all",
                activeTab === cat.key
                  ? cat.color
                  : "text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              {cat.label}
              {count > 0 && (
                <span className="ml-1.5 bg-white/70 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab description */}
      <p className="text-xs text-slate-400">{activeCat.description}</p>

      {/* Memory list */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading memories…
        </div>
      ) : tabMemories.length === 0 && !adding ? (
        <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
          No {activeCat.label.toLowerCase()} memories yet.
          <br />
          <button
            className="mt-1 text-indigo-500 font-medium hover:underline"
            onClick={() => setAdding(true)}
          >
            Add the first one →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tabMemories.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all",
                m.is_active
                  ? "border-slate-200 bg-white"
                  : "border-slate-100 bg-slate-50 opacity-60"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-slate-800 truncate">{m.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{m.content}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleActive(m.id, m.is_active)}
                  className="text-slate-400 hover:text-indigo-500 transition-colors p-1"
                  title={m.is_active ? "Disable" : "Enable"}
                >
                  {m.is_active
                    ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                    : <ToggleLeft className="w-4 h-4" />
                  }
                </button>
                <button
                  onClick={() => deleteMemory(m.id)}
                  className="text-slate-300 hover:text-red-400 transition-colors p-1"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding ? (
        <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/40 space-y-3">
          <div className="text-xs font-semibold text-indigo-700">New {activeCat.label} memory</div>
          <Input
            placeholder="Short title (e.g. 'Friendly but not cheesy')"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="text-sm h-9"
          />
          <textarea
            placeholder="Full guidance text the AI will read before writing…"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-[var(--radius)] p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 bg-slate-50/50"
          />
          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={addMemory} disabled={saving || !newTitle.trim() || !newContent.trim()} className="h-8 text-xs">
              {saving ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Saving…</> : "Save memory"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setSaveError(null); }} className="h-8 text-xs">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          className="h-8 text-xs gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add {activeCat.label} memory
        </Button>
      )}
    </div>
  );
}
