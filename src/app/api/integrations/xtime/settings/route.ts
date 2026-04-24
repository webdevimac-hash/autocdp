/**
 * POST /api/integrations/xtime/settings
 * GET  /api/integrations/xtime/settings
 *
 * Saves or retrieves the dealership's X-Time online scheduler URL.
 * The URL is stored in dealership.settings.xtime_url.
 *
 * X-Time is the Reynolds & Reynolds appointment scheduling platform
 * used by many Ford, GM, Toyota, and Stellantis dealers.
 * Typical URL format: https://www.xtime.com/retailer/{dealer_code}/schedule
 * or a custom domain configured by the dealership.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();

  type UdRow = { dealership_id: string } | null;
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  type DealershipRow = { settings: Record<string, unknown> } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("settings")
    .eq("id", ud.dealership_id)
    .single() as unknown as { data: DealershipRow };

  const xtimeUrl = (dealership?.settings?.xtime_url as string | undefined) ?? null;
  return NextResponse.json({ xtime_url: xtimeUrl, configured: !!xtimeUrl });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { xtime_url: string | null };

  // Allow null to clear the URL
  const xtimeUrl = body.xtime_url?.trim() || null;

  // Basic URL validation when set
  if (xtimeUrl) {
    try {
      const parsed = new URL(xtimeUrl);
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("bad protocol");
    } catch {
      return NextResponse.json({ error: "xtime_url must be a valid URL (https://...)" }, { status: 400 });
    }
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

  type DealershipRow = { settings: Record<string, unknown> } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("settings")
    .eq("id", ud.dealership_id)
    .single() as unknown as { data: DealershipRow };

  const newSettings = { ...(dealership?.settings ?? {}), xtime_url: xtimeUrl };

  const { error } = await svc
    .from("dealerships")
    .update({ settings: newSettings } as never)
    .eq("id", ud.dealership_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, xtime_url: xtimeUrl });
}
