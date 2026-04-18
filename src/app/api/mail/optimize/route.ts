import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runOptimizationAgent } from "@/lib/anthropic/agents/optimization-agent";

/**
 * POST /api/mail/optimize
 *
 * Manually triggers the Optimization Agent for a set of mail pieces or the
 * dealer's recent history. Used by the "Learn from Campaign" button.
 *
 * Body:
 *   mailPieceIds?  string[]  — specific piece UUIDs to analyze (omit = last lookbackDays)
 *   lookbackDays?  number    — how far back to look when mailPieceIds not set (default 30)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.json({ error: "No dealership found" }, { status: 400 });
    }

    const { data: dealership } = await supabase
      .from("dealerships")
      .select("name")
      .eq("id", ud.dealership_id)
      .single() as { data: Record<string, string | null> | null };

    const body = await req.json().catch(() => ({}));
    const { mailPieceIds, lookbackDays } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const result = await runOptimizationAgent({
      context: {
        dealershipId: ud.dealership_id,
        dealershipName: dealership?.name ?? "Your Dealership",
      },
      mailPieceIds: Array.isArray(mailPieceIds) ? mailPieceIds : undefined,
      lookbackDays: typeof lookbackDays === "number" ? lookbackDays : 30,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/mail/optimize]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
