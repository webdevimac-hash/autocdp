import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { runTemplateAgent } from "@/lib/anthropic/agents/template-agent";
import type { TemplateChannel } from "@/lib/anthropic/agents/template-agent";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { channels?: string[] };
  const channels = (body.channels ?? ["direct_mail", "sms", "email"]) as TemplateChannel[];

  const svc = createServiceClient();
  const { data: dl } = await svc
    .from("dealerships")
    .select("name")
    .eq("id", dealershipId)
    .single();
  const dealershipName = (dl as { name?: string } | null)?.name ?? "this dealership";

  const result = await runTemplateAgent(dealershipId, dealershipName, channels);

  return NextResponse.json({
    suggestions: result.suggestions,
    performanceSummary: result.performanceSummary,
    tokensUsed: result.tokensUsed,
  });
}
