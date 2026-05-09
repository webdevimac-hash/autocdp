import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";

// GET — list all templates for the active dealership
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const svc = createServiceClient();
  const { data, error } = await (svc
    .from("campaign_templates")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("is_active", true)
    .order("is_ai_suggested", { ascending: false })
    .order("times_used", { ascending: false })
    .order("created_at", { ascending: false })) as unknown as {
      data: Record<string, unknown>[] | null;
      error: unknown;
    };

  if (error) return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

// POST — save a new template
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const { name, channel, subject, body: templateBody, goal, tone,
          credit_tiers, lifecycle_stages, is_ai_suggested,
          ai_rationale, performance_basis } = body;

  if (!name || !channel || !templateBody) {
    return NextResponse.json({ error: "name, channel, and body are required" }, { status: 400 });
  }

  const svc = createServiceClient();
  type TplInsBuilder = {
    insert: (v: Record<string, unknown>) => { select: () => { single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> } };
  };
  const { data, error } = await ((svc.from("campaign_templates") as unknown as TplInsBuilder)
    .insert({
      dealership_id: dealershipId,
      name,
      channel,
      subject: subject ?? null,
      body: templateBody,
      goal: goal ?? "general",
      tone: tone ?? "friendly",
      credit_tiers: credit_tiers ?? [],
      lifecycle_stages: lifecycle_stages ?? [],
      is_ai_suggested: is_ai_suggested ?? false,
      ai_rationale: ai_rationale ?? null,
      performance_basis: performance_basis ?? null,
      created_by: user.id,
    })
    .select()
    .single());

  if (error) return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  return NextResponse.json({ template: data }, { status: 201 });
}
