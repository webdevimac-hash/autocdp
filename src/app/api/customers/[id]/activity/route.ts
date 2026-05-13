import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";

export const dynamic = "force-dynamic";

const ACTIVITY_TYPES = [
  "note",
  "call",
  "email",
  "text",
  "video",
  "task",
  "appt",
  "system",
] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

const PLANNED_TYPES = new Set<ActivityType>(["task", "appt"]);

/**
 * GET /api/customers/[id]/activity
 * Returns up to 200 activity rows for the customer, newest first.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json(
      { error: "No active dealership" },
      { status: 403 },
    );
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("customer_activity")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

/**
 * POST /api/customers/[id]/activity
 * Body: { type, title?, body?, planned?, metadata? }
 *
 * Used by the customer detail panel for notes, call logs, task/appt
 * creation, AI drafts, etc. — anything that isn't a real send through
 * SMS/email/direct mail (those still go to the `communications` table).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json(
      { error: "No active dealership" },
      { status: 403 },
    );
  }

  const payload = (await req.json().catch(() => ({}))) as {
    type?: string;
    title?: string;
    body?: string;
    planned?: boolean;
    metadata?: Record<string, unknown>;
  };

  if (
    !payload.type ||
    !(ACTIVITY_TYPES as readonly string[]).includes(payload.type)
  ) {
    return NextResponse.json(
      {
        error: `Invalid type. Must be one of: ${ACTIVITY_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const type = payload.type as ActivityType;
  const planned = payload.planned ?? PLANNED_TYPES.has(type);
  const title = (payload.title ?? defaultTitle(type)).slice(0, 200);
  const bodyText = (payload.body ?? "").slice(0, 4000);

  const svc = createServiceClient();

  // Verify customer scope before insert.
  const { data: existing } = await svc
    .from("customers")
    .select("id")
    .eq("id", id)
    .eq("dealership_id", dealershipId)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { data, error } = await svc
    .from("customer_activity")
    .insert({
      dealership_id: dealershipId,
      customer_id: id,
      user_id: user.id,
      type,
      title,
      body: bodyText || null,
      planned,
      metadata: payload.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

function defaultTitle(t: ActivityType): string {
  switch (t) {
    case "note":
      return "Note";
    case "call":
      return "Call logged";
    case "email":
      return "Email";
    case "text":
      return "Text message";
    case "video":
      return "Personalized video";
    case "task":
      return "Task";
    case "appt":
      return "Appointment";
    case "system":
      return "System";
  }
}
