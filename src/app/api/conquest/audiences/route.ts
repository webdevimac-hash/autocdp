/**
 * /api/conquest/audiences
 *
 * GET  — list conquest audiences for the authenticated dealership
 * POST — create a new named audience (criteria saved; build triggered async)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildAudience } from "@/lib/conquest/engine";

export const dynamic    = "force-dynamic";
export const maxDuration = 60;

async function getDealershipId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", userId)
    .single() as unknown as { data: { dealership_id: string } | null };
  return data?.dealership_id ?? null;
}

// ---------------------------------------------------------------------------
// GET /api/conquest/audiences
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getDealershipId(supabase, user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  const svc = createServiceClient();
  const { data, error } = await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_audiences" as never)
    .select("*" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .order("updated_at" as never, { ascending: false })
    .limit(50) as unknown as { data: Array<Record<string, unknown>> | null; error: unknown };

  if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });
  return NextResponse.json({ audiences: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST /api/conquest/audiences
// Body: { name, description?, criteria }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getDealershipId(supabase, user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  let body: { name?: string; description?: string; criteria?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { name, description, criteria } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 422 });

  const svc = createServiceClient();

  // Insert the audience record in draft status
  const { data: created, error: insertErr } = await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_audiences" as never)
    .insert({
      dealership_id: dealershipId,
      name:          name.trim(),
      description:   description ?? null,
      criteria:      criteria ?? {},
      status:        "building",
    } as never)
    .select("id" as never)
    .single() as unknown as { data: { id: string } | null; error: unknown };

  if (insertErr || !created?.id) {
    return NextResponse.json({ error: "Failed to create audience" }, { status: 500 });
  }

  // Build the audience immediately (synchronous — limit 60s)
  try {
    const result = await buildAudience(dealershipId, created.id);
    return NextResponse.json({ id: created.id, ...result }, { status: 201 });
  } catch (e) {
    console.error("[audiences POST] build error:", e);
    return NextResponse.json({ audienceId: created.id, error: "Build failed — audience saved as draft" }, { status: 207 });
  }
}
