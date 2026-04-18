import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runOrchestrator } from "@/lib/anthropic/agents/orchestrator";
import type { CampaignChannel } from "@/types";

// POST /api/agents/test
// Runs the full 5-agent orchestrator pipeline and returns a preview.
// Authenticated route — dealership_id derived from session.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.json({ error: "No dealership found for this user" }, { status: 400 });
    }

    const { data: dealership } = await supabase
      .from("dealerships")
      .select("name")
      .eq("id", ud.dealership_id)
      .single() as { data: { name: string } | null };

    const body = await req.json();
    const { goal, channel = "direct_mail", maxCustomers = 3 } = body;

    if (!goal?.trim()) {
      return NextResponse.json({ error: "Campaign goal is required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured. Add it to your .env.local file." },
        { status: 503 }
      );
    }

    const result = await runOrchestrator({
      context: {
        dealershipId: ud.dealership_id,
        dealershipName: dealership?.name ?? "Your Dealership",
      },
      campaignGoal: goal,
      channel: channel as CampaignChannel,
      maxCustomers: Math.min(Number(maxCustomers), 5), // cap at 5 during testing
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/agents/test]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
