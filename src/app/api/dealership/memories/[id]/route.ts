import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { toApiError } from "@/lib/errors";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.content !== undefined) updates.content = String(body.content).trim();
    if (body.category !== undefined) updates.category = body.category;
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);

    const svc = createServiceClient();
    const { data, error } = await svc
      .from("dealership_memories")
      .update(updates)
      .eq("id", id)
      .eq("dealership_id", dealershipId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ memory: data });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const { id } = await params;
    const svc = createServiceClient();
    const { error } = await svc
      .from("dealership_memories")
      .delete()
      .eq("id", id)
      .eq("dealership_id", dealershipId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}
