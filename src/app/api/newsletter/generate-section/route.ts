import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";
import type { NewsletterSectionType } from "@/lib/newsletter/types";

const PROMPTS: Record<NewsletterSectionType, (hint: string, dealer: string) => string> = {
  arrivals: (hint, dealer) =>
    `Write a friendly 2–3 sentence "New Arrivals" blurb for a monthly dealership newsletter from ${dealer}. Context: ${hint}.
Tone: warm, conversational, excited. No hype, no spam words. End with a light invitation to come see them.
Respond with ONLY the paragraph text — no subject line, no label.`,

  service_tip: (hint, dealer) =>
    `Write a helpful, practical service tip for a monthly newsletter from ${dealer}. Context: ${hint}.
Tone: friendly expert, 2–3 sentences. Something a car owner genuinely finds useful.
Respond with ONLY the tip text — no subject line, no label.`,

  event: (hint, dealer) =>
    `Write a warm, inviting event description for a dealership newsletter from ${dealer}. Context: ${hint}.
Tone: welcoming, community-oriented, 2–4 sentences. Make people want to come.
Respond with ONLY the description text — no subject line, no label.`,

  offer: (hint, dealer) =>
    `Write a soft, non-pushy special offer description for a monthly newsletter from ${dealer}. Context: ${hint}.
Tone: appreciative, customer-first, 2–3 sentences. Make it feel like a thank-you, not a sales pitch.
Respond with ONLY the offer description — no subject line, no label.`,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: ud } = await svc.from("user_dealerships").select("dealership_id").eq("user_id", user.id).single();
  if (!ud?.dealership_id) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const { data: dealership } = await svc.from("dealerships").select("name").eq("id", ud.dealership_id).single();
  const dealerName = (dealership as { name: string } | null)?.name ?? "our dealership";

  const body = await req.json() as { sectionType: NewsletterSectionType; hint: string };
  const { sectionType, hint } = body;

  if (!sectionType || !hint?.trim()) {
    return NextResponse.json({ error: "sectionType and hint are required" }, { status: 400 });
  }

  const promptFn = PROMPTS[sectionType];
  if (!promptFn) return NextResponse.json({ error: "Unknown sectionType" }, { status: 400 });

  try {
    const client = getAnthropicClient();
    const resp = await client.messages.create({
      model: MODELS.standard,
      max_tokens: 256,
      messages: [{ role: "user", content: promptFn(hint, dealerName) }],
    });

    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
