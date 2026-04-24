/**
 * POST /api/voice/announcements
 *
 * AI Voice stub — future phase.
 *
 * When live, this endpoint will:
 *   1. Accept a campaign_id or customer_id + script parameters
 *   2. Generate a personalized announcement script via Claude
 *   3. Synthesize speech via OpenAI Whisper TTS (or ElevenLabs)
 *   4. Initiate an outbound call via Twilio Programmable Voice
 *   5. Play the personalized announcement, then connect to dealership scheduler
 *
 * Current state: stub that returns the generated script only (no call placed).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Customer, Visit } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface VoiceAnnouncementRequest {
  customer_id: string;
  campaign_goal?: string;
  offer?: string;
  /** If provided, references a specific campaign in the announcement */
  campaign_id?: string;
  /** Dealership phone number for callback CTA */
  callback_number?: string;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as VoiceAnnouncementRequest;
  if (!body.customer_id) {
    return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
  }

  const svc = createServiceClient();

  type UdRow = { dealership_id: string } | null;
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: UdRow };

  if (!ud) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  const { data: customer } = await svc
    .from("customers")
    .select("*")
    .eq("id", body.customer_id)
    .eq("dealership_id", ud.dealership_id)
    .single() as unknown as { data: Customer | null };

  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  type DealershipRow = { name: string; phone: string | null } | null;
  const { data: dealership } = await svc
    .from("dealerships")
    .select("name, phone")
    .eq("id", ud.dealership_id)
    .single() as unknown as { data: DealershipRow };

  const { data: visits } = await svc
    .from("visits")
    .select("make, model, year, service_type, visit_date")
    .eq("customer_id", body.customer_id)
    .order("visit_date", { ascending: false })
    .limit(1) as unknown as { data: Partial<Visit>[] | null };

  const lastVisit = visits?.[0];
  const callbackNumber = body.callback_number ?? dealership?.phone ?? "";

  // Generate personalized script via Claude
  const completion = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Write a short, natural-sounding voicemail announcement (30–45 seconds when read aloud) for an automotive dealership.

Dealership: ${dealership?.name ?? "us"}
Customer: ${customer.first_name}
Last vehicle serviced: ${lastVisit ? `${lastVisit.year ?? ""} ${lastVisit.make ?? ""} ${lastVisit.model ?? ""}`.trim() : "unknown"}
Campaign goal: ${body.campaign_goal ?? "service reminder"}
Offer: ${body.offer ?? "no specific offer"}
Callback number: ${callbackNumber}

Requirements:
- Friendly, personal tone — not robotic
- Mention the customer's first name once at the start
- Reference their vehicle if known
- Include the offer naturally
- End with the callback number spoken clearly
- Do NOT include stage directions, pauses, or [brackets]
- Plain text only — this will be spoken by TTS`,
      },
    ],
  });

  const script = (completion.content[0] as { type: string; text: string }).text.trim();

  return NextResponse.json({
    success: true,
    script,
    customer: {
      id: customer.id,
      name: `${customer.first_name} ${customer.last_name}`,
      phone: customer.phone,
    },
    estimated_duration_seconds: Math.round(script.split(" ").length / 2.5),
    status: "stub",
    note: "AI Voice is in future-phase planning. Script generated but no call placed. Integrate Twilio Programmable Voice + OpenAI TTS to activate.",
    future_steps: [
      "POST script to OpenAI /v1/audio/speech (tts-1-hd, voice: nova or alloy) → mp3",
      "Upload mp3 to Supabase Storage → public URL",
      "POST to Twilio /Calls with Twiml: <Play>{url}</Play><Gather> for scheduler",
      "Handle Twilio webhook for key-press scheduler connection",
    ],
  });
}
