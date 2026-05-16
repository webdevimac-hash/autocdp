/**
 * PATCH /api/integrations/vinsolutions/plugin-mode
 *
 * Enables or disables Plugin Mode (write-back) for VinSolutions.
 * Body: { enabled: boolean }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const PROVIDER = "vinsolutions";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };
  if (!ud?.dealership_id) return NextResponse.json({ error: "Dealership not found" }, { status: 404 });

  // Merge plugin_mode into existing metadata — preserve other keys
  const { data: existing } = await svc
    .from("dms_connections")
    .select("metadata")
    .eq("dealership_id", ud.dealership_id)
    .eq("provider", PROVIDER)
    .maybeSingle() as unknown as { data: { metadata: Record<string, unknown> } | null };

  const merged = {
    ...(existing?.metadata ?? {}),
    plugin_mode: body.enabled,
  };

  const { error } = await svc
    .from("dms_connections")
    .update({ metadata: merged })
    .eq("dealership_id", ud.dealership_id)
    .eq("provider", PROVIDER) as unknown as { error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, provider: PROVIDER, plugin_mode: body.enabled });
}
