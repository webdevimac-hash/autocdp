import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET  /api/newsletter  → list newsletters for current dealership
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc.from("user_dealerships").select("dealership_id").eq("user_id", user.id).single();
  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc as any)
    .from("newsletters")
    .select("id, subject, preview_text, status, sent_at, recipient_count, created_at, updated_at")
    .eq("dealership_id", ud.dealership_id)
    .order("created_at", { ascending: false })
    .limit(24);

  return NextResponse.json({ newsletters: data ?? [] });
}

// POST /api/newsletter  → create a draft newsletter
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc.from("user_dealerships").select("dealership_id").eq("user_id", user.id).single();
  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const body = await req.json() as { subject: string; preview_text?: string; sections?: unknown[] };
  if (!body.subject?.trim()) return NextResponse.json({ error: "subject is required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: insertErr } = await (svc as any)
    .from("newsletters")
    .insert({
      dealership_id: ud.dealership_id,
      subject:       body.subject.trim(),
      preview_text:  body.preview_text?.trim() ?? null,
      sections:      body.sections ?? [],
      status:        "draft",
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ newsletter: data }, { status: 201 });
}
