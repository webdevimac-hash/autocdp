/**
 * POST /api/cron/conquest-sync
 *
 * Daily cron — runs for ALL dealerships with active conquest leads:
 *   1. Credit enrichment  — up to 200 un-enriched leads via 700Credit
 *   2. Batch score        — refresh scores for all leads
 *   3. Audience refresh   — rebuild all "ready" audiences
 *   4. CRM target import  — find lapsed CRM customers → conquest leads
 *
 * Secured by CRON_SECRET header.
 * Recommended schedule: 0 3 * * *  (3 AM UTC — low traffic)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  batchScoreLeads,
  enrichCreditTiers,
  buildAudience,
  findCrmConquestTargets,
} from "@/lib/conquest/engine";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

interface DealershipResult {
  dealershipId:   string;
  enriched:       number;
  scored:         number;
  audiencesBuilt: number;
  crmImported:    number;
  errors:         string[];
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const svc = createServiceClient();

  // Find all dealerships that have conquest leads
  const { data: dealerships } = await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_leads" as never)
    .select("dealership_id" as never)
    .limit(1000) as unknown as { data: Array<{ dealership_id: string }> | null };

  // Deduplicate
  const uniqueIds = [...new Set((dealerships ?? []).map((d) => d.dealership_id))];

  const results: DealershipResult[] = [];

  for (const dealershipId of uniqueIds) {
    const result: DealershipResult = {
      dealershipId,
      enriched:       0,
      scored:         0,
      audiencesBuilt: 0,
      crmImported:    0,
      errors:         [],
    };

    // ── 1. Credit enrichment ──────────────────────────────────────────────
    try {
      const { enriched } = await enrichCreditTiers(dealershipId, 200);
      result.enriched = enriched;
    } catch (e) {
      result.errors.push(`enrich: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 2. Batch score ────────────────────────────────────────────────────
    try {
      const { updated } = await batchScoreLeads(dealershipId, 5000);
      result.scored = updated;
    } catch (e) {
      result.errors.push(`score: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 3. Rebuild audiences ──────────────────────────────────────────────
    try {
      const { data: audiences } = await (svc as ReturnType<typeof createServiceClient>)
        .from("conquest_audiences" as never)
        .select("id" as never)
        .eq("dealership_id" as never, dealershipId as never)
        .in("status" as never, ["ready", "draft"] as never)
        .limit(20) as unknown as { data: Array<{ id: string }> | null };

      for (const aud of audiences ?? []) {
        try {
          await buildAudience(dealershipId, aud.id);
          result.audiencesBuilt++;
        } catch (e) {
          result.errors.push(`audience ${aud.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      result.errors.push(`audiences: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 4. CRM target import ──────────────────────────────────────────────
    try {
      const { imported } = await findCrmConquestTargets(dealershipId, 180);
      result.crmImported = imported;
    } catch (e) {
      result.errors.push(`crm-import: ${e instanceof Error ? e.message : String(e)}`);
    }

    results.push(result);
  }

  const totalEnriched       = results.reduce((s, r) => s + r.enriched, 0);
  const totalScored         = results.reduce((s, r) => s + r.scored, 0);
  const totalAudiences      = results.reduce((s, r) => s + r.audiencesBuilt, 0);
  const totalCrmImported    = results.reduce((s, r) => s + r.crmImported, 0);
  const dealershipsWithErrors = results.filter((r) => r.errors.length > 0).length;

  return NextResponse.json({
    processed:           uniqueIds.length,
    totalEnriched,
    totalScored,
    totalAudiences,
    totalCrmImported,
    dealershipsWithErrors,
    durationMs:          Date.now() - started,
    runAt:               new Date().toISOString(),
    results,
  });
}
