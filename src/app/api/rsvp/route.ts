import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseRsvpToken } from "@/lib/newsletter/template";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://autocdp.com").replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const token    = req.nextUrl.searchParams.get("t") ?? "";
  const response = req.nextUrl.searchParams.get("r");

  if (!token || (response !== "yes" && response !== "no")) {
    return NextResponse.redirect(`${APP_URL}/rsvp/thanks?r=invalid`);
  }

  const parsed = parseRsvpToken(token);
  if (!parsed) return NextResponse.redirect(`${APP_URL}/rsvp/thanks?r=invalid`);

  const { newsletterId, customerId, eventKey } = parsed;

  try {
    const svc = createServiceClient();

    // Load customer name for the confirmation
    const { data: customer } = await svc
      .from("customers")
      .select("first_name, last_name, email")
      .eq("id", customerId)
      .single();

    const customerName  = customer ? `${(customer as { first_name: string; last_name: string }).first_name} ${(customer as { first_name: string; last_name: string }).last_name}` : null;
    const customerEmail = (customer as { email?: string | null } | null)?.email ?? null;

    // Upsert RSVP (one response per customer per event_key)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc as any)
      .from("newsletter_rsvps")
      .upsert(
        {
          newsletter_id:  newsletterId,
          customer_id:    customerId,
          event_key:      eventKey,
          response,
          customer_name:  customerName,
          customer_email: customerEmail,
          responded_at:   new Date().toISOString(),
        },
        { onConflict: "newsletter_id,customer_id,event_key" }
      );
  } catch {
    // Don't block redirect on DB error
  }

  return NextResponse.redirect(`${APP_URL}/rsvp/thanks?r=${response}`);
}
