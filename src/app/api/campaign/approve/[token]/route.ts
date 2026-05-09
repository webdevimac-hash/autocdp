import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashToken, hashCode } from "@/lib/campaign-approval";
import type { CampaignSnapshot } from "@/lib/campaign-approval";
import { runDirectMailOrchestrator, runOmnichannelOrchestrator } from "@/lib/anthropic/agents/orchestrator";
import type { OmnichannelChannel } from "@/lib/anthropic/agents/orchestrator";
import { logAudit } from "@/lib/audit";
import type { MailTemplateType, DesignStyle } from "@/types";
import { checkPrintRunGate, getBillingSettings } from "@/lib/billing/invoices";
import { getMonthlyUsage } from "@/lib/billing/metering";
import { buildControllerAlertEmail } from "@/lib/email-templates/controller-alert-email";
import { sendEmail } from "@/lib/resend-client";

// GET — return approval record details (no auth required — token is the secret)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const service = createServiceClient();
  const tokenHash = hashToken(token);

  // Exclude the code hash from what we return — it must never leave the server
  const { data, error } = await service
    .from("campaign_approvals")
    .select("id, status, expires_at, campaign_snapshot, requested_by_email, gm_name, created_at")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Approval link not found or already used" }, { status: 404 });
  }

  if (data.status !== "pending") {
    return NextResponse.json({ ...data, alreadyActed: true });
  }

  if (new Date(data.expires_at) < new Date()) {
    await service
      .from("campaign_approvals")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("token_hash", tokenHash);
    return NextResponse.json({ error: "This approval link has expired (24h limit)" }, { status: 410 });
  }

  return NextResponse.json(data);
}

// POST — approve or reject the campaign
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const service = createServiceClient();
  const tokenHash = hashToken(token);
  const approverIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;

  const { action, notes, confirmationCode, userAgent } = await req.json().catch(() => ({
    action: undefined, notes: undefined, confirmationCode: undefined, userAgent: undefined,
  })) as { action?: "approve" | "reject"; notes?: string; confirmationCode?: string; userAgent?: string };

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  // Fetch and lock the approval record
  const { data: approval, error } = await service
    .from("campaign_approvals")
    .select("*")
    .eq("token_hash", tokenHash)
    .single() as { data: {
      id: string;
      dealership_id: string;
      requested_by: string | null;
      requested_by_email: string | null;
      gm_email: string;
      gm_name: string | null;
      campaign_snapshot: CampaignSnapshot;
      status: string;
      expires_at: string;
      confirmation_code_hash: string | null;
    } | null; error: unknown };

  if (error || !approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }
  if (approval.status !== "pending") {
    return NextResponse.json({ error: `This approval has already been ${approval.status}`, status: approval.status }, { status: 409 });
  }
  if (new Date(approval.expires_at) < new Date()) {
    await service.from("campaign_approvals").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", approval.id);
    return NextResponse.json({ error: "This approval link has expired" }, { status: 410 });
  }

  const now = new Date().toISOString();

  // ── Verify confirmation code (approve only) ───────────────────
  if (action === "approve") {
    if (!confirmationCode?.trim()) {
      return NextResponse.json({ error: "Confirmation code required to approve." }, { status: 400 });
    }
    if (approval.confirmation_code_hash) {
      const submittedHash = hashCode(confirmationCode.trim());
      if (submittedHash !== approval.confirmation_code_hash) {
        return NextResponse.json({ error: "Incorrect confirmation code. Please check your approval email." }, { status: 400 });
      }
    }
  }

  // ── REJECT ────────────────────────────────────────────────────
  if (action === "reject") {
    await service.from("campaign_approvals").update({
      status: "rejected",
      rejected_at: now,
      approver_ip: approverIp,
      approver_notes: notes?.trim() ?? null,
      updated_at: now,
    }).eq("id", approval.id);

    void logAudit({
      dealershipId: approval.dealership_id,
      userId: approval.requested_by ?? undefined,
      action: "campaign.approval.rejected",
      resourceType: "campaign_approval",
      resourceId: approval.id,
      metadata: {
        gm_email: approval.gm_email,
        approver_ip: approverIp,
        notes: notes ?? null,
        requested_by_email: approval.requested_by_email,
      },
    });

    return NextResponse.json({ status: "rejected", message: "Campaign has been rejected." });
  }

  // ── APPROVE → mark approved then execute ─────────────────────
  await service.from("campaign_approvals").update({
    status: "approved",
    approved_at: now,
    approver_ip: approverIp,
    approver_notes: notes?.trim() ?? null,
    approver_user_agent: userAgent?.slice(0, 512) ?? null,
    approver_confirmed: true,
    updated_at: now,
  }).eq("id", approval.id);

  void logAudit({
    dealershipId: approval.dealership_id,
    userId: approval.requested_by ?? undefined,
    action: "campaign.approval.approved",
    resourceType: "campaign_approval",
    resourceId: approval.id,
    metadata: {
      gm_email: approval.gm_email,
      gm_name: approval.gm_name,
      approver_ip: approverIp,
      approver_user_agent: userAgent?.slice(0, 512) ?? null,
      code_verified: true,
      explicit_consent: true,
      requested_by_email: approval.requested_by_email,
      recipient_count: approval.campaign_snapshot.recipientCount,
      channel: approval.campaign_snapshot.channel,
    },
  });

  // ── Execute the campaign ──────────────────────────────────────
  const snap = approval.campaign_snapshot;

  try {
    // Direct mail gate: check for overdue invoices and notify controller if threshold crossed
    if (snap.channel === "direct_mail") {
      const printCostCents = snap.customerIds.length * 150; // $1.50 per piece
      const gateResult = await checkPrintRunGate(approval.dealership_id, printCostCents);

      if (!gateResult.allowed) {
        // Record in audit log
        void logAudit({
          dealershipId: approval.dealership_id,
          userId: approval.requested_by ?? undefined,
          action: "campaign.blocked.invoice_overdue",
          resourceType: "campaign_approval",
          resourceId: approval.id,
          metadata: { reason: gateResult.reason, blocked_invoice_id: gateResult.blockedByInvoiceId },
        });
        return NextResponse.json({
          status: "blocked",
          message: gateResult.reason,
          invoiceId: gateResult.blockedByInvoiceId,
        }, { status: 402 });
      }

      // Notify controller if this run crosses the spend threshold
      if (gateResult.controllerNotified) {
        const [billingSettings, monthUsage] = await Promise.all([
          getBillingSettings(approval.dealership_id),
          getMonthlyUsage(approval.dealership_id).catch(() => ({ totalCostCents: 0 })),
        ]);
        if (billingSettings.invoice_controller_email) {
          const svc = createServiceClient();
          const { data: dl } = await svc.from("dealerships").select("name").eq("id", approval.dealership_id).single();
          const { subject, html } = buildControllerAlertEmail({
            dealerName: (dl as { name?: string } | null)?.name ?? "Dealership",
            controllerEmail: billingSettings.invoice_controller_email,
            printPieces: snap.customerIds.length,
            printCostCents,
            thresholdCents: billingSettings.invoice_threshold_cents,
            currentMonthSpendCents: monthUsage.totalCostCents,
            channel: snap.channel,
            requestedByEmail: snap.requestedByEmail,
            billingPageUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://autocdp.com"}/dashboard/billing`,
          });
          void sendEmail({
            to: billingSettings.invoice_controller_email,
            subject,
            html,
            fromName: "AutoCDP Billing",
            fromEmail: "billing@autocdp.io",
          });
        }
      }
    }

    let execResult: { successCount?: number; failedCount?: number; status?: string };

    if (snap.channel === "direct_mail") {
      execResult = await runDirectMailOrchestrator({
        context: { dealershipId: snap.dealershipId, dealershipName: snap.dealershipName },
        campaignGoal: snap.campaignGoal,
        templateType: (snap.templateType ?? "postcard_6x9") as MailTemplateType,
        customerIds: snap.customerIds,
        dryRun: false,
        isTest: false,
        campaignType: (snap.campaignType ?? "standard") as "standard" | "aged_inventory",
        includeBookNow: snap.includeBookNow ?? false,
        designStyle: (snap.designStyle ?? "standard") as DesignStyle,
        createdBy: undefined,
      });
    } else {
      const channelMap: Record<string, OmnichannelChannel[]> = {
        sms: ["sms"],
        email: ["email"],
        multi_channel: ["multi_channel"],
      };
      execResult = await runOmnichannelOrchestrator({
        context: { dealershipId: snap.dealershipId, dealershipName: snap.dealershipName },
        campaignGoal: snap.campaignGoal,
        channels: channelMap[snap.channel] ?? ["email"],
        customerIds: snap.customerIds,
        templateType: snap.templateType as MailTemplateType | undefined,
        dryRun: false,
        campaignType: (snap.campaignType ?? "standard") as "standard" | "aged_inventory",
        includeBookNow: snap.includeBookNow ?? false,
        createdBy: undefined,
      });
    }

    const execNow = new Date().toISOString();
    await service.from("campaign_approvals").update({
      status: "executed",
      executed_at: execNow,
      updated_at: execNow,
    }).eq("id", approval.id);

    void logAudit({
      dealershipId: approval.dealership_id,
      userId: approval.requested_by ?? undefined,
      action: "campaign.sent",
      resourceType: "campaign_approval",
      resourceId: approval.id,
      metadata: {
        approval_id: approval.id,
        gm_email: approval.gm_email,
        gm_name: approval.gm_name,
        approver_ip: approverIp,
        channel: snap.channel,
        recipient_count: snap.customerIds.length,
        success_count: execResult.successCount ?? 0,
        failed_count: execResult.failedCount ?? 0,
        exec_status: execResult.status,
      },
    });

    return NextResponse.json({
      status: "executed",
      successCount: execResult.successCount ?? 0,
      failedCount: execResult.failedCount ?? 0,
      message: `Campaign executed. ${execResult.successCount ?? 0} of ${snap.customerIds.length} sent successfully.`,
    });
  } catch (execErr) {
    const errMsg = execErr instanceof Error ? execErr.message : "Campaign execution failed";
    await service.from("campaign_approvals").update({
      status: "approved",
      approver_notes: `Approved but execution failed: ${errMsg}`,
      updated_at: new Date().toISOString(),
    }).eq("id", approval.id);
    return NextResponse.json({ error: `Approved but campaign failed to execute: ${errMsg}` }, { status: 500 });
  }
}
