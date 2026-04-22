/**
 * POST /api/integrations/general-crm/connect
 *
 * Generic CRM connector for Dealertrack, Elead, DealerSocket, etc.
 * Body: { apiKey: string; baseUrl?: string }
 *
 * If no REST API is available, dealers can skip this and use the CSV upload
 * endpoint at POST /api/integrations/general-crm/upload instead.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encryptTokens } from "@/lib/dms/encrypt";
import { runSync } from "@/lib/dms/sync-engine";
import { fetchGeneralCrmLeads, GENERAL_CRM_API_BASE } from "@/lib/dms/general-crm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { apiKey?: string; baseUrl?: string };
  const apiKey = body.apiKey?.trim();
  const baseUrl = body.baseUrl?.trim() || GENERAL_CRM_API_BASE;
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

  // Validate credentials
  try {
    await fetchGeneralCrmLeads(apiKey, baseUrl, undefined, undefined);
  } catch {
    return NextResponse.json(
      { error: "Could not connect to CRM API — check your API key and base URL" },
      { status: 400 }
    );
  }

  const encrypted = await encryptTokens({ apiKey, baseUrl });

  const { data: conn, error: upsertErr } = await svc
    .from("dms_connections")
    .upsert(
      {
        dealership_id: ud.dealership_id,
        provider: "general_crm",
        status: "active",
        encrypted_tokens: encrypted,
        metadata: { baseUrl },
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
    provider: "general_crm",
    jobType: "full",
  }).catch((e) => console.error("[general-crm/connect] Initial sync failed:", e));

  return NextResponse.json({ ok: true, connectionId: conn.id });
}
