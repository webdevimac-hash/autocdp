/**
 * /api/ads/budget/rules
 *
 * GET  — load budget rules for the authenticated dealership
 * POST — upsert budget rules (creates defaults on first call)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_RULES = {
  monthly_cap_usd:  null,
  channel_limits: {
    google_ads: { min: 20,  max: 1000 },
    meta_ads:   { min: 10,  max: 500  },
    tiktok_ads: { min: 10,  max: 300  },
  },
  min_change_pct:  10,
  auto_push:       false,
  managed_channels: ["google_ads", "meta_ads"],
  blackout_windows: [],
  channel_objectives: {
    google_ads: "roas",
    meta_ads:   "roas",
    tiktok_ads: "cpm",
  },
  min_impressions_threshold: 500,
  lookback_days: 14,
};

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: { dealership_id: string } | null };
  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  const svc = createServiceClient();
  const { data } = await (svc as ReturnType<typeof createServiceClient>)
    .from("budget_rules" as never)
    .select("*" as never)
    .eq("dealership_id" as never, ud.dealership_id as never)
    .maybeSingle() as unknown as { data: Record<string, unknown> | null };

  return NextResponse.json({ rules: data ?? { ...DEFAULT_RULES, dealership_id: ud.dealership_id } });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: { dealership_id: string } | null };
  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const svc = createServiceClient();
  const { error } = await (svc as ReturnType<typeof createServiceClient>)
    .from("budget_rules" as never)
    .upsert({
      dealership_id:            ud.dealership_id,
      monthly_cap_usd:          body.monthly_cap_usd ?? null,
      channel_limits:           body.channel_limits ?? DEFAULT_RULES.channel_limits,
      min_change_pct:           body.min_change_pct ?? DEFAULT_RULES.min_change_pct,
      auto_push:                body.auto_push ?? false,
      managed_channels:         body.managed_channels ?? DEFAULT_RULES.managed_channels,
      blackout_windows:         body.blackout_windows ?? [],
      channel_objectives:       body.channel_objectives ?? DEFAULT_RULES.channel_objectives,
      min_impressions_threshold: body.min_impressions_threshold ?? 500,
      lookback_days:             body.lookback_days ?? 14,
    } as never, { onConflict: "dealership_id" });

  if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
