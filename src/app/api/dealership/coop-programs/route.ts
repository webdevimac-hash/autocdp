import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

type UdRow = { dealership_id: string } | null;

// GET /api/dealership/coop-programs — list active co-op programs for current dealership
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 404 });

  const svc = createServiceClient();
  const { data: programs, error } = await svc
    .from("dealership_coop_programs")
    .select("id, manufacturer, program_name, reimbursement_rate, max_reimbursement_usd, valid_from, valid_through")
    .eq("dealership_id", ud.dealership_id)
    .eq("is_active", true)
    .order("manufacturer");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ programs: programs ?? [] });
}
