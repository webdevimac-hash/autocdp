import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import type { Invoice } from "@/lib/billing/invoices";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const svc = createServiceClient();
  const { data } = await (svc as never as {
    from: (t: string) => { select: (c: string) => { eq: (a: string, b: unknown) => { eq: (a: string, b: unknown) => { single: () => Promise<{ data: Invoice | null }> } } } }
  }).from("invoices").select("*").eq("id", id).eq("dealership_id", dealershipId).single();

  if (!data) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const { data: membership } = await supabase
    .from("user_dealerships")
    .select("role")
    .eq("user_id", user.id)
    .eq("dealership_id", dealershipId)
    .single() as { data: { role: string } | null };

  if (!["owner", "admin"].includes(membership?.role ?? "")) {
    return NextResponse.json({ error: "Owner or admin role required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    status?: "paid" | "overdue" | "sent";
    payment_method?: string;
    notes?: string;
  };

  if (body.status && !["paid", "overdue", "sent"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const svc = createServiceClient();
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = { updated_at: now };
  if (body.status) updatePayload.status = body.status;
  if (body.status === "paid") updatePayload.paid_at = now;
  if (body.payment_method) updatePayload.payment_method = body.payment_method;
  if (body.notes !== undefined) updatePayload.notes = body.notes;

  const { data, error: updateErr } = await (svc as never as {
    from: (t: string) => {
      update: (d: unknown) => {
        eq: (a: string, b: unknown) => {
          eq: (a: string, b: unknown) => {
            select: (c: string) => { single: () => Promise<{ data: Invoice | null; error: unknown }> }
          }
        }
      }
    }
  }).from("invoices").update(updatePayload).eq("id", id).eq("dealership_id", dealershipId).select("*").single();

  if (updateErr || !data) return NextResponse.json({ error: "Invoice not found or update failed" }, { status: 404 });
  return NextResponse.json(data);
}
