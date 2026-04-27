import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDirectMailOrchestrator } from "@/lib/anthropic/agents/orchestrator";
import { checkRateLimit } from "@/lib/rate-limit";
import { toApiError } from "@/lib/errors";
import { getActiveDealershipId } from "@/lib/dealership";
import { logAudit } from "@/lib/audit";
import type { MailTemplateType } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) {
      return NextResponse.json({ error: "No dealership found", code: "NO_DEALERSHIP" }, { status: 400 });
    }

    const body = await req.json();
    const { customerIds, templateType, campaignGoal, campaignId, dryRun = false, isTest = false, tone, includeProspects = false, campaignType = "standard", includeBookNow = false, designStyle = "standard" } = body;

    // Validation
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: "customerIds must be a non-empty array", code: "VALIDATION_ERROR" }, { status: 400 });
    }
    if (!["postcard_6x9", "letter_6x9", "letter_8.5x11"].includes(templateType)) {
      return NextResponse.json({ error: "Invalid templateType", code: "VALIDATION_ERROR" }, { status: 400 });
    }
    if (!campaignGoal?.trim()) {
      return NextResponse.json({ error: "campaignGoal is required", code: "VALIDATION_ERROR" }, { status: 400 });
    }
    if (customerIds.length > 50) {
      return NextResponse.json({ error: "Max 50 customers per API call. For larger batches, use bulk campaign.", code: "VALIDATION_ERROR" }, { status: 400 });
    }

    // Rate limits (skip for dry runs — no real sends)
    if (!dryRun) {
      const [mailLimit, agentLimit] = await Promise.all([
        checkRateLimit(dealershipId, "mail_piece_sent", customerIds.length),
        checkRateLimit(dealershipId, "agent_run", 1),
      ]);

      if (!mailLimit.allowed) {
        return NextResponse.json(
          {
            error: `Daily mail limit reached (${mailLimit.count}/${mailLimit.limit} pieces sent today). Limits reset at midnight UTC.`,
            code: "DAILY_LIMIT_EXCEEDED",
            limit: mailLimit.limit,
            count: mailLimit.count,
          },
          { status: 429 }
        );
      }
      if (!agentLimit.allowed) {
        return NextResponse.json(
          {
            error: "Daily AI agent limit reached. Limits reset at midnight UTC.",
            code: "DAILY_LIMIT_EXCEEDED",
            limit: agentLimit.limit,
            count: agentLimit.count,
          },
          { status: 429 }
        );
      }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI service is not configured. Add your ANTHROPIC_API_KEY to environment settings.", code: "AI_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    if (!dryRun && !process.env.POSTGRID_API_KEY) {
      return NextResponse.json(
        { error: "Direct mail service is not configured. Add your POSTGRID_API_KEY or enable Dry Run mode.", code: "POSTGRID_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const { data: dealership } = await supabase
      .from("dealerships")
      .select("name")
      .eq("id", dealershipId)
      .single() as { data: { name: string } | null };

    const result = await runDirectMailOrchestrator({
      context: {
        dealershipId,
        dealershipName: dealership?.name ?? "Your Dealership",
        campaignId,
      },
      campaignGoal,
      templateType: templateType as MailTemplateType,
      customerIds,
      dealershipTone: tone,
      dryRun,
      isTest,
      includeProspects,
      campaignType,
      includeBookNow,
      designStyle,
      createdBy: user.id,
    });

    // Audit log — fire and forget
    void logAudit({
      dealershipId,
      userId: user.id,
      action: dryRun ? "campaign.dry_run" : "campaign.sent",
      resourceType: "campaign",
      resourceId: campaignId,
      metadata: {
        channel: "direct_mail",
        recipient_count: customerIds.length,
        template_type: templateType,
        dry_run: dryRun,
        is_test: isTest,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}
