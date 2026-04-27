import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getDailyUsage, getDealershipLimits, DAILY_LIMITS } from "@/lib/rate-limit";
import { toApiError } from "@/lib/errors";

// GET /api/dealership/limits — current limits + today's usage
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id, role")
      .eq("user_id", user.id)
      .single();
    if (!ud) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const [{ limits, dailyCostLimitCents }, usage] = await Promise.all([
      getDealershipLimits(ud.dealership_id),
      getDailyUsage(ud.dealership_id),
    ]);

    return NextResponse.json({
      dealershipId: ud.dealership_id,
      role: ud.role,
      globalDefaults: DAILY_LIMITS,
      limits,
      dailyCostLimitCents,
      usage,
    });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}

// PUT /api/dealership/limits — update per-dealership overrides (admin/owner only)
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ud } = await supabase
      .from("user_dealerships")
      .select("dealership_id, role")
      .eq("user_id", user.id)
      .single();
    if (!ud) return NextResponse.json({ error: "No dealership" }, { status: 400 });
    if (!["owner", "admin"].includes(ud.role ?? "")) {
      return NextResponse.json({ error: "Only owners and admins can change limits." }, { status: 403 });
    }

    const body = await req.json();
    const {
      mail_piece_sent,
      agent_run,
      sms_sent,
      email_sent,
      daily_cost_limit_cents,
    } = body as {
      mail_piece_sent?: number | null;
      agent_run?: number | null;
      sms_sent?: number | null;
      email_sent?: number | null;
      daily_cost_limit_cents?: number;
    };

    // Validate: non-negative integers or null
    const fields = { mail_piece_sent, agent_run, sms_sent, email_sent };
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== null && (typeof v !== "number" || v < 0 || !Number.isInteger(v))) {
        return NextResponse.json({ error: `${k} must be a non-negative integer or null` }, { status: 400 });
      }
    }

    const service = createServiceClient();
    const { error: upsertErr } = await service
      .from("dealership_limits")
      .upsert(
        {
          dealership_id: ud.dealership_id,
          ...(mail_piece_sent !== undefined ? { mail_piece_sent } : {}),
          ...(agent_run       !== undefined ? { agent_run       } : {}),
          ...(sms_sent        !== undefined ? { sms_sent        } : {}),
          ...(email_sent      !== undefined ? { email_sent      } : {}),
          ...(daily_cost_limit_cents !== undefined ? { daily_cost_limit_cents } : {}),
        },
        { onConflict: "dealership_id" }
      );

    if (upsertErr) throw upsertErr;

    const updated = await getDealershipLimits(ud.dealership_id);
    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}
