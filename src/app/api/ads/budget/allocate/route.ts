/**
 * POST /api/ads/budget/allocate
 *
 * Triggers the 3-agent Budget Allocator swarm for the authenticated dealership.
 * Writes results to budget_allocations; optionally pushes live to ad platforms
 * if auto_push = true in budget_rules.
 *
 * Body: {
 *   totalBudgetUsd: number   — total daily budget envelope across all channels
 *   autoPushOverride?: boolean  — override the auto_push rule for this run
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runBudgetAllocator } from "@/lib/ads/budget-allocator";

export const dynamic    = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id, dealerships(name)")
    .eq("user_id", user.id)
    .single() as unknown as {
      data: { dealership_id: string; dealerships: { name: string } | null } | null;
    };
  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  let body: { totalBudgetUsd?: number; autoPushOverride?: boolean } = {};
  try { body = await req.json(); } catch { /* optional body */ }

  const totalBudgetUsd = body.totalBudgetUsd;
  if (!totalBudgetUsd || totalBudgetUsd <= 0) {
    return NextResponse.json({ error: "totalBudgetUsd is required and must be > 0" }, { status: 422 });
  }

  const dealershipName = ud.dealerships?.name ?? "Your Dealership";

  try {
    const result = await runBudgetAllocator(
      ud.dealership_id,
      totalBudgetUsd,
      dealershipName,
      body.autoPushOverride !== undefined ? { auto_push: body.autoPushOverride } : undefined
    );
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[budget/allocate] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — return latest allocation for this dealership
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
    .from("budget_allocations" as never)
    .select("*" as never)
    .eq("dealership_id" as never, ud.dealership_id as never)
    .order("allocation_date" as never, { ascending: false })
    .limit(30) as unknown as { data: Array<Record<string, unknown>> | null };

  return NextResponse.json({ allocations: data ?? [] });
}
