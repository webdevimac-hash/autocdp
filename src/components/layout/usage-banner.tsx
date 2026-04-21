import { getDailyUsage, DAILY_LIMITS } from "@/lib/rate-limit";
import { AlertTriangle, X } from "lucide-react";

interface UsageBannerProps {
  dealershipId: string;
}

export async function UsageBanner({ dealershipId }: UsageBannerProps) {
  let usage;
  try {
    usage = await getDailyUsage(dealershipId);
  } catch {
    return null;
  }

  if (!usage.hasWarning) return null;

  // Build a human-readable warning for the most-consumed resource
  const warnings: string[] = [];

  if (DAILY_LIMITS.mail_piece_sent && usage.mail_piece_sent >= DAILY_LIMITS.mail_piece_sent * 0.8) {
    const pct = Math.round((usage.mail_piece_sent / DAILY_LIMITS.mail_piece_sent) * 100);
    warnings.push(`${pct}% of daily mail limit used (${usage.mail_piece_sent}/${DAILY_LIMITS.mail_piece_sent} pieces)`);
  }
  if (DAILY_LIMITS.agent_run && usage.agent_run >= DAILY_LIMITS.agent_run * 0.8) {
    const pct = Math.round((usage.agent_run / DAILY_LIMITS.agent_run) * 100);
    warnings.push(`${pct}% of daily AI runs used (${usage.agent_run}/${DAILY_LIMITS.agent_run} runs)`);
  }
  if (DAILY_LIMITS.sms_sent && usage.sms_sent >= DAILY_LIMITS.sms_sent * 0.8) {
    const pct = Math.round((usage.sms_sent / DAILY_LIMITS.sms_sent) * 100);
    warnings.push(`${pct}% of daily SMS limit used`);
  }

  if (warnings.length === 0) return null;

  const isAtLimit = (
    (DAILY_LIMITS.mail_piece_sent && usage.mail_piece_sent >= DAILY_LIMITS.mail_piece_sent) ||
    (DAILY_LIMITS.agent_run && usage.agent_run >= DAILY_LIMITS.agent_run)
  );

  return (
    <div
      className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${
        isAtLimit
          ? "bg-red-600 text-white"
          : "bg-amber-50 border-b border-amber-200 text-amber-800"
      }`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        {isAtLimit ? "Daily limit reached — " : "Approaching daily limit — "}
        {warnings.join(" · ")}
        {isAtLimit
          ? ". New sends are paused until midnight UTC."
          : ". Limits reset at midnight UTC."}
      </span>
      <a
        href="/dashboard/billing"
        className={`text-xs underline underline-offset-2 shrink-0 ${
          isAtLimit ? "text-red-100 hover:text-white" : "text-amber-700 hover:text-amber-900"
        }`}
      >
        View limits
      </a>
    </div>
  );
}
