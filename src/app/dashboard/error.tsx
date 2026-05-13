"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center ring-1 ring-rose-100">
          <AlertTriangle className="w-7 h-7 text-rose-500" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-slate-900">Something went wrong</h2>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
            The dashboard hit an unexpected error. This is usually a temporary issue — try refreshing.
          </p>
          {error.digest && (
            <p className="mt-2 text-[11px] font-mono text-slate-400">Digest: {error.digest}</p>
          )}
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
