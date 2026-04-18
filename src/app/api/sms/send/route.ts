import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeSendSmsTool } from "@/lib/anthropic/tools/send-sms";

/**
 * POST /api/sms/send
 *
 * Body: { customer_id: string; message: string; dryRun?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .single();

    if (!ud?.dealership_id) {
      return NextResponse.json({ error: "No dealership found" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { customer_id, message, campaign_id, dryRun } = body;

    if (!customer_id || !message) {
      return NextResponse.json({ error: "customer_id and message are required" }, { status: 400 });
    }

    const result = await executeSendSmsTool(
      { customer_id, message },
      {
        dealershipId: ud.dealership_id,
        campaignId: campaign_id,
        createdBy: user.id,
        dryRun: dryRun ?? false,
      }
    );

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error) {
    console.error("[/api/sms/send]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
