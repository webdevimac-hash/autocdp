/**
 * POST /api/leads/reply
 *
 * One-click reply to an inbound conquest lead.
 * Sends the reply via SMS (Twilio) or email (Resend), logs a communication record,
 * and marks the lead as "contacted".
 *
 * Body: { conquest_lead_id, channel: "sms"|"email", message, subject? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://autocdp.com";

async function sendSms(to: string, body: string, fromNumber: string): Promise<{ sid: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Twilio error ${res.status}`);
  }
  return res.json();
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  fromName: string,
  fromEmail: string
): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Resend error ${res.status}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    conquest_lead_id: string;
    channel: "sms" | "email";
    message: string;
    subject?: string;
  };

  const { conquest_lead_id, channel, message, subject } = body;
  if (!conquest_lead_id || !channel || !message) {
    return NextResponse.json({ error: "conquest_lead_id, channel, and message are required" }, { status: 400 });
  }

  const svc = createServiceClient();

  // Auth: confirm user belongs to dealership that owns this lead
  type UdRow = { dealership_id: string } | null;
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  type LeadRow = {
    id: string; dealership_id: string; first_name: string | null; last_name: string | null;
    email: string | null; phone: string | null; status: string;
  } | null;
  const { data: lead } = await svc
    .from("conquest_leads")
    .select("id, dealership_id, first_name, last_name, email, phone, status")
    .eq("id", conquest_lead_id)
    .eq("dealership_id", ud.dealership_id)
    .single() as unknown as { data: LeadRow };

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  type DealershipRow = { id: string; name: string; phone: string | null } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("id, name, phone")
    .eq("id", ud.dealership_id)
    .single() as unknown as { data: DealershipRow };

  let providerId: string | null = null;

  try {
    if (channel === "sms") {
      if (!lead.phone) return NextResponse.json({ error: "Lead has no phone number" }, { status: 422 });
      if (!TWILIO_ACCOUNT_SID) return NextResponse.json({ error: "SMS not configured" }, { status: 503 });
      const smsResult = await sendSms(lead.phone, message, TWILIO_FROM_NUMBER);
      providerId = smsResult.sid;
    } else {
      if (!lead.email) return NextResponse.json({ error: "Lead has no email address" }, { status: 422 });
      if (!RESEND_API_KEY) return NextResponse.json({ error: "Email not configured" }, { status: 503 });
      const fromEmail = `leads@${APP_URL.replace(/https?:\/\//, "").split("/")[0]}`;
      const emailResult = await sendEmail(
        lead.email,
        subject ?? `Follow-up from ${dealership?.name ?? "us"}`,
        `<p>${message.replace(/\n/g, "<br/>")}</p>`,
        dealership?.name ?? "AutoCDP",
        fromEmail
      );
      providerId = emailResult.id;
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }

  // Log communication
  await svc.from("communications").insert({
    dealership_id: ud.dealership_id,
    customer_id: lead.id, // conquest leads use their own id as reference
    campaign_id: null,
    channel,
    status: "sent",
    subject: channel === "email" ? (subject ?? null) : null,
    content: message,
    ai_generated: false,
    provider_id: providerId,
    sent_at: new Date().toISOString(),
  } as never);

  // Mark lead as contacted
  await svc
    .from("conquest_leads")
    .update({ status: "contacted" } as never)
    .eq("id", lead.id);

  return NextResponse.json({ success: true, provider_id: providerId, channel });
}
