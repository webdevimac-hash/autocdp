/**
 * POST /api/conquest/score
 *
 * Triggers batch scoring for the authenticated dealership's conquest leads.
 * Optionally also triggers credit enrichment first.
 *
 * Body: { enrich?: boolean; limit?: number }
 *   enrich — if true, run credit enrichment before scoring (slower, costs credits)
 *   limit  — max leads to process (default 2000)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { batchScoreLeads, enrichCreditTiers } from "@/lib/conquest/engine";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: { dealership_id: string } | null };
  const dealershipId = ud?.dealership_id;
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  let body: { enrich?: boolean; limit?: number } = {};
  try { body = await req.json(); } catch { /* defaults */ }

  const limit = Math.min(body.limit ?? 2000, 5000);
  const results: Record<string, unknown> = {};

  // Optional credit enrichment pass first
  if (body.enrich) {
    try {
      const enrichResult = await enrichCreditTiers(dealershipId, Math.min(limit, 200));
      results.enrichment = enrichResult;
    } catch (e) {
      results.enrichmentError = e instanceof Error ? e.message : String(e);
    }
  }

  // Score
  try {
    const scoreResult = await batchScoreLeads(dealershipId, limit);
    results.scoring = scoreResult;
  } catch (e) {
    results.scoringError = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Scoring failed", ...results }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dealershipId, ...results });
}
