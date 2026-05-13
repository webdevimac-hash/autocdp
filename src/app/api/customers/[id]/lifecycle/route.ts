import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";

export const dynamic = "force-dynamic";

const ALLOWED_STAGES = [
  "prospect",
  "active",
  "at_risk",
  "lapsed",
  "vip",
  "sold",
  "lost",
] as const;

type Stage = (typeof ALLOWED_STAGES)[number];

/**
 * POST /api/customers/[id]/lifecycle
 * Body: { stage: 'sold' | 'lost' | ... , reason?: string }
 *
 * Updates customers.lifecycle_stage and writes a system entry to
 * customer_activity so the change is visible on the timeline.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json(
      { error: "No active dealership" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    stage?: string;
    reason?: string;
  };
  const stage = body.stage;
  if (!stage || !(ALLOWED_STAGES as readonly string[]).includes(stage)) {
    return NextResponse.json(
      {
        error: `Invalid stage. Must be one of: ${ALLOWED_STAGES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const svc = createServiceClient();

  // Verify customer belongs to this dealership before mutating.
  const { data: existing } = await svc
    .from("customers")
    .select("id, dealership_id, first_name, last_name, lifecycle_stage")
    .eq("id", id)
    .eq("dealership_id", dealershipId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const prevStage = (existing as { lifecycle_stage: string | null }).lifecycle_stage ?? "prospect";

  const { error: updErr } = await svc
    .from("customers")
    .update({ lifecycle_stage: stage as Stage, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("dealership_id", dealershipId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Audit trail entry on the customer's timeline.
  await svc.from("customer_activity").insert({
    dealership_id: dealershipId,
    customer_id: id,
    user_id: user.id,
    type: "system",
    title: stageDisplayLabel(stage as Stage),
    body: body.reason
      ? `Lifecycle: ${prevStage} → ${stage}. ${body.reason}`
      : `Lifecycle: ${prevStage} → ${stage}.`,
    planned: false,
    metadata: { previous_stage: prevStage, new_stage: stage },
  });

  return NextResponse.json({
    ok: true,
    previous_stage: prevStage,
    new_stage: stage,
  });
}

function stageDisplayLabel(stage: Stage): string {
  switch (stage) {
    case "sold":
      return "Marked as Sold";
    case "lost":
      return "Marked as Dead";
    case "vip":
      return "Promoted to VIP";
    case "at_risk":
      return "Flagged at-risk";
    case "lapsed":
      return "Marked lapsed";
    case "active":
      return "Reactivated";
    case "prospect":
      return "Reset to prospect";
  }
}
