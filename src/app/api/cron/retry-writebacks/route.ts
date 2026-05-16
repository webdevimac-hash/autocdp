/**
 * GET /api/cron/retry-writebacks
 *
 * Cron worker that processes the CRM write-back retry queue.
 * Should be called every 5 minutes via Vercel Cron (vercel.json) or an
 * external scheduler.
 *
 * Protection: requires the CRON_SECRET environment variable to match the
 * Authorization: Bearer <secret> header (standard Vercel cron pattern).
 *
 * Processes up to 20 pending rows per invocation, stopping early if the
 * total runtime approaches 25 s (safe for Vercel serverless limit).
 */

import { NextRequest, NextResponse } from "next/server";
import { claimPendingWritebacks } from "@/lib/dms/writeback-queue";
import { processQueueRow } from "@/lib/dms/crm-writeback";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // seconds — increase if on Pro plan

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Authenticate
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    const cronHeader = req.headers.get("x-vercel-cron-secret") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : cronHeader;
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const DEADLINE_MS = 22_000; // stop claiming new rows after 22 s

  // Claim pending rows
  const rows = await claimPendingWritebacks(20);

  if (rows.length === 0) {
    return NextResponse.json({ processed: 0, skipped: 0, message: "Queue empty" });
  }

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (Date.now() - startedAt > DEADLINE_MS) {
      // Return remaining rows to pending state
      skipped++;
      continue;
    }

    try {
      await processQueueRow(row);
      succeeded++;
    } catch {
      // processQueueRow handles its own error persistence — this catch is a
      // safety net in case of an unexpected throw
      failed++;
    }
  }

  console.log(
    `[retry-writebacks] processed=${rows.length} succeeded=${succeeded} failed=${failed} skipped=${skipped} elapsed=${Date.now() - startedAt}ms`
  );

  return NextResponse.json({
    processed: rows.length,
    succeeded,
    failed,
    skipped,
    elapsedMs: Date.now() - startedAt,
  });
}
