"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectionCard, type ConnectionStatus } from "@/components/integrations/connection-card";
import { parseCsvToRows } from "@/lib/csv";
import { Database, RefreshCw, AlertCircle, CheckCircle2, Info, Car, CreditCard, FileText, Webhook, Copy, Check } from "lucide-react";

type DmsProvider = "cdk_fortellis" | "reynolds" | "vinsolutions" | "vauto" | "seven_hundred_credit" | "general_crm";

interface DmsConnection {
  id: string;
  provider: string;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown> | null;
}

interface InventoryInsights {
  totalVehicles: number;
  agedCount: number;
  avgDaysOnLot: number;
  agingBuckets: Record<string, number>;
  conditionBreakdown: Record<string, number>;
  avgPriceToMarket: number | null;
  totalInventoryValue: number;
}

interface Props {
  connections: DmsConnection[];
  latestCounts: Record<string, { customers: number; visits: number; inventory: number }>;
  successParam?: string;
  errorParam?: string;
  dealerFunnelStats?: { total: number; optedOut: number; webhookUrl: string; secretConfigured: boolean };
  xtimeUrl?: string | null;
  inventoryInsights?: InventoryInsights | null;
}

// ---------------------------------------------------------------------------
// Provider display config
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<DmsProvider, string> = {
  cdk_fortellis: "CDK Fortellis",
  reynolds: "Reynolds & Reynolds",
  vinsolutions: "VinSolutions",
  vauto: "vAuto",
  seven_hundred_credit: "700Credit",
  general_crm: "General CRM",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider as DmsProvider] ?? provider;
}

// ---------------------------------------------------------------------------
// Generic API key modal (used for Reynolds, VinSolutions+dealerId, vAuto+dealerId, 700Credit, General CRM)
// ---------------------------------------------------------------------------

interface ApiKeyModalProps {
  open: boolean;
  title: string;
  description: string;
  fields: Array<{ name: string; label: string; placeholder: string; type?: string }>;
  onClose: () => void;
  onConnect: (values: Record<string, string>) => Promise<void>;
}

function ApiKeyModal({ open, title, description, fields, onClose, onConnect }: ApiKeyModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      await onConnect(values);
      setValues({});
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  const allFilled = fields.every((f) => (values[f.name] ?? "").trim().length > 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
        <p className="text-sm text-gray-500 mb-5">{description}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type ?? "text"}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                placeholder={f.placeholder}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          ))}
          {err && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {err}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !allFilled}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Connecting…" : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Upload modal (General CRM fallback)
// ---------------------------------------------------------------------------

function CsvUploadModal({
  open,
  onClose,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, reportProgress: (current: number, total: number) => void) => Promise<{ inserted: number; skipped: number }>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setErr("");
    setResult(null);
    setProgress(null);
    try {
      const r = await onUpload(file, (current, total) => setProgress({ current, total }));
      setResult(r);
      setFile(null);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  if (!open) return null;

  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Upload CRM Leads CSV</h2>
        <p className="text-sm text-gray-500 mb-3">
          Export your leads from Dealertrack, Elead, DealerSocket, or any CRM and upload the CSV here.
        </p>
        <p className="text-xs text-gray-400 mb-5">
          Supports any CSV export — column names are matched automatically (case-insensitive).
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setErr(""); }}
            className="w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border file:border-gray-300 file:text-sm file:bg-gray-50 hover:file:bg-gray-100"
          />
          {loading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                {progress
                  ? <span>Importing rows…</span>
                  : <span>Enriching segments…</span>
                }
                {progress && (
                  <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} ({pct}%)</span>
                )}
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-brand-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: progress ? `${pct}%` : "100%" }}
                />
              </div>
            </div>
          )}
          {err && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {err}
            </div>
          )}
          {result && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Import complete — {result.inserted.toLocaleString()} customers added, {result.skipped.toLocaleString()} skipped (duplicates or invalid).
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {result ? "Close" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DealerFunnel webhook card
// ---------------------------------------------------------------------------

function DealerFunnelCard({
  stats,
  onSaveSecret,
}: {
  stats?: Props["dealerFunnelStats"];
  onSaveSecret: (secret: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [showSecretForm, setShowSecretForm] = useState(false);
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  function copyUrl() {
    if (!stats?.webhookUrl) return;
    navigator.clipboard.writeText(stats.webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveErr("");
    try {
      await onSaveSecret(secret);
      setSecret("");
      setShowSecretForm(false);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
          <Webhook className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">DealerFunnel</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              stats?.secretConfigured
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}>
              {stats?.secretConfigured ? "Webhook active" : "Setup required"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Inbound ADF webhook · TCPA opt-out sync · AI reply from dashboard
          </p>
        </div>
      </div>

      {/* Stats */}
      {(stats?.total ?? 0) > 0 && (
        <div className="flex gap-6 text-sm">
          <div>
            <div className="font-semibold text-gray-900">{stats!.total}</div>
            <div className="text-gray-400 text-xs">Leads received</div>
          </div>
          <div>
            <div className="font-semibold text-red-600">{stats!.optedOut}</div>
            <div className="text-gray-400 text-xs">TCPA opt-outs</div>
          </div>
        </div>
      )}

      {/* Webhook URL */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-600">Webhook URL — paste into DealerFunnel → Settings → Lead Destinations</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate">
            {stats?.webhookUrl ?? "Loading…"}
          </code>
          <button
            onClick={copyUrl}
            className="shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Copy URL"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      {/* Opt-out webhook note */}
      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
        <strong>TCPA opt-out endpoint:</strong> also configure{" "}
        <code className="text-blue-700">/api/leads/opt-out?dealership=YOUR_SLUG</code>{" "}
        as a STOP/unsubscribe webhook in DealerFunnel and your Twilio MessagingService.
      </div>

      {/* Secret key setup */}
      {!showSecretForm ? (
        <button
          onClick={() => setShowSecretForm(true)}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          {stats?.secretConfigured ? "🔑 Rotate webhook secret" : "🔑 Set webhook secret (recommended)"}
        </button>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Webhook secret — DealerFunnel will send this in <code>x-lead-secret</code>
            </label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter a secret key…"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          {saveErr && <p className="text-xs text-red-600">{saveErr}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowSecretForm(false)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || !secret.trim()}
              className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save Secret"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// X-Time settings card
// ---------------------------------------------------------------------------

function XTimeCard({ currentUrl, onSave }: { currentUrl?: string | null; onSave: (url: string | null) => Promise<void> }) {
  const [editing, setEditing] = useState(!currentUrl);
  const [url, setUrl] = useState(currentUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await onSave(url.trim() || null);
      setEditing(false);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <span className="text-lg">📅</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">X-Time (Online Scheduler)</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${currentUrl ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {currentUrl ? "Configured" : "Not set"}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Reynolds & Reynolds appointment scheduler — AI campaigns include "Book Now" links directly in CTAs.
            </p>
          </div>
        </div>
        {currentUrl && !editing && (
          <button onClick={() => setEditing(true)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium shrink-0">Edit</button>
        )}
      </div>

      {currentUrl && !editing && (
        <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 truncate">
          {currentUrl}
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              X-Time scheduler URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.xtime.com/retailer/DEALER_CODE/schedule"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              Find this in your X-Time admin portal under Scheduler → Booking Link. Leave blank to disable.
            </p>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            {currentUrl && (
              <button type="button" onClick={() => setEditing(false)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            )}
            <button type="submit" disabled={saving}
              className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save URL"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function IntegrationsClient({ connections, latestCounts, successParam, errorParam, dealerFunnelStats, xtimeUrl, inventoryInsights }: Props) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState<DmsProvider | "csv_upload" | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (successParam === "cdk_connected") {
      setToast({ type: "success", message: "CDK Fortellis connected! Initial sync is running in the background." });
    } else if (errorParam) {
      const messages: Record<string, string> = {
        missing_params: "OAuth callback was missing required parameters.",
        invalid_state: "OAuth state mismatch — please try again.",
        token_exchange_failed: "Failed to exchange authorization code. Please reconnect.",
      };
      setToast({ type: "error", message: messages[errorParam] ?? `Connection error: ${errorParam}` });
    }
  }, [successParam, errorParam]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function getConnection(provider: string): DmsConnection | null {
    return connections.find((c) => c.provider === provider) ?? null;
  }

  function getStatus(provider: string): ConnectionStatus {
    const conn = getConnection(provider);
    if (!conn) return "not_connected";
    return conn.status as ConnectionStatus;
  }

  async function handleSync(provider: DmsProvider) {
    const slugMap: Record<DmsProvider, string> = {
      cdk_fortellis: "cdk",
      reynolds: "reynolds",
      vinsolutions: "vinsolutions",
      vauto: "vauto",
      seven_hundred_credit: "700credit",
      general_crm: "general-crm",
    };
    const res = await fetch(`/api/integrations/${slugMap[provider]}/sync`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Sync failed");
    }
    setToast({ type: "success", message: `${providerLabel(provider)} sync triggered.` });
    setTimeout(() => router.refresh(), 1500);
  }

  async function handleConnect(provider: DmsProvider, values: Record<string, string>) {
    const slugMap: Record<DmsProvider, string> = {
      cdk_fortellis: "cdk",
      reynolds: "reynolds",
      vinsolutions: "vinsolutions",
      vauto: "vauto",
      seven_hundred_credit: "700credit",
      general_crm: "general-crm",
    };
    const res = await fetch(`/api/integrations/${slugMap[provider]}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Connection failed");
    }
    setToast({ type: "success", message: `${providerLabel(provider)} connected! Initial sync is running.` });
    setTimeout(() => router.refresh(), 1000);
  }

  async function handleDisconnect(provider: DmsProvider) {
    const slugMap: Record<DmsProvider, string> = {
      cdk_fortellis: "cdk",
      reynolds: "reynolds",
      vinsolutions: "vinsolutions",
      vauto: "vauto",
      seven_hundred_credit: "700credit",
      general_crm: "general-crm",
    };
    const res = await fetch(`/api/integrations/${slugMap[provider]}/sync`, { method: "DELETE" });
    if (res.ok) {
      setToast({ type: "success", message: "Integration disconnected." });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? `Disconnect failed (${res.status})`);
    }
  }

  async function handleCsvUpload(file: File, reportProgress: (current: number, total: number) => void) {
    const text = await file.text();
    const rows = parseCsvToRows(text);
    if (rows.length === 0) throw new Error("CSV contained no valid rows.");

    const BATCH = 500;
    let totalInserted = 0;
    let totalSkipped = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const res = await fetch("/api/onboard/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "customers", rows: batch }),
      });
      if (!res.ok) {
        const respText = await res.text();
        let message = "Upload failed";
        try { message = (JSON.parse(respText) as { error?: string }).error ?? message; } catch { /* non-JSON error */ }
        throw new Error(message);
      }
      const data = await res.json() as { inserted: number; skipped: number };
      totalInserted += data.inserted ?? 0;
      totalSkipped += data.skipped ?? 0;
      reportProgress(Math.min(i + BATCH, rows.length), rows.length);
    }

    // Refresh segment stats + write dealership_insights so swarm has context
    await fetch("/api/onboard/enrich", { method: "POST" }).catch(() => null);

    setTimeout(() => router.refresh(), 500);
    return { inserted: totalInserted, skipped: totalSkipped };
  }

  const [currentXtimeUrl, setCurrentXtimeUrl] = useState(xtimeUrl ?? null);

  async function handleSaveXtimeUrl(url: string | null) {
    const res = await fetch("/api/integrations/xtime/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xtime_url: url }),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Failed to save");
    }
    setCurrentXtimeUrl(url);
    setToast({ type: "success", message: url ? "X-Time scheduler URL saved." : "X-Time URL cleared." });
  }

  async function handleSaveDealerFunnelSecret(secret: string) {
    const res = await fetch("/api/integrations/dealerfunnel/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inbound_lead_secret: secret }),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Failed to save secret");
    }
    setToast({ type: "success", message: "DealerFunnel webhook secret saved." });
    setTimeout(() => router.refresh(), 800);
  }

  const cdkConn = getConnection("cdk_fortellis");
  const reynoldsConn = getConnection("reynolds");
  const vinConn = getConnection("vinsolutions");
  const vautoConn = getConnection("vauto");
  const creditConn = getConnection("seven_hundred_credit");
  const crmConn = getConnection("general_crm");

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">DMS Integrations</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Connect your Dealer Management System and CRM tools for automatic real-time data sync.
          Customer records, leads, inventory, and deal data flow in automatically.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          After connecting, AutoCDP runs an initial full sync then delta syncs every 30–60 minutes.
          The AI swarm re-analyzes your data after each sync so campaigns stay fresh.
        </p>
      </div>

      {/* Lead providers */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Lead Providers</h2>
        <div className="space-y-4">
          <DealerFunnelCard
            stats={dealerFunnelStats}
            onSaveSecret={handleSaveDealerFunnelSecret}
          />
        </div>
      </div>

      {/* Scheduling */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Online Scheduling</h2>
        <XTimeCard currentUrl={currentXtimeUrl} onSave={handleSaveXtimeUrl} />
      </div>

      {/* DMS providers */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">DMS Systems</h2>
        <div className="space-y-4">
          <ConnectionCard
            provider="cdk_fortellis"
            name="CDK Fortellis"
            description="OAuth 2.0 • Customers, Service ROs, Inventory, F&I Deals"
            logo={<div className="w-8 h-8 flex items-center justify-center"><Database className="w-5 h-5 text-blue-600" /></div>}
            status={getStatus("cdk_fortellis")}
            lastSyncAt={cdkConn?.last_sync_at}
            lastError={cdkConn?.last_error}
            syncCounts={latestCounts["cdk_fortellis"] ?? null}
            onConnect={() => { window.location.href = "/api/integrations/cdk/connect"; }}
            onSync={() => handleSync("cdk_fortellis")}
            onDisconnect={() => handleDisconnect("cdk_fortellis")}
            connectLabel="Connect with CDK Fortellis"
          />

          <ConnectionCard
            provider="reynolds"
            name="Reynolds & Reynolds"
            description="API Key • ERA-IGNITE DealerLink • Customers, Service ROs, Inventory, Sales"
            logo={<div className="w-8 h-8 flex items-center justify-center"><Database className="w-5 h-5 text-orange-500" /></div>}
            status={getStatus("reynolds")}
            lastSyncAt={reynoldsConn?.last_sync_at}
            lastError={reynoldsConn?.last_error}
            syncCounts={latestCounts["reynolds"] ?? null}
            onConnect={() => setOpenModal("reynolds")}
            onSync={() => handleSync("reynolds")}
            onDisconnect={() => handleDisconnect("reynolds")}
            connectLabel="Connect Reynolds"
          />
        </div>
      </div>

      {/* CRM providers */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">CRM Systems</h2>
        <div className="space-y-4">
          <ConnectionCard
            provider="vinsolutions"
            name="VinSolutions"
            description="API Key + Dealer ID • Contacts, Leads, Activities, Email History"
            logo={<div className="w-8 h-8 flex items-center justify-center"><Database className="w-5 h-5 text-green-600" /></div>}
            status={getStatus("vinsolutions")}
            lastSyncAt={vinConn?.last_sync_at}
            lastError={vinConn?.last_error}
            syncCounts={latestCounts["vinsolutions"] ?? null}
            onConnect={() => setOpenModal("vinsolutions")}
            onSync={() => handleSync("vinsolutions")}
            onDisconnect={() => handleDisconnect("vinsolutions")}
            connectLabel="Connect VinSolutions"
          />

          <ConnectionCard
            provider="general_crm"
            name="General CRM (Dealertrack, Elead, DealerSocket)"
            description="API Key or CSV upload • Leads, Activities — works with most CRMs"
            logo={<div className="w-8 h-8 flex items-center justify-center"><FileText className="w-5 h-5 text-purple-600" /></div>}
            status={getStatus("general_crm")}
            lastSyncAt={crmConn?.last_sync_at}
            lastError={crmConn?.last_error}
            syncCounts={latestCounts["general_crm"] ?? null}
            onConnect={() => setOpenModal("general_crm")}
            onSync={() => handleSync("general_crm")}
            onDisconnect={() => handleDisconnect("general_crm")}
            connectLabel="Connect via API"
          />
          <button
            onClick={() => setOpenModal("csv_upload")}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-purple-300 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Or upload a CRM leads CSV (Dealertrack, Elead, etc.)
          </button>
        </div>
      </div>

      {/* Inventory + enrichment */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Inventory & Enrichment</h2>
        <div className="space-y-4">
          <ConnectionCard
            provider="vauto"
            name="vAuto"
            description="API Key + Dealer ID • Vehicle Inventory — VIN, pricing, market data, days on lot, turnover"
            logo={<div className="w-8 h-8 flex items-center justify-center"><Car className="w-5 h-5 text-indigo-600" /></div>}
            status={getStatus("vauto")}
            lastSyncAt={vautoConn?.last_sync_at}
            lastError={vautoConn?.last_error}
            syncCounts={latestCounts["vauto"] ?? null}
            onConnect={() => setOpenModal("vauto")}
            onSync={() => handleSync("vauto")}
            onDisconnect={() => handleDisconnect("vauto")}
            connectLabel="Connect vAuto"
          />

          {/* vAuto inventory analytics — shown when connected + data available */}
          {inventoryInsights && inventoryInsights.totalVehicles > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-indigo-900">Inventory Analytics</p>
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                  {inventoryInsights.totalVehicles} vehicles · ${(inventoryInsights.totalInventoryValue / 1_000_000).toFixed(1)}M
                </span>
              </div>

              {/* Aging buckets */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Days on Lot</p>
                <div className="grid grid-cols-4 gap-2">
                  {([["<30", "emerald"], ["30-60", "amber"], ["60-90", "orange"], ["90+", "red"]] as const).map(([bucket, color]) => {
                    const count = inventoryInsights.agingBuckets[bucket] ?? 0;
                    const pct = inventoryInsights.totalVehicles > 0 ? Math.round((count / inventoryInsights.totalVehicles) * 100) : 0;
                    const colorMap: Record<string, string> = { emerald: "bg-emerald-50 border-emerald-200 text-emerald-700", amber: "bg-amber-50 border-amber-200 text-amber-700", orange: "bg-orange-50 border-orange-200 text-orange-700", red: "bg-red-50 border-red-200 text-red-700" };
                    return (
                      <div key={bucket} className={`rounded-lg border p-2.5 text-center ${colorMap[color]}`}>
                        <p className="text-[18px] font-bold leading-none tabular-nums">{count}</p>
                        <p className="text-[10px] font-semibold mt-1">{bucket} days</p>
                        <p className="text-[10px] opacity-70">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
                {inventoryInsights.agedCount > 0 && (
                  <p className="text-[11px] text-orange-600 font-medium mt-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                    {inventoryInsights.agedCount} vehicle{inventoryInsights.agedCount !== 1 ? "s" : ""} aged 60+ days — consider an aged inventory campaign
                  </p>
                )}
              </div>

              {/* Condition + price to market */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Condition Mix</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(inventoryInsights.conditionBreakdown).map(([cond, cnt]) => (
                      <span key={cond} className="text-[11px] bg-slate-100 text-slate-700 font-semibold px-2 py-1 rounded-lg capitalize">
                        {cond}: {cnt}
                      </span>
                    ))}
                  </div>
                </div>
                {inventoryInsights.avgPriceToMarket != null && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Avg Price to Market</p>
                    <span className={`text-[13px] font-bold px-2.5 py-1 rounded-lg ${inventoryInsights.avgPriceToMarket > 102 ? "bg-red-50 text-red-700" : inventoryInsights.avgPriceToMarket < 98 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                      {inventoryInsights.avgPriceToMarket}%
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {inventoryInsights.avgPriceToMarket > 102 ? "Priced above market" : inventoryInsights.avgPriceToMarket < 98 ? "Priced below market" : "At market"}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Avg Days on Lot</p>
                  <span className={`text-[13px] font-bold px-2.5 py-1 rounded-lg ${inventoryInsights.avgDaysOnLot > 60 ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-700"}`}>
                    {inventoryInsights.avgDaysOnLot}d
                  </span>
                </div>
              </div>
            </div>
          )}

          <ConnectionCard
            provider="seven_hundred_credit"
            name="700Credit"
            description="API Key • Soft-pull credit tier enrichment for existing customers (FCRA-compliant)"
            logo={<div className="w-8 h-8 flex items-center justify-center"><CreditCard className="w-5 h-5 text-yellow-600" /></div>}
            status={getStatus("seven_hundred_credit")}
            lastSyncAt={creditConn?.last_sync_at}
            lastError={creditConn?.last_error}
            syncCounts={latestCounts["seven_hundred_credit"] ?? null}
            onConnect={() => setOpenModal("seven_hundred_credit")}
            onSync={() => handleSync("seven_hundred_credit")}
            onDisconnect={() => handleDisconnect("seven_hundred_credit")}
            connectLabel="Connect 700Credit"
          />
        </div>
      </div>

      {/* Sync history */}
      {connections.some((c) => c.status === "active") && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Syncs</h2>
          <SyncHistory />
        </div>
      )}

      {/* Modals */}
      <ApiKeyModal
        open={openModal === "reynolds"}
        title="Connect Reynolds & Reynolds"
        description="Enter your Reynolds DealerLink API key from the ERA-IGNITE portal."
        fields={[{ name: "apiKey", label: "DealerLink API Key", placeholder: "rr_live_…", type: "password" }]}
        onClose={() => setOpenModal(null)}
        onConnect={(v) => handleConnect("reynolds", v)}
      />

      <ApiKeyModal
        open={openModal === "vinsolutions"}
        title="Connect VinSolutions"
        description="Enter your VinSolutions API key and Dealer ID from the VinSolutions admin portal."
        fields={[
          { name: "apiKey", label: "API Key", placeholder: "vs_live_…", type: "password" },
          { name: "dealerId", label: "Dealer ID", placeholder: "DLR-12345" },
        ]}
        onClose={() => setOpenModal(null)}
        onConnect={(v) => handleConnect("vinsolutions", v)}
      />

      <ApiKeyModal
        open={openModal === "vauto"}
        title="Connect vAuto"
        description="Enter your vAuto API key and Dealer ID from the vAuto Integration Center."
        fields={[
          { name: "apiKey", label: "API Key", placeholder: "va_live_…", type: "password" },
          { name: "dealerId", label: "Dealer ID", placeholder: "DLR-12345" },
        ]}
        onClose={() => setOpenModal(null)}
        onConnect={(v) => handleConnect("vauto", v)}
      />

      <ApiKeyModal
        open={openModal === "seven_hundred_credit"}
        title="Connect 700Credit"
        description="Enter your 700Credit API key. AutoCDP performs soft-pull credit tier lookups only on customers with an existing dealership relationship (FCRA permissible purpose)."
        fields={[{ name: "apiKey", label: "700Credit API Key", placeholder: "7c_live_…", type: "password" }]}
        onClose={() => setOpenModal(null)}
        onConnect={(v) => handleConnect("seven_hundred_credit", v)}
      />

      <ApiKeyModal
        open={openModal === "general_crm"}
        title="Connect General CRM"
        description="Enter your CRM API key and base URL (Dealertrack, Elead, DealerSocket, etc.). No API? Use the CSV upload option instead."
        fields={[
          { name: "apiKey", label: "API Key", placeholder: "crm_live_…", type: "password" },
          { name: "baseUrl", label: "API Base URL", placeholder: "https://api.yourcrm.com/v1" },
        ]}
        onClose={() => setOpenModal(null)}
        onConnect={(v) => handleConnect("general_crm", v)}
      />

      <CsvUploadModal
        open={openModal === "csv_upload"}
        onClose={() => setOpenModal(null)}
        onUpload={(file, reportProgress) => handleCsvUpload(file, reportProgress)}
      />
    </div>
  );
}

function SyncHistory() {
  const [jobs, setJobs] = useState<
    Array<{
      id: string;
      provider: string;
      job_type: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      records_synced: { customers: number; visits: number; inventory: number } | null;
      error: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations/sync-history")
      .then((r) => r.json())
      .then((d) => { setJobs((d as { jobs: typeof jobs }).jobs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-gray-400">Loading sync history…</div>;
  if (jobs.length === 0) return <div className="text-sm text-gray-400">No syncs yet.</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Provider</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Records</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Started</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {jobs.map((job) => {
            const rc = job.records_synced;
            return (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {providerLabel(job.provider)}
                </td>
                <td className="px-4 py-3 text-gray-500 capitalize">{job.job_type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      job.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : job.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {job.status === "running" && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {rc
                    ? `${rc.customers} cust · ${rc.visits} visits · ${rc.inventory} inv`
                    : job.error
                    ? <span className="text-red-500 text-xs truncate max-w-[200px] block">{job.error}</span>
                    : "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(job.started_at).toLocaleString("en-US", {
                    month: "short", day: "numeric",
                    hour: "numeric", minute: "2-digit",
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
