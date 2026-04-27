"use client";

import { AlertCircle, RefreshCw, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRecoveryAction } from "@/lib/errors";

interface ErrorAlertProps {
  /** User-visible error message */
  message: string;
  /** Error code from API response — drives recovery action */
  code?: string;
  /** If provided, a "Try again" button is shown */
  onRetry?: () => void;
  /** If provided, an × dismiss button is shown */
  onDismiss?: () => void;
  /** "inline" (default) is compact; "banner" is full-width */
  variant?: "inline" | "banner";
  className?: string;
}

export function ErrorAlert({
  message,
  code,
  onRetry,
  onDismiss,
  variant = "inline",
  className,
}: ErrorAlertProps) {
  const recovery = code ? getRecoveryAction(code) : null;

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-200 rounded-[var(--radius)] text-sm",
          className
        )}
        role="alert"
      >
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        <p className="flex-1 text-red-800">{message}</p>
        <div className="flex items-center gap-2 shrink-0">
          {recovery && (
            <a
              href={recovery.href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 underline underline-offset-2"
            >
              {recovery.label} <ArrowRight className="w-3 h-3" />
            </a>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-red-400 hover:text-red-600 ml-1"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // inline variant
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-[var(--radius)]",
        className
      )}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-red-800 leading-snug">{message}</p>
        {(recovery || onRetry) && (
          <div className="flex items-center gap-3 mt-2">
            {recovery && (
              <a
                href={recovery.href}
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900"
              >
                {recovery.label} <ArrowRight className="w-3 h-3" />
              </a>
            )}
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800"
              >
                <RefreshCw className="w-3 h-3" /> Try again
              </button>
            )}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-300 hover:text-red-500 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
