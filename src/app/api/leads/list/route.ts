/**
 * GET /api/leads/list
 * Returns conquest leads for the current user's dealership.
 * Query params: status (new|contacted|converted|disqualified), limit, offset
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { ConquestLead } from "@/types";

export async function GET(req: NextRequest) {
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

  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const limit = Math.min(parseInt(params.get("limit") ?? "50", 10), 200);
  const offset = parseInt(params.get("offset") ?? "0", 10);

  let query = svc
    .from("conquest_leads")
    .select("*")
    .eq("dealership_id", ud.dealership_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data: leads, error } = await query as unknown as { data: ConquestLead[] | null; error: unknown };

  if (error) {
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }

  return NextResponse.json({ leads: leads ?? [], total: leads?.length ?? 0 });
}
