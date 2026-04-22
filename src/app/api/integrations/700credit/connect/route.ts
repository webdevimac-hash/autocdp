/**
 * POST /api/integrations/700credit/connect
 *
 * Body: { apiKey: string }
 *
 * FCRA notice: soft-pull only, performed on customers with existing dealership
 * relationship (prior visit or purchase). No hard inquiry. Stores tier label only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encryptTokens } from "@/lib/dms/encrypt";
import { runSync } from "@/lib/dms/sync-engine";
import { fetchCreditTier } from "@/lib/dms/seven-hundred-credit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { apiKey?: string };
  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
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

  // Validate key with a minimal test lookup (synthetic consumer, non-real)
  try {
    await fetchCreditTier(
      { firstName: "Test", lastName: "Validation", email: "validate@autocdp.test" },
      apiKey
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid 700Credit API key — test request failed" },
      { status: 400 }
    );
  }

  const encrypted = await encryptTokens({ apiKey });

  const { data: conn, error: upsertErr } = await svc
    .from("dms_connections")
    .upsert(
      {
        dealership_id: ud.dealership_id,
        provider: "seven_hundred_credit",
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
    provider: "seven_hundred_credit",
    jobType: "full",
  }).catch((e) => console.error("[700credit/connect] Initial sync failed:", e));

  return NextResponse.json({ ok: true, connectionId: conn.id });
}
