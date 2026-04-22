"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, RefreshCw, Link2, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConnectionStatus = "not_connected" | "pending" | "active" | "error" | "disconnected";

interface ConnectionCardProps {
  provider: "cdk_fortellis" | "reynolds" | "vinsolutions" | "vauto" | "seven_hundred_credit" | "general_crm";
  name: string;
  description: string;
  logo: React.ReactNode;
  status: ConnectionStatus;
  lastSyncAt?: string | null;
  lastError?: string | null;
  syncCounts?: { customers?: number; visits?: number; inventory?: number } | null;
  onConnect: () => void;
  onSync: () => Promise<void>;
  onDisconnect?: () => Promise<void>;
  connectLabel?: string;
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  not_connected: { label: "Not connected", color: "text-gray-400", icon: Link2 },
  pending:       { label: "Connecting…",   color: "text-yellow-500", icon: Clock },
  active:        { label: "Connected",     color: "text-green-500",  icon: CheckCircle2 },
  error:         { label: "Error",         color: "text-red-500",    icon: XCircle },
  disconnected:  { label: "Disconnected",  color: "text-gray-400",   icon: Unlink },
};

export function ConnectionCard({
  name,
  description,
  logo,
  status,
  lastSyncAt,
  lastError,
  syncCounts,
  onConnect,
  onSync,
  onDisconnect,
  connectLabel = "Connect",
}: ConnectionCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;

  async function handleSync() {
    setSyncing(true);
    try { await onSync(); } finally { setSyncing(false); }
  }

  async function handleDisconnect() {
    if (!onDisconnect) return;
    setDisconnecting(true);
    try { await onDisconnect(); } finally { setDisconnecting(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-5 border-b border-gray-100">
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 shrink-0">
          {logo}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{name}</h3>
          <p className="text-sm text-gray-500 truncate">{description}</p>
        </div>
        <div className={cn("flex items-center gap-1.5 text-sm font-medium shrink-0", cfg.color)}>
          <StatusIcon className="w-4 h-4" />
          {cfg.label}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Sync stats */}
        {status === "active" && syncCounts && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Customers", value: syncCounts.customers ?? 0 },
              { label: "Visits",    value: syncCounts.visits ?? 0 },
              { label: "Inventory", value: syncCounts.inventory ?? 0 },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{s.value.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Last sync */}
        {lastSyncAt && (
          <p className="text-xs text-gray-400">
            Last sync:{" "}
            {new Date(lastSyncAt).toLocaleString("en-US", {
              month: "short", day: "numeric",
              hour: "numeric", minute: "2-digit",
            })}
          </p>
        )}

        {/* Error message */}
        {lastError && status === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-600">{lastError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {status !== "active" ? (
            <button
              onClick={onConnect}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <Link2 className="w-4 h-4" />
              {connectLabel}
            </button>
          ) : (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                {syncing ? "Syncing…" : "Sync Now"}
              </button>
              {onDisconnect && (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <Unlink className="w-4 h-4" />
                  {disconnecting ? "…" : "Disconnect"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
