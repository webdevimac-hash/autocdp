"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectionCard, type ConnectionStatus } from "@/components/integrations/connection-card";
import { Database, RefreshCw, AlertCircle, CheckCircle2, Info } from "lucide-react";

interface DmsConnection {
  id: string;
  provider: string;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown> | null;
}

interface Props {
  connections: DmsConnection[];
  latestCounts: Record<string, { customers: number; visits: number; inventory: number }>;
  successParam?: string;
  errorParam?: string;
}

// Reynolds connect modal
function ReynoldsModal({
  open,
  onClose,
  onConnect,
}: {
  open: boolean;
  onClose: () => void;
  onConnect: (apiKey: string) => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      await onConnect(apiKey.trim());
      setApiKey("");
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Connect Reynolds & Reynolds</h2>
        <p className="text-sm text-gray-500 mb-5">
          Enter your Reynolds DealerLink API key from the ERA-IGNITE portal.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DealerLink API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="rr_live_…"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
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
              disabled={loading || !apiKey}
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

export function IntegrationsClient({ connections, latestCounts, successParam, errorParam }: Props) {
  const router = useRouter();
  const [reynoldsModalOpen, setReynoldsModalOpen] = useState(false);
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

  async function handleSync(provider: "cdk_fortellis" | "reynolds") {
    const res = await fetch(`/api/integrations/${provider === "cdk_fortellis" ? "cdk" : "reynolds"}/sync`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Sync failed");
    }
    setToast({ type: "success", message: `${provider === "cdk_fortellis" ? "CDK" : "Reynolds"} sync triggered.` });
    setTimeout(() => router.refresh(), 1500);
  }

  async function handleReynoldsConnect(apiKey: string) {
    const res = await fetch("/api/integrations/reynolds/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Connection failed");
    }
    setToast({ type: "success", message: "Reynolds connected! Initial sync is running in the background." });
    setTimeout(() => router.refresh(), 1000);
  }

  async function handleDisconnect(provider: "cdk_fortellis" | "reynolds") {
    const slug = provider === "cdk_fortellis" ? "cdk" : "reynolds";
    const res = await fetch(`/api/integrations/${slug}/sync`, { method: "DELETE" });
    if (res.ok) {
      setToast({ type: "success", message: "Integration disconnected." });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? `Disconnect failed (${res.status})`);
    }
  }

  const cdkConn = getConnection("cdk_fortellis");
  const reynoldsConn = getConnection("reynolds");

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
          Connect your Dealer Management System for automatic real-time data sync.
          Customer records, service ROs, inventory, and deal data flow in automatically.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          After connecting, AutoCDP runs an initial full sync and then delta syncs every 30–60 minutes.
          The AI swarm re-analyzes your data after each sync so campaigns stay fresh.
        </p>
      </div>

      {/* Provider cards */}
      <div className="space-y-4">
        {/* CDK Fortellis */}
        <ConnectionCard
          provider="cdk_fortellis"
          name="CDK Fortellis"
          description="OAuth 2.0 • Customers, Service ROs, Inventory, F&I Deals"
          logo={
            <div className="w-8 h-8 flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
          }
          status={getStatus("cdk_fortellis")}
          lastSyncAt={cdkConn?.last_sync_at}
          lastError={cdkConn?.last_error}
          syncCounts={latestCounts["cdk_fortellis"] ?? null}
          onConnect={() => { window.location.href = "/api/integrations/cdk/connect"; }}
          onSync={() => handleSync("cdk_fortellis")}
          onDisconnect={() => handleDisconnect("cdk_fortellis")}
          connectLabel="Connect with CDK Fortellis"
        />

        {/* Reynolds */}
        <ConnectionCard
          provider="reynolds"
          name="Reynolds & Reynolds"
          description="API Key • ERA-IGNITE DealerLink • Customers, Service ROs, Inventory, Sales"
          logo={
            <div className="w-8 h-8 flex items-center justify-center">
              <Database className="w-5 h-5 text-orange-500" />
            </div>
          }
          status={getStatus("reynolds")}
          lastSyncAt={reynoldsConn?.last_sync_at}
          lastError={reynoldsConn?.last_error}
          syncCounts={latestCounts["reynolds"] ?? null}
          onConnect={() => setReynoldsModalOpen(true)}
          onSync={() => handleSync("reynolds")}
          onDisconnect={() => handleDisconnect("reynolds")}
          connectLabel="Connect Reynolds"
        />
      </div>

      {/* Sync history */}
      {connections.some((c) => c.status === "active") && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Syncs</h2>
          <SyncHistory />
        </div>
      )}

      <ReynoldsModal
        open={reynoldsModalOpen}
        onClose={() => setReynoldsModalOpen(false)}
        onConnect={handleReynoldsConnect}
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
                  {job.provider === "cdk_fortellis" ? "CDK Fortellis" : "Reynolds"}
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
