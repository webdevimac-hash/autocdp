import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runOmnichannelOrchestrator } from "@/lib/anthropic/agents/orchestrator";
import type { OmnichannelChannel } from "@/lib/anthropic/agents/orchestrator";
import { loadDealershipMemories, buildMemoryAuditContext } from "@/lib/memories";
import { generateApprovalToken, hashToken } from "@/lib/campaign-approval";
import type { CampaignSnapshot } from "@/lib/campaign-approval";
import { buildApprovalEmail } from "@/lib/email-templates/approval-email";
import { sendEmail } from "@/lib/resend-client";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/campaign/omnichannel
 *
 * Body:
 *   campaignGoal    string
 *   channels        OmnichannelChannel[]
 *   customerIds     string[]
 *   templateType?   string
 *   dryRun?         boolean  (default true)
 *   dealershipTone? string
 *   gmReviewRequired? boolean  — if true, create approval record instead of executing
 *   gmEmail?          string   — required when gmReviewRequired is true
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
      .single() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.json({ error: "No dealership found" }, { status: 400 });
    }

    const { data: dealership } = await supabase
      .from("dealerships")
      .select("name")
      .eq("id", ud.dealership_id)
      .single() as { data: { name: string } | null };

    const body = await req.json().catch(() => ({}));
    const {
      campaignGoal,
      channels,
      customerIds,
      templateType,
      dryRun,
      dealershipTone,
      includeProspects,
      campaignType,
      gmReviewRequired,
      gmEmail,
      gmName,
    } = body as {
      campaignGoal: string;
      channels: OmnichannelChannel[];
      customerIds: string[];
      templateType?: string;
      dryRun?: boolean;
      dealershipTone?: string;
      includeProspects?: boolean;
      campaignType?: string;
      gmReviewRequired?: boolean;
      gmEmail?: string;
      gmName?: string;
    };

    if (!campaignGoal || !channels?.length || !customerIds?.length) {
      return NextResponse.json({ error: "campaignGoal, channels, and customerIds are required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
    }

    // ── GM Review Required: queue for approval instead of executing ──────────
    if (gmReviewRequired) {
      if (!gmEmail?.includes("@")) {
        return NextResponse.json({ error: "gmEmail required when gmReviewRequired is true" }, { status: 400 });
      }

      // Load memories so the approval email can summarise what the swarm had available
      const memories = await loadDealershipMemories(ud.dealership_id);
      const memCtx = buildMemoryAuditContext(memories);
      const memoriesSummary = memories.length > 0
        ? `${memories.length} active guidance rule${memories.length !== 1 ? "s" : ""}: ` +
          `${memCtx.hardCount} hard constraint${memCtx.hardCount !== 1 ? "s" : ""}, ` +
          `${memCtx.softCount} soft suggestion${memCtx.softCount !== 1 ? "s" : ""}`
        : "No active guidance rules";

      const channelLabel = channels.join(" + ");
      const estimatedCost = channels.includes("direct_mail")
        ? `$${(customerIds.length * 1.35).toFixed(2)}`
        : `$${(customerIds.length * 0.02).toFixed(2)}`;

      const snapshot: CampaignSnapshot = {
        dealershipId:         ud.dealership_id,
        dealershipName:       dealership?.name ?? "Your Dealership",
        customerIds,
        channel:              (channels[0] ?? "email") as CampaignSnapshot["channel"],
        templateType,
        campaignGoal:         campaignGoal.trim(),
        campaignType:         campaignType ?? "standard",
        requestedByEmail:     user.email ?? "",
        recipientCount:       customerIds.length,
        estimatedCost,
        channelLabel,
        memoriesCount:        memCtx.total,
        hardConstraintsCount: memCtx.hardCount,
        memoriesSummary,
      };

      const token     = generateApprovalToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const svc = createServiceClient();
      const { data: approval, error: insertErr } = await svc
        .from("campaign_approvals")
        .insert({
          dealership_id:       ud.dealership_id,
          requested_by:        user.id,
          requested_by_email:  user.email ?? null,
          gm_email:            gmEmail.trim().toLowerCase(),
          gm_name:             gmName?.trim() ?? null,
          campaign_snapshot:   snapshot as never,
          status:              "pending",
          token_hash:          tokenHash,
          expires_at:          expiresAt,
        })
        .select("id")
        .single();

      if (insertErr || !approval) {
        return NextResponse.json({ error: "Failed to create approval record" }, { status: 500 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        ?? (req.headers.get("origin") ?? "https://autocdp.io");
      const approvalUrl = `${baseUrl}/campaign/approve/${token}`;

      const { subject, html } = buildApprovalEmail({ approvalUrl, snapshot, expiresAt });
      const emailResult = await sendEmail({
        to:        gmEmail.trim(),
        subject,
        html,
        fromName:  "AutoCDP",
        fromEmail: "approvals@autocdp.io",
      });

      void logAudit({
        dealershipId: ud.dealership_id,
        userId:       user.id,
        action:       "campaign.approval.requested",
        resourceType: "campaign_approval",
        resourceId:   approval.id,
        metadata: {
          gm_email:       gmEmail,
          recipient_count: customerIds.length,
          channel:        channels.join(","),
          email_sent:     emailResult.success,
          memories_count: memCtx.total,
          hard_constraints: memCtx.hardCount,
          memories_used:  memCtx.memories,
        },
      });

      return NextResponse.json({
        status:     "pending_approval",
        approvalId: approval.id,
        gmEmail:    gmEmail.trim(),
        expiresAt,
        emailSent:  emailResult.success,
      });
    }

    // ── Direct execution ──────────────────────────────────────────────────────
    const result = await runOmnichannelOrchestrator({
      context: {
        dealershipId:   ud.dealership_id,
        dealershipName: dealership?.name ?? "Your Dealership",
      },
      campaignGoal,
      channels: channels as OmnichannelChannel[],
      customerIds,
      templateType,
      dealershipTone,
      dryRun:           dryRun ?? false,
      includeProspects: includeProspects ?? false,
      campaignType:     campaignType ?? "standard",
      createdBy:        user.id,
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
