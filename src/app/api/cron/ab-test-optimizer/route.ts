/**
 * POST /api/cron/ab-test-optimizer
 *
 * Daily cron job — evaluates all active A/B tests across ALL dealerships.
 * Secured by CRON_SECRET header.
 *
 * Schedule: 0 6 * * *  (6 AM UTC daily, after overnight ad data syncs)
 *
 * For each active test:
 *   1. Sync KPIs from ads_performance
 *   2. Run statistical evaluation (z-test)
 *   3. If winner is significant → pause losers, scale budget, save pattern
 */

import { NextRequest, NextResponse } from "next/server";
import { runAbTestOptimizer } from "@/lib/ads/ab-test-engine";

export const dynamic    = "force-dynamic";
export const maxDuration = 300; // 5 min — may optimize many tests

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const started = Date.now();
    const result  = await runAbTestOptimizer(); // all dealerships

    return NextResponse.json({
      ...result,
      durationMs: Date.now() - started,
      runAt:      new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/ab-test-optimizer]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
