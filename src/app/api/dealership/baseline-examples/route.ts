/**
 * GET  /api/dealership/baseline-examples — list all examples for the authenticated dealership
 * POST /api/dealership/baseline-examples — bulk-upload one or more past mail examples
 * DELETE /api/dealership/baseline-examples?id=<uuid> — remove a single example
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

type ExampleRow = {
  id: string;
  dealership_id: string;
  example_text: string;
  mail_type: string | null;
  date_sent: string | null;
  notes: string | null;
  created_at: string;
};

async function getDealershipId(userId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", userId)
    .maybeSingle() as unknown as { data: { dealership_id: string } | null };
  return data?.dealership_id ?? null;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership found" }, { status: 404 });

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("baseline_mail_examples")
    .select("id, example_text, mail_type, date_sent, notes, created_at")
    .eq("dealership_id", dealershipId)
    .order("created_at", { ascending: false })
    .limit(100) as unknown as { data: ExampleRow[] | null; error: unknown };

  if (error) return NextResponse.json({ error: "Failed to load examples" }, { status: 500 });

  return NextResponse.json({ examples: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Accept either a single example object or an array
  const items: Array<{ example_text: string; mail_type?: string; date_sent?: string; notes?: string }> =
    Array.isArray(body) ? body : [body as Record<string, unknown>];

  if (!items.length) return NextResponse.json({ error: "No examples provided" }, { status: 400 });

  const rows = items
    .filter((item) => typeof item?.example_text === "string" && item.example_text.trim().length > 0)
    .map((item) => ({
      dealership_id: dealershipId,
      example_text: item.example_text.trim(),
      mail_type: item.mail_type?.trim() ?? null,
      date_sent: item.date_sent ?? null,
      notes: item.notes?.trim() ?? null,
    }));

  if (!rows.length) return NextResponse.json({ error: "example_text is required for all items" }, { status: 400 });

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("baseline_mail_examples")
    .insert(rows as never)
    .select("id, example_text, mail_type, date_sent, notes, created_at") as unknown as { data: ExampleRow[] | null; error: unknown };

  if (error) return NextResponse.json({ error: "Failed to save examples" }, { status: 500 });

  return NextResponse.json({ inserted: data?.length ?? 0, examples: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership found" }, { status: 404 });

  const svc = createServiceClient();
  await svc
    .from("baseline_mail_examples")
    .delete()
    .eq("id", id)
    .eq("dealership_id", dealershipId);

  return NextResponse.json({ deleted: true });
}
