import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runOmnichannelOrchestrator } from "@/lib/anthropic/agents/orchestrator";
import type { OmnichannelChannel } from "@/lib/anthropic/agents/orchestrator";

/**
 * POST /api/campaign/omnichannel
 *
 * Body:
 *   campaignGoal  string
 *   channels      OmnichannelChannel[]   e.g. ["sms","email"] or ["multi_channel"]
 *   customerIds   string[]
 *   templateType? string
 *   dryRun?       boolean (default true)
 *   dealershipTone? string
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single();

    if (!ud?.dealership_id) {
      return NextResponse.json({ error: "No dealership found" }, { status: 400 });
    }

    const { data: dealership } = await supabase
      .from("dealerships")
      .select("name")
      .eq("id", ud.dealership_id)
      .single();

    const body = await req.json().catch(() => ({}));
    const { campaignGoal, channels, customerIds, templateType, dryRun, dealershipTone } = body;

    if (!campaignGoal || !channels?.length || !customerIds?.length) {
      return NextResponse.json({ error: "campaignGoal, channels, and customerIds are required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
    }

    const result = await runOmnichannelOrchestrator({
      context: {
        dealershipId: ud.dealership_id,
        dealershipName: dealership?.name ?? "Your Dealership",
      },
      campaignGoal,
      channels: channels as OmnichannelChannel[],
      customerIds,
      templateType,
      dealershipTone,
      dryRun: dryRun ?? true,
      createdBy: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/campaign/omnichannel]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
