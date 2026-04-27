import { createServiceClient } from "@/lib/supabase/server";

export type AuditAction =
  | "campaign.sent"
  | "campaign.dry_run"
  | "campaign.created"
  | "agent.run.started"
  | "agent.run.completed"
  | "agent.run.failed"
  | "customer.imported"
  | "data.exported"
  | "settings.updated"
  | "demo_mode.enabled"
  | "demo_mode.disabled";

export async function logAudit(params: {
  dealershipId: string;
  userId?: string | null;
  action: AuditAction | (string & {});
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const service = createServiceClient();
    await service.from("audit_log").insert({
      dealership_id: params.dealershipId,
      user_id: params.userId ?? null,
      action: params.action,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Audit logging is best-effort — never block the primary operation
  }
}
