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
    const body = await req.json() as { dealer_notes?: string | null };

    const svc = createServiceClient();
    const { data, error } = await svc
      .from("dealership_insights")
      .update({
        dealer_notes: body.dealer_notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("dealership_id", dealershipId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ insight: data });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}
