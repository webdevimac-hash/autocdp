/**
 * POST /api/integrations/vinsolutions/connect
 *
 * Body: { apiKey: string; dealerId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encryptTokens } from "@/lib/dms/encrypt";
import { runSync } from "@/lib/dms/sync-engine";
import { fetchVinContacts } from "@/lib/dms/vinsolutions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { apiKey?: string; dealerId?: string };
  const apiKey = body.apiKey?.trim();
  const dealerId = body.dealerId?.trim();
  if (!apiKey || !dealerId) {
    return NextResponse.json({ error: "apiKey and dealerId are required" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  if (!ud?.dealership_id) {
    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
  }

  // Validate credentials
  try {
    await fetchVinContacts(apiKey, dealerId, undefined, undefined);
  } catch {
    return NextResponse.json(
      { error: "Invalid VinSolutions credentials — test request failed" },
      { status: 400 }
    );
  }

  const encrypted = await encryptTokens({ apiKey, dealerId });

  const { data: conn, error: upsertErr } = await svc
    .from("dms_connections")
    .upsert(
      {
        dealership_id: ud.dealership_id,
        provider: "vinsolutions",
        status: "active",
        encrypted_tokens: encrypted,
        metadata: {},
      },
      { onConflict: "dealership_id,provider" }
    )
    .select("id")
    .single();

  if (upsertErr || !conn) {
    return NextResponse.json({ error: "Failed to save connection" }, { status: 500 });
  }

  void runSync({
    dealershipId: ud.dealership_id,
    connectionId: conn.id as string,
    provider: "vinsolutions",
    jobType: "full",
  }).catch((e) => console.error("[vinsolutions/connect] Initial sync failed:", e));

  return NextResponse.json({ ok: true, connectionId: conn.id });
}
