"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check, Upload, Database, Zap, ArrowRight, Loader2,
  FileText, Package, Bot, Megaphone, Users, ChevronRight,
  PlugZap, FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

interface StepState {
  customers: number;
  inventory: number;
  previewMessages: PreviewMessage[];
}

interface PreviewMessage {
  customerName: string;
  channel: string;
  subject?: string;
  content: string;
  confidence: number;
}

interface UploadResult {
  inserted: number;
  skipped: number;
  errors?: string[];
}

// ── CSV parser (no external deps) ─────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const vals = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? "").trim(); });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === "," && !inQ) { result.push(cur); cur = ""; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

// ── Step indicator ────────────────────────────────────────────

const STEPS = [
  { label: "Import Data",      icon: Database },
  { label: "Inventory",        icon: Package },
  { label: "Test Campaign",    icon: Bot },
  { label: "You're Ready",     icon: Megaphone },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                  done  ? "bg-emerald-500 border-emerald-500 text-white" :
                  active ? "bg-indigo-600 border-indigo-600 text-white" :
                           "bg-white border-slate-200 text-slate-400"
                )}
              >
                {done ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              <span className={cn(
                "text-[10px] font-medium whitespace-nowrap",
                active ? "text-indigo-700" : done ? "text-emerald-600" : "text-slate-400"
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mb-5 mx-1 transition-colors",
                done ? "bg-emerald-300" : "bg-slate-200"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── File uploader card ─────────────────────────────────────────

function FileUploadCard({
  label, hint, onUpload, uploaded, loading
}: {
  label: string; hint: string;
  onUpload: (rows: Record<string, string>[]) => Promise<UploadResult>;
  uploaded: boolean;
  loading: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFile(f: File | null) {
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try { setRows(parseCsv(e.target?.result as string)); }
      catch { setError("Could not parse CSV — ensure it's UTF-8 encoded."); }
    };
    reader.readAsText(f);
  }

  async function submit() {
    if (!rows.length) return;
    setUploading(true);
    setError(null);
    try {
      const r = await onUpload(rows);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (uploaded && result) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <Check className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">{result.inserted} records imported</p>
          {result.skipped > 0 && <p className="text-xs text-emerald-600">{result.skipped} duplicates skipped</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div
        className="p-6 text-center border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors group"
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0] ?? null); }}
      >
        <input ref={ref} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        <Upload className="w-7 h-7 text-slate-300 mx-auto mb-2 group-hover:text-indigo-400 transition-colors" />
        <p className="text-sm font-medium text-slate-700">{fileName ?? label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
      </div>
      {rows.length > 0 && (
        <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{rows.length} rows ready</span>
          </div>
          <button
            onClick={submit}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? "Importing…" : "Import"}
          </button>
        </div>
      )}
      {error && <p className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">{error}</p>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<StepState>({ customers: 0, inventory: 0, previewMessages: [] });
  const [campaignGoal, setCampaignGoal] = useState("Bring lapsed service customers back for their overdue oil change");
  const [channel, setChannel] = useState<"direct_mail" | "sms" | "email">("direct_mail");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // ── Upload handlers ──────────────────────────────────────────

  async function uploadCustomers(rows: Record<string, string>[]): Promise<UploadResult> {
    const res = await fetch("/api/onboard/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "customers", rows }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    setState((s) => ({ ...s, customers: s.customers + data.inserted }));
    return data;
  }

  async function uploadVisits(rows: Record<string, string>[]): Promise<UploadResult> {
    const res = await fetch("/api/onboard/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "visits", rows }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return data;
  }

  async function uploadInventory(rows: Record<string, string>[]): Promise<UploadResult> {
    const res = await fetch("/api/inventory/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    setState((s) => ({ ...s, inventory: s.inventory + data.inserted }));
    return data;
  }

  async function runTestCampaign() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/agents/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: campaignGoal, channel, maxCustomers: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setState((s) => ({ ...s, previewMessages: data.previewMessages ?? [] }));
      setStep(3);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setGenerating(false);
    }
  }

  // ── Render steps ──────────────────────────────────────────────

  return (
    <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Setup Wizard</h1>
        <p className="text-sm text-slate-500 mt-1">Follow these steps to activate your AI agents in under 5 minutes.</p>
      </div>

      <StepIndicator current={step} />

      {/* ── Step 0: Import Data ─────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Import your customers & service history</h2>
              <p className="text-sm text-slate-500 mt-1">Export a CSV from your DMS and upload it below. We handle most column name variations automatically.</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Customer File</p>
              <FileUploadCard
                label="Drop customer CSV here or click to browse"
                hint="Columns: first_name, last_name, email, phone, address, city, state, zip"
                onUpload={uploadCustomers}
                uploaded={state.customers > 0}
                loading={false}
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Service History (optional but recommended)</p>
              <FileUploadCard
                label="Drop service history CSV here"
                hint="Columns: email or phone, visit_date, make, model, year, service_type, total_amount"
                onUpload={uploadVisits}
                uploaded={false}
                loading={false}
              />
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <PlugZap className="w-4 h-4 text-indigo-500" />
                <p className="text-xs font-semibold text-slate-700">Have CDK or Reynolds?</p>
              </div>
              <p className="text-xs text-slate-500 mb-3">Native DMS connectors sync your data automatically — no CSV needed.</p>
              <a
                href="/dashboard/integrations"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Connect your DMS <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Skip →
            </button>
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Inventory ──────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Import your inventory</h2>
              <p className="text-sm text-slate-500 mt-1">
                The Creative Agent uses live inventory to suggest upgrade opportunities and aged units in personalized messages.
              </p>
            </div>

            <FileUploadCard
              label="Drop inventory CSV here or click to browse"
              hint="Columns: vin, year, make, model, trim, condition, price, mileage"
              onUpload={uploadInventory}
              uploaded={state.inventory > 0}
              loading={false}
            />

            {state.inventory > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                <Check className="w-4 h-4 shrink-0" />
                {state.inventory} vehicles imported — the Creative Agent will reference these automatically.
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(0)} className="text-sm text-slate-500 hover:text-slate-700">← Back</button>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-700">Skip →</button>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Test Campaign ──────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Run a sample AI campaign</h2>
              <p className="text-sm text-slate-500 mt-1">
                The full 5-agent swarm will generate personalized preview messages for your top customers. No messages are sent.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Channel
              </label>
              <div className="flex gap-2">
                {(["direct_mail", "sms", "email"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors",
                      channel === c
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-slate-200 text-slate-600 hover:border-indigo-300"
                    )}
                  >
                    {c === "direct_mail" ? "Direct Mail" : c === "sms" ? "SMS" : "Email"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Campaign Goal
              </label>
              <textarea
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="e.g. Bring lapsed service customers back for their overdue oil change"
              />
            </div>

            {genError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {genError}
              </div>
            )}

            <button
              onClick={runTestCampaign}
              disabled={generating || !campaignGoal.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Agents working…</>
              ) : (
                <><Zap className="w-4 h-4" /> Generate AI Preview</>
              )}
            </button>

            {generating && (
              <div className="space-y-1.5">
                {["Data Agent analyzing customers…", "Targeting Agent selecting audience…", "Creative Agent writing personalized copy…"].map((msg, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    {msg}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-700">← Back</button>
            <button onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-slate-700">Skip to finish →</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ───────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">You&apos;re ready to launch!</h2>
              <p className="text-sm text-slate-500 mt-1">Your AI agents are set up and ready to go.</p>
            </div>

            {/* Preview messages */}
            {state.previewMessages.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Sample AI-Generated Messages
                </p>
                {state.previewMessages.map((msg, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-700">{msg.customerName}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 capitalize">
                        {msg.channel.replace("_", " ")}
                      </span>
                    </div>
                    {msg.subject && <p className="text-xs font-medium text-slate-600 mb-1">Re: {msg.subject}</p>}
                    <p className="text-xs text-slate-700 leading-relaxed">{msg.content}</p>
                    <p className="text-[10px] text-slate-400 mt-2">
                      Confidence: {Math.round(msg.confidence * 100)}%
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Next steps */}
            <div className="grid grid-cols-1 gap-2">
              {[
                { href: "/dashboard/campaigns", icon: Megaphone, label: "Create your first campaign", desc: "Set up a full omnichannel campaign" },
                { href: "/dashboard/direct-mail", icon: FileText, label: "Send direct mail", desc: "Launch personalized postcards & letters" },
                { href: "/dashboard/customers", icon: Users, label: "View your customers", desc: "See segments and AI-scored contacts" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 p-3.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-200 transition-colors">
                    <item.icon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </a>
              ))}
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
