/**
 * POST   /api/integrations/700credit/sync — Trigger credit enrichment sync.
 * DELETE /api/integrations/700credit/sync — Disconnect.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runSync } from "@/lib/dms/sync-engine";

export const dynamic = "force-dynamic";

async function resolveAuth(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 as const };

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  if (!ud?.dealership_id) return { error: "Dealership not found" as const, status: 404 as const };
  return { dealershipId: ud.dealership_id as string, svc };
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { dealershipId, svc } = auth;

  const { data: conn } = await svc
    .from("dms_connections")
    .select("id, last_sync_at")
    .eq("dealership_id", dealershipId)
    .eq("provider", "seven_hundred_credit")
    .eq("status", "active")
    .maybeSingle();

  if (!conn) return NextResponse.json({ error: "700Credit not connected" }, { status: 400 });

  try {
    const result = await runSync({
      dealershipId,
      connectionId: conn.id as string,
      provider: "seven_hundred_credit",
      jobType: "full",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await resolveAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { dealershipId, svc } = auth;

  const { error } = await svc
    .from("dms_connections")
    .delete()
    .eq("dealership_id", dealershipId)
    .eq("provider", "seven_hundred_credit");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
