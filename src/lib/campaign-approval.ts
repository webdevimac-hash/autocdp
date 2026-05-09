/**
 * Campaign approval utilities.
 * Handles token generation, hashing, and the shared snapshot type.
 */

import crypto from "crypto";

export function generateApprovalToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type ApprovalChannel = "direct_mail" | "sms" | "email" | "multi_channel";

export interface CampaignSnapshot {
  // Execution params (stored in DB, used to run the campaign on approval)
  dealershipId: string;
  dealershipName: string;
  customerIds: string[];
  channel: ApprovalChannel;
  templateType?: string;
  campaignGoal: string;
  designStyle?: string;
  accentColor?: string;
  includeBookNow?: boolean;
  campaignType?: string;

  // Display-only metadata (for approval email + page)
  requestedByEmail: string;
  recipientCount: number;
  estimatedCost: string;
  channelLabel: string;

  // Governance context — attached at request time so GM sees what guided the swarm
  memoriesCount?: number;
  hardConstraintsCount?: number;
  memoriesSummary?: string;   // e.g. "3 active memories: 2 tone, 1 compliance (1 hard)"
}

export interface ApprovalRecord {
  id: string;
  dealership_id: string;
  requested_by: string | null;
  requested_by_email: string | null;
  gm_email: string;
  gm_name: string | null;
  campaign_snapshot: CampaignSnapshot;
  status: "pending" | "approved" | "rejected" | "expired" | "executed";
  expires_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  executed_at: string | null;
  approver_ip: string | null;
  approver_notes: string | null;
  created_at: string;
}
