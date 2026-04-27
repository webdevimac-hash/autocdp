import { getDailyUsage, WARN_FRACTION } from "@/lib/rate-limit";
import { AlertTriangle, Gauge } from "lucide-react";
import type { BillingEventType } from "@/types";

interface UsageBannerProps {
  dealershipId: string;
}

const LABELS: Partial<Record<BillingEventType, string>> = {
  mail_piece_sent: "Mail",
  agent_run:       "AI runs",
  sms_sent:        "SMS",
  email_sent:      "Email",
};

export async function UsageBanner({ dealershipId }: UsageBannerProps) {
  let usage;
  try {
    usage = await getDailyUsage(dealershipId);
  } catch {
    return null;
  }

  if (!usage.hasWarning) return null;

  type EventKey = "mail_piece_sent" | "agent_run" | "sms_sent" | "email_sent";
  const EVENT_KEYS: EventKey[] = ["mail_piece_sent", "agent_run", "sms_sent", "email_sent"];

  // Build per-resource warnings for resources at or near limit
  const warnings: Array<{ label: string; count: number; limit: number; pct: number; atLimit: boolean }> = [];
  for (const key of EVENT_KEYS) {
    const limit = usage.limits[key] ?? 0;
    if (!limit) continue;
    const count = usage[key];
    const pct = count / limit;
    if (pct >= WARN_FRACTION) {
      warnings.push({ label: LABELS[key] ?? key, count, limit, pct, atLimit: count >= limit });
    }
  }

  // Cost warning
  const effectiveCost = usage.totalCostCents > 0 ? usage.totalCostCents : usage.estimatedCostCents;
  if (usage.costWarning && usage.dailyCostLimitCents > 0) {
    const pct = effectiveCost / usage.dailyCostLimitCents;
    warnings.push({
      label: "Spend",
      count: Math.round(effectiveCost / 100),
      limit: Math.round(usage.dailyCostLimitCents / 100),
      pct,
      atLimit: effectiveCost >= usage.dailyCostLimitCents,
    });
  }

  if (warnings.length === 0) return null;

  const anyAtLimit = warnings.some((w) => w.atLimit);

  return (
    <div
      className={`px-5 py-2.5 border-b text-sm font-medium ${
        anyAtLimit
          ? "bg-red-600 border-red-700 text-white"
          : "bg-amber-50 border-amber-200 text-amber-900"
      }`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        {anyAtLimit ? (
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-100" />
        ) : (
          <Gauge className="w-4 h-4 shrink-0 text-amber-600" />
        )}

        <span className="font-semibold shrink-0">
          {anyAtLimit ? "Daily limit reached" : "Approaching daily limits"}
        </span>

        {/* Per-resource pills with mini progress bars */}
        <div className="flex items-center gap-2 flex-wrap">
          {warnings.map((w) => (
            <div
              key={w.label}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                anyAtLimit
                  ? "bg-red-500/40 text-red-50"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              <span>{w.label}:</span>
              {/* Inline progress bar */}
              <div
                className={`w-16 h-1.5 rounded-full overflow-hidden ${
                  anyAtLimit ? "bg-red-800/40" : "bg-amber-200"
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    w.atLimit
                      ? "bg-white/90"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.round(w.pct * 100))}%` }}
                />
              </div>
              <span>
                {w.label === "Spend"
                  ? `$${w.count}/$${w.limit}`
                  : `${w.count}/${w.limit}`}
              </span>
            </div>
          ))}
        </div>

        <span className={`text-xs ml-auto shrink-0 ${anyAtLimit ? "text-red-200" : "text-amber-600"}`}>
          {anyAtLimit ? "New sends paused until midnight UTC." : "Resets midnight UTC."}
        </span>

        <a
          href="/dashboard/settings#limits"
          className={`text-xs underline underline-offset-2 shrink-0 ${
            anyAtLimit ? "text-red-100 hover:text-white" : "text-amber-700 hover:text-amber-900"
          }`}
        >
          Adjust limits
        </a>
      </div>
    </div>
  );
}
