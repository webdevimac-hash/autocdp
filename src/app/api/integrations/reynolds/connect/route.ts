/**
 * POST /api/integrations/reynolds/connect
 *
 * Reynolds uses API key auth (no OAuth).
 * Dealer submits their Reynolds DealerLink API key.
 * We encrypt it, store it, then kick off initial full sync.
 *
 * Body: { apiKey: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encryptTokens } from "@/lib/dms/encrypt";
import { runSync } from "@/lib/dms/sync-engine";
import { fetchReynoldsCustomers } from "@/lib/dms/reynolds";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { apiKey?: string };
  const apiKey = body.apiKey?.trim();
  if (!apiKey) return NextResponse.json({ error: "apiKey is required" }, { status: 400 });

  // Resolve dealership via user_dealerships (dealerships table has no owner_id column)
  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  if (!ud?.dealership_id) {
    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
  }

  // Validate key by making a test request
  try {
    await fetchReynoldsCustomers(apiKey, undefined, undefined);
  } catch {
    return NextResponse.json(
      { error: "Invalid Reynolds API key — test request failed" },
      { status: 400 }
    );
  }

  const encrypted = await encryptTokens({ apiKey });

  const { data: conn, error: upsertErr } = await svc
    .from("dms_connections")
    .upsert(
      {
        dealership_id: ud.dealership_id,
        provider: "reynolds",
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

  // Fire initial full sync in background
  void runSync({
    dealershipId: ud.dealership_id as string,
    connectionId: conn.id as string,
    provider: "reynolds",
    jobType: "full",
  }).catch((e) => console.error("[reynolds/connect] Initial sync failed:", e));

  return NextResponse.json({ ok: true, connectionId: conn.id });
}
