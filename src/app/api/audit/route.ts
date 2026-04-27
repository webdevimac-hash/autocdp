import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { toApiError } from "@/lib/errors";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const [auditRes, agentRes] = await Promise.all([
      supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, details, created_at, user_id")
        .eq("dealership_id", dealershipId)
        .order("created_at", { ascending: false })
        .limit(100),

      supabase
        .from("agent_runs")
        .select("id, agent_type, status, created_at, output_summary, error")
        .eq("dealership_id", dealershipId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      auditLog: auditRes.data ?? [],
      agentRuns: agentRes.data ?? [],
    });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}
