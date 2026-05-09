import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCadenceSummary } from "@/lib/cadence";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const summary = await getCadenceSummary(ud.dealership_id);
  return NextResponse.json(summary);
}
