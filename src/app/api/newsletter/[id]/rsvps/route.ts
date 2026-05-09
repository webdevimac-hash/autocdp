import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc.from("user_dealerships").select("dealership_id").eq("user_id", user.id).single();
  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rsvps } = await (svc as any)
    .from("newsletter_rsvps")
    .select("id, event_key, response, customer_name, responded_at")
    .eq("newsletter_id", id)
    .order("responded_at", { ascending: false });

  return NextResponse.json({ rsvps: rsvps ?? [] });
}
