/**
 * GET /api/ai/triggers
 *
 * Scans the dealership's customer/inventory data for high-potential
 * campaign opportunities. Rule-based — no LLM call, instant response.
 *
 * Returns TriggerOpportunity[] sorted by urgency (high → medium → low).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { runTriggerWatcher } from "@/lib/anthropic/agents/trigger-watcher";

export async function GET() {
  try {
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

    const output = await runTriggerWatcher(
      {
        dealershipId,
        dealershipName: dealership?.name ?? "Your Dealership",
      },
      { maxOpportunities: 5 }
    );

    return NextResponse.json(output);
  } catch (error) {
    console.error("[/api/ai/triggers]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
