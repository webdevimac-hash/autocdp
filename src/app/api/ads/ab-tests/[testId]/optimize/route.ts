/**
 * POST /api/ads/ab-tests/[testId]/optimize
 *
 * Manually triggers the A/B test optimizer for a single test.
 * Same logic as the daily cron but scoped to one test.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { optimizeTest } from "@/lib/ads/ab-test-engine";

export const dynamic    = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    // Verify ownership
    const svc = createServiceClient();
    const { data: test } = await (svc as ReturnType<typeof createServiceClient>)
      .from("paid_ab_tests" as never)
      .select("id" as never)
      .eq("id" as never, testId as never)
      .eq("dealership_id" as never, dealershipId as never)
      .single() as unknown as { data: { id: string } | null };

    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    const result = await optimizeTest(testId);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/ads/ab-tests/[testId]/optimize]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
