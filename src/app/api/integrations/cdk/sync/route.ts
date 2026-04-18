/**
 * POST /api/integrations/cdk/sync  — Trigger a CDK Fortellis delta (or full) sync.
 * DELETE /api/integrations/cdk/sync — Disconnect CDK Fortellis integration.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runSync } from "@/lib/dms/sync-engine";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Shared: resolve authenticated dealership
// ---------------------------------------------------------------------------

async function resolveAuth(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 as const };

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  if (!ud?.dealership_id) return { error: "Dealership not found" as const, status: 404 as const };

  return { dealershipId: ud.dealership_id as string, svc };
}

// ---------------------------------------------------------------------------
// POST — trigger sync
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { dealershipId, svc } = auth;

  const { data: conn } = await svc
    .from("dms_connections")
    .select("id, last_sync_at")
    .eq("dealership_id", dealershipId)
    .eq("provider", "cdk_fortellis")
    .eq("status", "active")
    .maybeSingle();

  if (!conn) return NextResponse.json({ error: "CDK not connected" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const jobType = searchParams.get("type") === "full" ? "full" : "delta";
  const since = jobType === "delta" ? (conn.last_sync_at as string | null) ?? undefined : undefined;

  try {
    const result = await runSync({
      dealershipId,
      connectionId: conn.id as string,
      provider: "cdk_fortellis",
      jobType,
      since,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — disconnect CDK integration
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const auth = await resolveAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { dealershipId, svc } = auth;

  const { error } = await svc
    .from("dms_connections")
    .delete()
    .eq("dealership_id", dealershipId)
    .eq("provider", "cdk_fortellis");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
