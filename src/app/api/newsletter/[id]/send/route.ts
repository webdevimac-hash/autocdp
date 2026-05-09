import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail, isResendConfigured } from "@/lib/resend-client";
import { renderNewsletterHtml } from "@/lib/newsletter/template";
import { injectEmailTracking } from "@/lib/tracking";
import type { NewsletterSection } from "@/lib/newsletter/types";

const MONTH_LABELS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export async function POST(
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

  // Load newsletter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: nl } = await (svc as any)
    .from("newsletters")
    .select("*")
    .eq("id", id)
    .eq("dealership_id", ud.dealership_id)
    .single() as { data: { id: string; subject: string; preview_text: string | null; sections: NewsletterSection[]; status: string } | null };

  if (!nl) return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
  if (nl.status === "sent") return NextResponse.json({ error: "Already sent" }, { status: 400 });

  if (!isResendConfigured()) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 400 });
  }

  // Load dealership
  const { data: dealership } = await svc
    .from("dealerships")
    .select("name")
    .eq("id", ud.dealership_id)
    .single();
  const dealershipName = (dealership as { name: string } | null)?.name ?? "Your Dealership";

  // Mark as sending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any).from("newsletters").update({ status: "sending" }).eq("id", id);

  // Load customers with email addresses (skip opted-out)
  const { data: customers } = await svc
    .from("customers")
    .select("id, first_name, email")
    .eq("dealership_id", ud.dealership_id)
    .not("email", "is", null)
    .not("email", "eq", "");

  const eligible = (customers ?? []).filter(
    (c) => !(c as { email?: string | null }).email?.includes("test+")
  );

  const month = `${MONTH_LABELS[new Date().getMonth()]} ${new Date().getFullYear()}`;
  let sent = 0;

  for (const customer of eligible) {
    try {
      const cust = customer as { id: string; first_name: string; email: string };

      // Create communication record
      const { data: comm } = await svc
        .from("communications")
        .insert({
          dealership_id: ud.dealership_id,
          customer_id:   cust.id,
          channel:       "email",
          status:        "pending",
          subject:       nl.subject,
          content:       `[Newsletter: ${nl.subject}]`,
          ai_generated:  false,
          created_by:    user.id,
        })
        .select("id")
        .single();

      if (!comm?.id) continue;

      const html = renderNewsletterHtml({
        dealershipName,
        customerFirstName: cust.first_name,
        subject:     nl.subject,
        previewText: nl.preview_text ?? `Your ${month} update from ${dealershipName}`,
        sections:    nl.sections,
        newsletterId: id,
        customerId:  cust.id,
        month,
      });

      const trackedHtml = injectEmailTracking(html, comm.id);

      const result = await sendEmail({
        to:       cust.email,
        subject:  nl.subject,
        html:     trackedHtml,
        fromName: dealershipName,
      });

      await svc.from("communications").update({
        status:      result.success ? "sent" : "failed",
        provider_id: result.provider_id ?? null,
        sent_at:     result.success ? new Date().toISOString() : null,
      }).eq("id", comm.id);

      if (result.success) sent++;
    } catch {
      // best-effort: continue on individual failure
    }
  }

  // Mark sent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any).from("newsletters").update({
    status:          "sent",
    sent_at:         new Date().toISOString(),
    recipient_count: sent,
  }).eq("id", id);

  return NextResponse.json({ sent, total: eligible.length });
}
