/**
 * GET /api/analytics/unified
 *
 * Returns UnifiedAnalyticsData for the current dealership.
 * Query params:
 *   days  : 30 | 60 | 90   (default 30)
 *   model : last_touch | first_touch | linear  (default last_touch)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  getUnifiedAnalytics,
  type AnalyticsDays,
  type AttributionModel,
} from "@/lib/analytics/unified-analytics";

export const dynamic   = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const svc = createServiceClient();
    const { data: ud } = await svc
      .from("user_dealerships")
      .select("dealership_id")
      .eq("user_id", user.id)
      .maybeSingle() as { data: { dealership_id: string } | null };

    if (!ud?.dealership_id) {
      return NextResponse.json({ error: "No dealership found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);

    const rawDays  = parseInt(searchParams.get("days") ?? "30");
    const days     = ([30, 60, 90].includes(rawDays) ? rawDays : 30) as AnalyticsDays;

    const rawModel = searchParams.get("model") ?? "last_touch";
    const model    = (["last_touch", "first_touch", "linear"].includes(rawModel)
      ? rawModel
      : "last_touch") as AttributionModel;

    const data = await getUnifiedAnalytics(ud.dealership_id, days, model);

    return NextResponse.json(data);
  } catch (err) {
    console.error("[unified-analytics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
