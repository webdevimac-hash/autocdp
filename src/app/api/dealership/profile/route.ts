import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UdRow = { dealership_id: string; role: string } | null;
type DealershipRow = Record<string, unknown> | null;

// GET /api/dealership/profile — fetch current dealership profile
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 404 });

  const { data: dealership, error } = await supabase
    .from("dealerships")
    .select("id, name, slug, website_url, logo_url, phone, address, hours, settings")
    .eq("id", ud.dealership_id)
    .single() as unknown as { data: DealershipRow; error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(dealership);
}

// PUT /api/dealership/profile — save dealership profile fields
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id, role")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 404 });
  if (!["owner", "admin"].includes(ud.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, phone, website_url, logo_url, address, hours, settings } = body as {
    name?: string;
    phone?: string;
    website_url?: string;
    logo_url?: string;
    address?: Record<string, string>;
    hours?: Record<string, string>;
    settings?: Record<string, unknown>;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name.trim();
  if (phone !== undefined) updates.phone = phone.trim() || null;
  if (website_url !== undefined) updates.website_url = website_url.trim() || null;
  if (logo_url !== undefined) updates.logo_url = logo_url.trim() || null;
  if (address !== undefined) updates.address = address;
  if (hours !== undefined) updates.hours = hours;
  if (settings !== undefined) updates.settings = settings;

  const { data, error } = await supabase
    .from("dealerships")
    .update(updates as never)
    .eq("id", ud.dealership_id)
    .select("id, name, slug, website_url, logo_url, phone, address, hours, settings")
    .single() as unknown as { data: DealershipRow; error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
