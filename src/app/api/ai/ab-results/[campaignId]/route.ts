/**
 * POST /api/ai/ab-results/[campaignId]
 *
 * Runs A/B test analysis for the given campaign:
 *   1. Groups mail_pieces by ab_variant
 *   2. Computes scan rates per variant
 *   3. Declares winner + lift %
 *   4. Extracts learnable pattern → writes to global_learnings
 *
 * Body (optional):
 *   variantALabel  string   (e.g. "Control — Standard Offer")
 *   variantBLabel  string   (e.g. "Test — Urgency Headline")
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { runABTestAnalysis } from "@/lib/anthropic/agents/ab-test-agent";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) {
      return NextResponse.json({ error: "No dealership found" }, { status: 400 });
    }

    const { data: dealership } = await supabase
      .from("dealerships")
      .select("name")
      .eq("id", dealershipId)
      .single() as { data: { name: string } | null };

    const body = await req.json().catch(() => ({}));
    const { variantALabel, variantBLabel } = body as {
      variantALabel?: string;
      variantBLabel?: string;
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
    }

    const result = await runABTestAnalysis({
      context: {
        dealershipId,
        dealershipName: dealership?.name ?? "Your Dealership",
      },
      campaignId,
      variantALabel,
      variantBLabel,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/ai/ab-results]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
