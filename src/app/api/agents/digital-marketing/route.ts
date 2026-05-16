/**
 * POST /api/agents/digital-marketing
 *
 * Triggers the Digital Marketing Agent (#6) for a dealership.
 *
 * Body: {
 *   mode?:              "analyze" | "execute" | "full_cycle"  (default: "analyze")
 *   dealerGoal?:        string
 *   allowExecute?:      boolean  (default: false — must be explicitly opted-in)
 *   approvedActionIds?: string[]  (dm_approvals IDs the dealer has approved)
 *   lookbackDays?:      number   (default: 30)
 *   enabledPlatforms?:  string[] (subset of ["google_ads","meta_ads","tiktok_ads"])
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { runDigitalMarketingAgent } from "@/lib/anthropic/agents/digital-marketing-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 120;  // 2 min — opus can take a while

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  if (!ud?.dealership_id) {
    return NextResponse.json({ error: "No dealership found" }, { status: 404 });
  }

  const dealershipId = ud.dealership_id;

  // Rate limit: 5 digital marketing agent runs per day per dealership
  const limit = await checkRateLimit(dealershipId, "agent_run", 1);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Daily agent run limit reached. Resets at midnight UTC.", code: "DAILY_LIMIT_EXCEEDED" },
      { status: 429 }
    );
  }

  const { data: dealership } = await svc
    .from("dealerships")
    .select("name")
    .eq("id", dealershipId)
    .single() as { data: { name: string } | null };

  const body = await req.json().catch(() => ({})) as {
    mode?:               "analyze" | "execute" | "full_cycle";
    dealerGoal?:         string;
    allowExecute?:       boolean;
    approvedActionIds?:  string[];
    lookbackDays?:       number;
    enabledPlatforms?:   string[];
  };

  try {
    const result = await runDigitalMarketingAgent({
      context: {
        dealershipId,
        dealershipName: dealership?.name ?? "Unknown Dealership",
        campaignId:     undefined,
      },
      mode:               body.mode ?? "analyze",
      dealerGoal:         body.dealerGoal,
      allowExecute:       body.allowExecute ?? false,
      approvedActionIds:  body.approvedActionIds ?? [],
      lookbackDays:       body.lookbackDays ?? 30,
      enabledPlatforms:   body.enabledPlatforms as Array<"google_ads" | "meta_ads" | "tiktok_ads"> | undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent run failed" },
      { status: 500 }
    );
  }
}

// GET — returns current playbook + recent agent runs for this dealership
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  if (!ud?.dealership_id) {
    return NextResponse.json({ error: "No dealership found" }, { status: 404 });
  }

  const dealershipId = ud.dealership_id;

  const [playbookRes, runsRes, approvalsRes, campaignsRes, patternsRes] = await Promise.all([
    svc
      .from("dm_playbook" as never)
      .select("id,version,content,updated_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("is_current" as never, true as never)
      .maybeSingle() as unknown as Promise<{ data: unknown }>,
    svc
      .from("agent_runs" as never)
      .select("id,status,input_summary,output_summary,created_at,duration_ms" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("agent_type" as never, "digital_marketing" as never)
      .order("created_at" as never, { ascending: false })
      .limit(5) as unknown as Promise<{ data: unknown[] | null }>,
    svc
      .from("dm_approvals" as never)
      .select("id,approval_type,title,description,recommended_spend_usd,predicted_roi,status,expires_at,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("status" as never, "pending" as never)
      .order("created_at" as never, { ascending: false })
      .limit(10) as unknown as Promise<{ data: unknown[] | null }>,
    svc
      .from("dm_campaigns" as never)
      .select("id,platform,name,objective,status,budget_daily_usd,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("created_at" as never, { ascending: false })
      .limit(10) as unknown as Promise<{ data: unknown[] | null }>,
    svc
      .from("dm_learning_patterns" as never)
      .select("pattern_type,title,description,confidence,platforms" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("is_active" as never, true as never)
      .order("confidence" as never, { ascending: false })
      .limit(12) as unknown as Promise<{ data: unknown[] | null }>,
  ]);

  return NextResponse.json({
    playbook:   (playbookRes as { data: unknown }).data,
    recentRuns: (runsRes as { data: unknown[] | null }).data ?? [],
    pendingApprovals: (approvalsRes as { data: unknown[] | null }).data ?? [],
    campaigns:  (campaignsRes as { data: unknown[] | null }).data ?? [],
    patterns:   (patternsRes as { data: unknown[] | null }).data ?? [],
  });
}
