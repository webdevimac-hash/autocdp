/**
 * POST /api/conquest/audiences/[audienceId]/hooks
 *
 * Generates AI-powered outreach hooks for leads in a conquest audience.
 * Uses Claude Haiku for bulk, cost-efficient generation.
 *
 * Body: { maxLeads?: number }  — default 20, max 50
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOutreachHooks } from "@/lib/conquest/engine";

export const dynamic    = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ audienceId: string }> }
) {
  const { audienceId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: { dealership_id: string } | null };
  const dealershipId = ud?.dealership_id;
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  let body: { maxLeads?: number } = {};
  try { body = await req.json(); } catch { /* defaults */ }

  const maxLeads = Math.min(body.maxLeads ?? 20, 50);

  try {
    const hooks = await generateOutreachHooks(dealershipId, audienceId, maxLeads);
    return NextResponse.json({ hooks, count: hooks.length });
  } catch (e) {
    console.error("[hooks] generation error:", e);
    return NextResponse.json({ error: "Hook generation failed" }, { status: 500 });
  }
}
