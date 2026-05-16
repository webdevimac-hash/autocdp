"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectionCard, type ConnectionStatus } from "@/components/integrations/connection-card";
import { parseCsvToRows } from "@/lib/csv";
import { Database, RefreshCw, AlertCircle, CheckCircle2, Info, Car, CreditCard, FileText, Webhook, Copy, Check, ArrowLeftRight, Zap, TriangleAlert, Eye, EyeOff, ChevronDown, ChevronUp, Radio } from "lucide-react";

type DmsProvider =
  | "cdk_fortellis"
  | "reynolds"
  | "vinsolutions"
  | "dealertrack"
  | "elead"
  | "vauto"
  | "seven_hundred_credit"
  | "general_crm";

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

interface QueueStats {
  pending: number;
  dead: number;
  oldestDeadAt: string | null;
}

interface Props {
  connections: DmsConnection[];
  latestCounts: Record<string, { customers: number; visits: number; inventory: number }>;
  successParam?: string;
  errorParam?: string;
  dealerFunnelStats?: { total: number; optedOut: number; webhookUrl: string; secretConfigured: boolean };
  xtimeUrl?: string | null;
  inventoryInsights?: InventoryInsights | null;
  queueStats?: QueueStats | null;
  appUrl?: string;
}

// ---------------------------------------------------------------------------
// Provider display config
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<DmsProvider, string> = {
  cdk_fortellis:        "CDK Fortellis",
  reynolds:             "Reynolds & Reynolds",
  vinsolutions:         "VinSolutions",
  dealertrack:          "Dealertrack",
  elead:                "Elead CRM",
  vauto:                "vAuto",
  seven_hundred_credit: "700Credit",
  general_crm:          "General CRM",
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

// ---------------------------------------------------------------------------
// Plugin Mode panel — rendered beneath each CRM card when connected
// ---------------------------------------------------------------------------

function PluginModePanel({
  provider,
  enabled,
  loading,
  onToggle,
  deadCount = 0,
}: {
  provider: string;
  enabled: boolean;
  loading: boolean;
  onToggle: (value: boolean) => void;
  deadCount?: number;
}) {
  const label = PROVIDER_LABELS[provider as DmsProvider] ?? provider;

  return (
    <div
      className={`-mt-2 rounded-b-xl border-x border-b px-4 py-3 flex items-center justify-between gap-4 transition-colors ${
        enabled
          ? "bg-indigo-50 border-indigo-200"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          enabled ? "bg-indigo-100" : "bg-gray-200"
        }`}>
          <ArrowLeftRight className={`w-3.5 h-3.5 ${enabled ? "text-indigo-600" : "text-gray-400"}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] font-semibold ${enabled ? "text-indigo-900" : "text-gray-700"}`}>
              Plugin Mode
            </span>
            {enabled && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-600 text-white">
                <Zap className="w-2.5 h-2.5" /> ACTIVE
              </span>
            )}
            {deadCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200"
                title="Some write-backs failed permanently. Check the Audit Log for details."
              >
                <TriangleAlert className="w-2.5 h-2.5" /> {deadCount} failed
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
            {enabled
              ? `AutoCDP writes campaign sends, QR scans, and bookings back into ${label} as native activities.`
              : `Enable to push AutoCDP campaign results into ${label} automatically — no manual CRM entry needed.`}
          </p>
          {deadCount > 0 && (
            <p className="text-[11px] text-red-600 mt-0.5">
              {deadCount} write-back{deadCount !== 1 ? "s" : ""} could not be delivered after 5 attempts —{" "}
              <a href="/dashboard/audit" className="underline underline-offset-2 font-medium">view in Audit Log</a>.
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        disabled={loading}
        aria-pressed={enabled}
        title={enabled ? "Disable Plugin Mode" : "Enable Plugin Mode"}
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 disabled:opacity-60 ${
          enabled ? "bg-indigo-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Webhook info panel — shown below each connected CRM card
// ---------------------------------------------------------------------------

const WEBHOOK_INSTRUCTIONS: Record<string, { path: string; steps: string[]; headerName: string }> = {
  vinsolutions: {
    path:       "VinSolutions Admin Panel → API Settings → Webhooks → Add Endpoint",
    headerName: "X-VinSolutions-Signature",
    steps: [
      "Open VinSolutions and go to Admin Panel → API Settings → Webhooks.",
      "Click Add Endpoint and paste the Endpoint URL below.",
      "Paste the Signing Secret into the Secret field.",
      "Select events: Contacts (created, updated, opted-out), Leads (created, updated, status changed), Activities (completed).",
      "Save. VinSolutions will send a test event — check the Last Event timestamp below to confirm.",
    ],
  },
  dealertrack: {
    path:       "DT Connect Portal → Partner Settings → Event Subscriptions → Register Endpoint",
    headerName: "X-DT-Signature",
    steps: [
      "Log in to the Dealertrack DT Connect Partner Portal.",
      "Navigate to Partner Settings → Event Subscriptions → Register Endpoint.",
      "Paste the Endpoint URL below into the Webhook URL field.",
      "Paste the Signing Secret into the Signing Secret field.",
      "Select events: lead.created, lead.updated, lead.status_changed, contact.optout.",
      "Save and confirm with the test ping.",
    ],
  },
  elead: {
    path:       "Elead Admin Portal → Integrations → Webhooks → New Webhook",
    headerName: "X-Elead-Signature",
    steps: [
      "Log in to the Elead Admin Portal (CDK Global).",
      "Go to Integrations → Webhooks → New Webhook.",
      "Paste the Endpoint URL below into the URL field.",
      "Paste the Signing Secret into the Secret Key field.",
      "Select events: lead.created, lead.updated, lead.status_changed, contact.dnc.",
      "Click Save and send a test to confirm delivery.",
    ],
  },
};

function WebhookInfoPanel({
  provider,
  webhookToken,
  webhookSecret,
  lastWebhookAt,
  webhookEventCount,
  appUrl,
}: {
  provider: string;
  webhookToken: string;
  webhookSecret: string;
  lastWebhookAt?: string | null;
  webhookEventCount?: number;
  appUrl: string;
}) {
  const [showSecret,  setShowSecret]  = useState(false);
  const [showSetup,   setShowSetup]   = useState(false);
  const [copiedUrl,   setCopiedUrl]   = useState(false);
  const [copiedSec,   setCopiedSec]   = useState(false);

  const endpointUrl = `${appUrl}/api/webhooks/${provider}?token=${webhookToken}`;
  const cfg         = WEBHOOK_INSTRUCTIONS[provider];

  function copyUrl() {
    navigator.clipboard.writeText(endpointUrl).then(() => {
      setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000);
    });
  }
  function copySecret() {
    navigator.clipboard.writeText(webhookSecret).then(() => {
      setCopiedSec(true); setTimeout(() => setCopiedSec(false), 2000);
    });
  }

  function fmtRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return "just now";
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="-mt-px rounded-b-xl border-x border-b border-violet-200 bg-violet-50/60 px-4 pt-3 pb-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-[12px] font-semibold text-violet-900">Real-Time Webhook</span>
          {lastWebhookAt ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Live
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
              Awaiting first event
            </span>
          )}
        </div>
        {lastWebhookAt && webhookEventCount != null && (
          <span className="text-[11px] text-violet-600">
            Last: {fmtRelative(lastWebhookAt)} · {webhookEventCount.toLocaleString()} events
          </span>
        )}
      </div>

      {/* Endpoint URL */}
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-violet-700">Endpoint URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[10px] bg-white border border-violet-200 rounded-lg px-2.5 py-1.5 text-gray-700 truncate select-all">
            {endpointUrl}
          </code>
          <button
            onClick={copyUrl}
            className="shrink-0 p-1.5 rounded-lg border border-violet-200 bg-white hover:bg-violet-50 transition-colors"
            title="Copy endpoint URL"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-violet-500" />}
          </button>
        </div>
      </div>

      {/* Signing Secret */}
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-violet-700">
          Signing Secret <span className="text-violet-400 font-normal">(paste into {providerLabel(provider)})</span>
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[10px] bg-white border border-violet-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-mono truncate">
            {showSecret ? webhookSecret : "•".repeat(32)}
          </code>
          <button
            onClick={() => setShowSecret((s) => !s)}
            className="shrink-0 p-1.5 rounded-lg border border-violet-200 bg-white hover:bg-violet-50 transition-colors"
            title={showSecret ? "Hide secret" : "Reveal secret"}
          >
            {showSecret
              ? <EyeOff className="w-3.5 h-3.5 text-violet-500" />
              : <Eye    className="w-3.5 h-3.5 text-violet-500" />}
          </button>
          <button
            onClick={copySecret}
            className="shrink-0 p-1.5 rounded-lg border border-violet-200 bg-white hover:bg-violet-50 transition-colors"
            title="Copy secret"
          >
            {copiedSec ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-violet-500" />}
          </button>
        </div>
        {cfg && (
          <p className="text-[10px] text-violet-500">
            Signature header: <code className="font-mono">{cfg.headerName}</code>
          </p>
        )}
      </div>

      {/* Collapsible setup instructions */}
      {cfg && (
        <button
          onClick={() => setShowSetup((s) => !s)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-violet-600 hover:text-violet-800 transition-colors"
        >
          {showSetup
            ? <ChevronUp   className="w-3.5 h-3.5" />
            : <ChevronDown className="w-3.5 h-3.5" />}
          {showSetup ? "Hide setup instructions" : "Show setup instructions"}
        </button>
      )}
      {showSetup && cfg && (
        <div className="bg-white border border-violet-200 rounded-lg px-3.5 py-3 space-y-2">
          <p className="text-[11px] font-semibold text-violet-900">{cfg.path}</p>
          <ol className="space-y-1.5 list-none">
            {cfg.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-gray-600">
                <span className="shrink-0 w-4 h-4 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-[9px]">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function IntegrationsClient({ connections, latestCounts, successParam, errorParam, dealerFunnelStats, xtimeUrl, inventoryInsights, queueStats, appUrl = "https://app.autocdp.com" }: Props) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState<DmsProvider | "csv_upload" | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pluginModeMap, setPluginModeMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const conn of connections) {
      map[conn.provider] = (conn.metadata?.plugin_mode as boolean) ?? false;
    }
    return map;
  });
  const [pluginModeLoading, setPluginModeLoading] = useState<Record<string, boolean>>({});

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

  async function handlePluginModeToggle(provider: DmsProvider, enabled: boolean) {
    setPluginModeLoading((m) => ({ ...m, [provider]: true }));
    try {
      const res = await fetch(`/api/integrations/${provider}/plugin-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Failed to update Plugin Mode");
      }
      setPluginModeMap((m) => ({ ...m, [provider]: enabled }));
      setToast({ type: "success", message: `Plugin Mode ${enabled ? "enabled" : "disabled"} for ${providerLabel(provider)}.` });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed" });
    } finally {
      setPluginModeLoading((m) => ({ ...m, [provider]: false }));
    }
  }

  async function handleSync(provider: DmsProvider) {
    const slugMap: Record<DmsProvider, string> = {
      cdk_fortellis:        "cdk",
      reynolds:             "reynolds",
      vinsolutions:         "vinsolutions",
      dealertrack:          "dealertrack",
      elead:                "elead",
      vauto:                "vauto",
      seven_hundred_credit: "700credit",
      general_crm:          "general-crm",
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
      cdk_fortellis:        "cdk",
      reynolds:             "reynolds",
      vinsolutions:         "vinsolutions",
      dealertrack:          "dealertrack",
      elead:                "elead",
      vauto:                "vauto",
      seven_hundred_credit: "700credit",
      general_crm:          "general-crm",
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
      cdk_fortellis:        "cdk",
      reynolds:             "reynolds",
      vinsolutions:         "vinsolutions",
      dealertrack:          "dealertrack",
      elead:                "elead",
      vauto:                "vauto",
      seven_hundred_credit: "700credit",
      general_crm:          "general-crm",
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

  const cdkConn      = getConnection("cdk_fortellis");
  const reynoldsConn = getConnection("reynolds");
  const vinConn      = getConnection("vinsolutions");
  const dtConn       = getConnection("dealertrack");
  const eleadConn    = getConnection("elead");
  const vautoConn    = getConnection("vauto");
  const creditConn   = getConnection("seven_hundred_credit");
  const crmConn      = getConnection("general_crm");

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
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">CRM Systems</h2>
        <p className="text-xs text-gray-400 mb-4">
          Enable <strong className="text-gray-600">Plugin Mode</strong> on any connected CRM to have AutoCDP automatically
          write campaign events (sends, QR scans, bookings) back as native activities —
          so your BDC team never has to leave their CRM.
        </p>
        <div className="space-y-4">

          {/* VinSolutions */}
          <div>
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
            {getStatus("vinsolutions") === "active" && (
              <PluginModePanel
                provider="vinsolutions"
                enabled={pluginModeMap["vinsolutions"] ?? false}
                loading={pluginModeLoading["vinsolutions"] ?? false}
                onToggle={(v) => handlePluginModeToggle("vinsolutions", v)}
                deadCount={(pluginModeMap["vinsolutions"] ?? false) ? (queueStats?.dead ?? 0) : 0}
              />
            )}
            {getStatus("vinsolutions") === "active" && vinConn?.metadata?.webhook_token && (
              <WebhookInfoPanel
                provider="vinsolutions"
                webhookToken={vinConn.metadata.webhook_token as string}
                webhookSecret={vinConn.metadata.webhook_secret as string}
                lastWebhookAt={vinConn.metadata.last_webhook_at as string | null}
                webhookEventCount={vinConn.metadata.webhook_event_count as number | undefined}
                appUrl={appUrl}
              />
            )}
          </div>

          {/* Dealertrack */}
          <div>
            <ConnectionCard
              provider="dealertrack"
              name="Dealertrack"
              description="OAuth 2.0 (Cox Automotive DT Connect) • Leads, Contacts, Activities"
              logo={<div className="w-8 h-8 flex items-center justify-center"><Database className="w-5 h-5 text-blue-500" /></div>}
              status={getStatus("dealertrack")}
              lastSyncAt={dtConn?.last_sync_at}
              lastError={dtConn?.last_error}
              syncCounts={latestCounts["dealertrack"] ?? null}
              onConnect={() => setOpenModal("dealertrack")}
              onSync={() => handleSync("dealertrack")}
              onDisconnect={() => handleDisconnect("dealertrack")}
              connectLabel="Connect Dealertrack"
            />
            {getStatus("dealertrack") === "active" && (
              <PluginModePanel
                provider="dealertrack"
                enabled={pluginModeMap["dealertrack"] ?? false}
                loading={pluginModeLoading["dealertrack"] ?? false}
                onToggle={(v) => handlePluginModeToggle("dealertrack", v)}
                deadCount={(pluginModeMap["dealertrack"] ?? false) ? (queueStats?.dead ?? 0) : 0}
              />
            )}
            {getStatus("dealertrack") === "active" && dtConn?.metadata?.webhook_token && (
              <WebhookInfoPanel
                provider="dealertrack"
                webhookToken={dtConn.metadata.webhook_token as string}
                webhookSecret={dtConn.metadata.webhook_secret as string}
                lastWebhookAt={dtConn.metadata.last_webhook_at as string | null}
                webhookEventCount={dtConn.metadata.webhook_event_count as number | undefined}
                appUrl={appUrl}
              />
            )}
          </div>

          {/* Elead */}
          <div>
            <ConnectionCard
              provider="elead"
              name="Elead CRM"
              description="API Key + Dealer ID • Leads, Contacts, Activities (CDK Global)"
              logo={<div className="w-8 h-8 flex items-center justify-center"><Database className="w-5 h-5 text-orange-500" /></div>}
              status={getStatus("elead")}
              lastSyncAt={eleadConn?.last_sync_at}
              lastError={eleadConn?.last_error}
              syncCounts={latestCounts["elead"] ?? null}
              onConnect={() => setOpenModal("elead")}
              onSync={() => handleSync("elead")}
              onDisconnect={() => handleDisconnect("elead")}
              connectLabel="Connect Elead"
            />
            {getStatus("elead") === "active" && (
              <PluginModePanel
                provider="elead"
                enabled={pluginModeMap["elead"] ?? false}
                loading={pluginModeLoading["elead"] ?? false}
                onToggle={(v) => handlePluginModeToggle("elead", v)}
                deadCount={(pluginModeMap["elead"] ?? false) ? (queueStats?.dead ?? 0) : 0}
              />
            )}
            {getStatus("elead") === "active" && eleadConn?.metadata?.webhook_token && (
              <WebhookInfoPanel
                provider="elead"
                webhookToken={eleadConn.metadata.webhook_token as string}
                webhookSecret={eleadConn.metadata.webhook_secret as string}
                lastWebhookAt={eleadConn.metadata.last_webhook_at as string | null}
                webhookEventCount={eleadConn.metadata.webhook_event_count as number | undefined}
                appUrl={appUrl}
              />
            )}
          </div>

          {/* Other CRMs — collapsible fallback */}
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1.5 py-1 select-none">
              <span className="group-open:rotate-90 transition-transform inline-block text-[10px]">▶</span>
              Other CRMs (DealerSocket, DriveCentric, generic API / CSV)
            </summary>
            <div className="mt-3 space-y-3 pl-1">
              <ConnectionCard
                provider="general_crm"
                name="General CRM"
                description="API Key or CSV upload • DealerSocket, DriveCentric, and any other CRM"
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
                Or upload a CRM leads CSV
              </button>
            </div>
          </details>
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
          { name: "apiKey",   label: "API Key",   placeholder: "vs_live_…", type: "password" },
          { name: "dealerId", label: "Dealer ID", placeholder: "DLR-12345" },
        ]}
        onClose={() => setOpenModal(null)}
        onConnect={(v) => handleConnect("vinsolutions", v)}
      />

      <ApiKeyModal
        open={openModal === "dealertrack"}
        title="Connect Dealertrack"
        description="Enter your Cox Automotive DT Connect OAuth credentials. Find these in the Dealertrack Partner Portal under API Integrations → OAuth Clients."
        fields={[
          { name: "clientId",     label: "Client ID",     placeholder: "dtc_client_…" },
          { name: "clientSecret", label: "Client Secret", placeholder: "dtc_secret_…", type: "password" },
        ]}
        onClose={() => setOpenModal(null)}
        onConnect={(v) => handleConnect("dealertrack", v)}
      />

      <ApiKeyModal
        open={openModal === "elead"}
        title="Connect Elead CRM"
        description="Enter your Elead API key and Dealer ID from the Elead admin portal under Settings → API Access."
        fields={[
          { name: "apiKey",   label: "API Key",   placeholder: "el_live_…", type: "password" },
          { name: "dealerId", label: "Dealer ID", placeholder: "DLR-12345" },
        ]}
        onClose={() => setOpenModal(null)}
        onConnect={(v) => handleConnect("elead", v)}
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
