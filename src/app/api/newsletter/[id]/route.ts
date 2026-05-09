import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// PATCH /api/newsletter/[id]  → update a draft
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc.from("user_dealerships").select("dealership_id").eq("user_id", user.id).single();
  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const body = await req.json() as Record<string, unknown>;
  const allowed = ["subject", "preview_text", "sections"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in body) updates[k] = body[k];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: updateErr } = await (svc as any)
    .from("newsletters")
    .update(updates)
    .eq("id", id)
    .eq("dealership_id", ud.dealership_id)
    .eq("status", "draft")
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Newsletter not found or already sent" }, { status: 404 });
  return NextResponse.json({ newsletter: data });
}
