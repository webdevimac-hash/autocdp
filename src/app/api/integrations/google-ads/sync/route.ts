/**
 * POST   /api/integrations/google-ads/sync  — Trigger a performance pull.
 * DELETE /api/integrations/google-ads/sync  — Disconnect Google Ads.
 *
 * Query params:
 *   since=YYYY-MM-DD  (default: 30 days ago)
 *   until=YYYY-MM-DD  (default: today)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { syncGoogleAds } from "@/lib/ads/ads-sync";

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
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since") ?? undefined;
  const until = searchParams.get("until") ?? undefined;

  const { data: conn } = await svc
    .from("dms_connections" as never)
    .select("id" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "google_ads" as never)
    .eq("status" as never, "active" as never)
    .maybeSingle() as unknown as { data: { id: string } | null };

  if (!conn) {
    return NextResponse.json({ error: "Google Ads not connected" }, { status: 400 });
  }

  try {
    const result = await syncGoogleAds(dealershipId, conn.id, since, until);
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
    .from("dms_connections" as never)
    .delete()
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "google_ads" as never);

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
