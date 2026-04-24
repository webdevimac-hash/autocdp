/**
 * POST /api/integrations/dealerfunnel/settings
 * Saves per-dealership DealerFunnel webhook secret into dealership.settings.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { inbound_lead_secret?: string };
  if (!body.inbound_lead_secret?.trim()) {
    return NextResponse.json({ error: "inbound_lead_secret is required" }, { status: 400 });
  }

  const svc = createServiceClient();

  type UdRow = { dealership_id: string; role: string } | null;
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id, role")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud || ud.role === "member") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Merge into existing settings
  type DealershipRow = { settings: Record<string, unknown> } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("settings")
    .eq("id", ud.dealership_id)
    .single() as unknown as { data: DealershipRow };

  const newSettings = {
    ...(dealership?.settings ?? {}),
    inbound_lead_secret: body.inbound_lead_secret.trim(),
  };

  const { error } = await svc
    .from("dealerships")
    .update({ settings: newSettings } as never)
    .eq("id", ud.dealership_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
