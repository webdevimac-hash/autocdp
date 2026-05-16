/**
 * GET  /api/dm/approvals        — List pending approvals for the dealership
 * POST /api/dm/approvals/[id]/approve  — Approve a recommendation
 * POST /api/dm/approvals/[id]/reject   — Reject a recommendation
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  const { data } = await svc
    .from("dm_approvals" as never)
    .select("*" as never)
    .eq("dealership_id" as never, ud.dealership_id as never)
    .eq("status" as never, status as never)
    .order("created_at" as never, { ascending: false })
    .limit(20) as unknown as { data: unknown[] | null };

  return NextResponse.json({ approvals: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 404 });

  const body = await req.json() as { id?: string; action?: "approve" | "reject" };

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "id and action (approve|reject) are required" }, { status: 400 });
  }

  const newStatus = body.action === "approve" ? "approved" : "rejected";

  const { error } = await svc
    .from("dm_approvals" as never)
    .update({
      status:        newStatus,
      responded_by:  user.email ?? user.id,
      responded_at:  new Date().toISOString(),
    } as never)
    .eq("id" as never, body.id as never)
    .eq("dealership_id" as never, ud.dealership_id as never);

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });

  // If approved, immediately trigger the digital marketing agent in execute mode
  if (newStatus === "approved") {
    // Fire-and-forget: execute the approved action
    void fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com"}/api/agents/digital-marketing`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: req.headers.get("cookie") ?? "" },
        body: JSON.stringify({
          mode:              "execute",
          allowExecute:      true,
          approvedActionIds: [body.id],
        }),
      }
    ).catch((e) => console.error("[dm/approvals] Execute trigger failed:", e));
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
