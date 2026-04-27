import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { toApiError } from "@/lib/errors";

/**
 * POST /api/onboard/complete
 * Marks the dealership onboarded_at = now() if not already set.
 * Called by the setup wizard on the final "Go to Dashboard" step.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single();
    if (!ud) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const service = createServiceClient();
    const { error: updateErr } = await service
      .from("dealerships")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", ud.dealership_id)
      .is("onboarded_at", null); // only set once — don't overwrite

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}
