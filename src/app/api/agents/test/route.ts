import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runOrchestrator } from "@/lib/anthropic/agents/orchestrator";
import { checkRateLimit } from "@/lib/rate-limit";
import { toApiError } from "@/lib/errors";
import { getActiveDealershipId } from "@/lib/dealership";
import type { CampaignChannel } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) {
      return NextResponse.json({ error: "No dealership found for this user", code: "NO_DEALERSHIP" }, { status: 400 });
    }

    // Rate limit: agent runs
    const limit = await checkRateLimit(dealershipId, "agent_run", 1);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "You've reached your daily AI agent limit. Limits reset at midnight UTC.",
          code: "DAILY_LIMIT_EXCEEDED",
          limit: limit.limit,
          count: limit.count,
        },
        { status: 429 }
      );
    }

    const { data: dealership } = await supabase
      .from("dealerships")
      .select("name")
      .eq("id", dealershipId)
      .single() as { data: { name: string } | null };

    const body = await req.json();
    const { goal, channel = "direct_mail", maxCustomers = 3 } = body;

    if (!goal?.trim()) {
      return NextResponse.json({ error: "Campaign goal is required", code: "VALIDATION_ERROR" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI service is not configured. Add your ANTHROPIC_API_KEY to environment settings.", code: "AI_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const result = await runOrchestrator({
      context: {
        dealershipId,
        dealershipName: dealership?.name ?? "Your Dealership",
      },
      campaignGoal: goal,
      channel: channel as CampaignChannel,
      maxCustomers: Math.min(Number(maxCustomers), 5),
    });

    return NextResponse.json({
      ...result,
      _rateLimit: { count: limit.count + 1, limit: limit.limit, nearLimit: limit.nearLimit },
    });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}
