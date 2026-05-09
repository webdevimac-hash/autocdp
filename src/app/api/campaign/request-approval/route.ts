import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { generateApprovalToken, hashToken, generateConfirmationCode, hashCode } from "@/lib/campaign-approval";
import type { CampaignSnapshot } from "@/lib/campaign-approval";
import { buildApprovalEmail } from "@/lib/email-templates/approval-email";
import { sendEmail } from "@/lib/resend-client";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const {
    gmEmail,
    gmName,
    customerIds,
    channel,
    templateType,
    campaignGoal,
    designStyle,
    accentColor,
    includeBookNow,
    campaignType,
    dealershipName,
    estimatedCost,
    channelLabel,
  } = body as {
    gmEmail: string;
    gmName?: string;
    customerIds: string[];
    channel: CampaignSnapshot["channel"];
    templateType?: string;
    campaignGoal: string;
    designStyle?: string;
    accentColor?: string;
    includeBookNow?: boolean;
    campaignType?: string;
    dealershipName: string;
    estimatedCost: string;
    channelLabel: string;
  };

  if (!gmEmail?.includes("@")) {
    return NextResponse.json({ error: "Valid GM email required" }, { status: 400 });
  }
  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    return NextResponse.json({ error: "customerIds required" }, { status: 400 });
  }
  if (!campaignGoal?.trim()) {
    return NextResponse.json({ error: "campaignGoal required" }, { status: 400 });
  }

  const snapshot: CampaignSnapshot = {
    dealershipId,
    dealershipName,
    customerIds,
    channel,
    templateType,
    campaignGoal: campaignGoal.trim(),
    designStyle,
    accentColor,
    includeBookNow: includeBookNow ?? false,
    campaignType: campaignType ?? "standard",
    requestedByEmail: user.email ?? "",
    recipientCount: customerIds.length,
    estimatedCost,
    channelLabel,
  };

  const token = generateApprovalToken();
  const tokenHash = hashToken(token);
  const confirmationCode = generateConfirmationCode();
  const confirmationCodeHash = hashCode(confirmationCode);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const service = createServiceClient();
  const { data: approval, error: insertErr } = await service
    .from("campaign_approvals")
    .insert({
      dealership_id: dealershipId,
      requested_by: user.id,
      requested_by_email: user.email ?? null,
      gm_email: gmEmail.trim().toLowerCase(),
      gm_name: gmName?.trim() ?? null,
      campaign_snapshot: snapshot as never,
      status: "pending",
      token_hash: tokenHash,
      confirmation_code_hash: confirmationCodeHash,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (insertErr || !approval) {
    return NextResponse.json({ error: "Failed to create approval record" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (req.headers.get("origin") ?? "https://autocdp.io");
  const approvalUrl = `${baseUrl}/campaign/approve/${token}`;

  const { subject, html } = buildApprovalEmail({ approvalUrl, snapshot, expiresAt, confirmationCode });
  const emailResult = await sendEmail({
    to: gmEmail.trim(),
    subject,
    html,
    fromName: "AutoCDP",
    fromEmail: "approvals@autocdp.io",
  });

  void logAudit({
    dealershipId,
    userId: user.id,
    action: "campaign.approval.requested",
    resourceType: "campaign_approval",
    resourceId: approval.id,
    metadata: {
      gm_email: gmEmail,
      recipient_count: customerIds.length,
      channel,
      email_sent: emailResult.success,
    },
  });

  return NextResponse.json({
    approvalId: approval.id,
    gmEmail: gmEmail.trim(),
    expiresAt,
    emailSent: emailResult.success,
    emailError: emailResult.error ?? null,
  });
}
