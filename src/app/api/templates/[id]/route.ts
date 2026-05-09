import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";

// PATCH — update a template (name, body, tone, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const allowed = ["name", "channel", "subject", "body", "goal", "tone",
                   "credit_tiers", "lifecycle_stages", "is_active"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data, error } = await (svc
    .from("campaign_templates")
    .update(updates as never)
    .eq("id", id)
    .eq("dealership_id", dealershipId)
    .select()
    .single()) as unknown as { data: Record<string, unknown> | null; error: unknown };

  if (error || !data) return NextResponse.json({ error: "Not found or update failed" }, { status: 404 });
  return NextResponse.json({ template: data });
}

// DELETE — soft-delete (set is_active = false)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const svc = createServiceClient();
  const { error } = await (svc
    .from("campaign_templates")
    .update({ is_active: false } as never)
    .eq("id", id)
    .eq("dealership_id", dealershipId)) as unknown as { error: unknown };

  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
