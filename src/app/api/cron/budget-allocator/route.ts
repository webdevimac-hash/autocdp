/**
 * POST /api/cron/budget-allocator
 *
 * Daily cron — runs the AI Budget Allocator for every dealership that has:
 *   1. Active ad platform connections (google_ads, meta_ads, or tiktok_ads)
 *   2. A configured budget_rules row with auto_push = true (or any rules row)
 *   3. Performance data in ads_performance within the last 30 days
 *
 * Also runs next-day attribution for yesterday's allocations.
 *
 * Secured by CRON_SECRET header.
 * Recommended schedule: 0 6 * * *  (6 AM UTC — before campaigns start spending)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runBudgetAllocator, runBudgetAttribution } from "@/lib/ads/budget-allocator";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

interface DealershipResult {
  dealershipId:   string;
  dealershipName: string;
  action:         "allocated" | "attribution_only" | "skipped" | "error";
  pushed:         number;
  skipped:        number;
  errors:         number;
  summary?:       string;
  error?:         string;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const svc = createServiceClient();

  // Find all dealerships with active ad connections
  const { data: connections } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .select("dealership_id,provider,metadata" as never)
    .in("provider" as never, ["google_ads", "meta_ads", "tiktok_ads"] as never)
    .eq("status" as never, "active" as never) as unknown as {
      data: Array<{ dealership_id: string; provider: string; metadata: Record<string, unknown> }> | null;
    };

  // Deduplicate dealerships + load their names
  const dealershipIds = [...new Set((connections ?? []).map((c) => c.dealership_id))];

  const { data: dealers } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dealerships" as never)
    .select("id,name" as never)
    .in("id" as never, dealershipIds as never) as unknown as {
      data: Array<{ id: string; name: string }> | null;
    };

  const dealerMap = new Map((dealers ?? []).map((d) => [d.id, d.name]));

  // Load budget_rules for all these dealerships
  const { data: allRules } = await (svc as ReturnType<typeof createServiceClient>)
    .from("budget_rules" as never)
    .select("dealership_id,monthly_cap_usd,channel_limits,auto_push" as never)
    .in("dealership_id" as never, dealershipIds as never) as unknown as {
      data: Array<{
        dealership_id:  string;
        monthly_cap_usd: number | null;
        channel_limits: Record<string, { min: number; max: number }>;
        auto_push: boolean;
      }> | null;
    };

  const rulesMap = new Map((allRules ?? []).map((r) => [r.dealership_id, r]));

  const results: DealershipResult[] = [];

  for (const dealershipId of dealershipIds) {
    const dealershipName = dealerMap.get(dealershipId) ?? dealershipId;
    const rules = rulesMap.get(dealershipId);

    const result: DealershipResult = {
      dealershipId,
      dealershipName,
      action:  "skipped",
      pushed:  0,
      skipped: 0,
      errors:  0,
    };

    try {
      // Always run attribution for yesterday first (fast, non-blocking)
      await runBudgetAttribution(dealershipId);

      // Skip allocation if no rules configured
      if (!rules) {
        result.action = "attribution_only";
        result.summary = "No budget_rules row — skipping allocation. Configure rules to enable.";
        results.push(result);
        continue;
      }

      // Compute total daily budget from channel limits
      const limits = rules.channel_limits ?? {};
      const totalBudgetUsd = Object.values(limits).reduce(
        (sum: number, lim: { min: number; max: number }) => sum + (lim.max ?? 0),
        0
      );

      if (totalBudgetUsd <= 0) {
        result.action = "skipped";
        result.summary = "channel_limits.max values sum to $0 — skipping.";
        results.push(result);
        continue;
      }

      // Cap at monthly_cap / 30 if set
      const dailyCap = rules.monthly_cap_usd ? rules.monthly_cap_usd / 30 : Infinity;
      const effectiveBudget = Math.min(totalBudgetUsd, dailyCap);

      const allocResult = await runBudgetAllocator(
        dealershipId,
        effectiveBudget,
        dealershipName
      );

      result.action  = "allocated";
      result.pushed  = allocResult.pushed;
      result.skipped = allocResult.skipped;
      result.errors  = allocResult.errors;
      result.summary = allocResult.summary ?? undefined;
    } catch (e) {
      result.action = "error";
      result.error  = e instanceof Error ? e.message : String(e);
      console.error(`[cron/budget-allocator] ${dealershipId}:`, result.error);
    }

    results.push(result);
  }

  const allocated   = results.filter((r) => r.action === "allocated").length;
  const errors      = results.filter((r) => r.action === "error").length;
  const totalPushed = results.reduce((s, r) => s + r.pushed, 0);

  return NextResponse.json({
    processed:    results.length,
    allocated,
    errors,
    totalPushed,
    durationMs:   Date.now() - started,
    runAt:        new Date().toISOString(),
    results,
  });
}
