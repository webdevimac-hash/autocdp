import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/customers/[id]/swarm-summary
 *
 * Pulls the customer, their last 10 visits, recent communications, and
 * the open deal (if any), then asks Claude Sonnet to write a tight
 * one-paragraph profile suitable for a sales advisor opening the record.
 *
 * The summary is persisted to customers.swarm_summary so subsequent loads
 * are cheap.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── Auth + scope ─────────────────────────────────────────────────────
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

  // ── Fetch context ────────────────────────────────────────────────────
  // Use the service client to read joined data without juggling RLS hops.
  // We still scope every query by both dealership_id and the customer id,
  // so isolation is preserved at the application layer too.
  const svc = createServiceClient();

  const { data: customer, error: customerErr } = await svc
    .from("customers")
    .select(
      "id, dealership_id, first_name, last_name, email, phone, lifecycle_stage, tags, total_visits, total_spend, last_visit_date, metadata, swarm_summary, swarm_summary_at",
    )
    .eq("id", id)
    .eq("dealership_id", dealershipId)
    .single();

  if (customerErr || !customer) {
    return NextResponse.json(
      { error: "Customer not found" },
      { status: 404 },
    );
  }

  const c = customer as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    lifecycle_stage: string | null;
    tags: string[] | null;
    total_visits: number | null;
    total_spend: number | null;
    last_visit_date: string | null;
    metadata: Record<string, unknown> | null;
    swarm_summary: string | null;
    swarm_summary_at: string | null;
  };

  const [{ data: visits }, { data: comms }] = await Promise.all([
    svc
      .from("visits")
      .select("year, make, model, mileage, visit_date, notes")
      .eq("customer_id", id)
      .eq("dealership_id", dealershipId)
      .order("visit_date", { ascending: false })
      .limit(10),
    svc
      .from("communications")
      .select("channel, status, subject, content, created_at")
      .eq("customer_id", id)
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  // ── Build the prompt ─────────────────────────────────────────────────
  const visitLines =
    (visits ?? [])
      .map(
        (v) =>
          `- ${v.visit_date?.slice(0, 10) ?? "?"} · ${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}${v.mileage ? ` · ${v.mileage} mi` : ""}${v.notes ? ` — ${String(v.notes).slice(0, 120)}` : ""}`,
      )
      .join("\n") || "(no service visits on file)";

  const commLines =
    (comms ?? [])
      .map(
        (c2) =>
          `- ${c2.created_at?.slice(0, 10) ?? "?"} · ${c2.channel} (${c2.status})${c2.subject ? ` · ${c2.subject}` : ""}${c2.content ? ` — ${String(c2.content).slice(0, 120)}` : ""}`,
      )
      .join("\n") || "(no recent communications)";

  const promptUser = `You are the Data agent inside AutoCDP's 5-agent swarm. Write a tight one-paragraph profile (2 - 4 sentences, ~60 - 90 words) of this dealership customer so a sales advisor opening the record can act in 10 seconds.

Customer:
- Name: ${c.first_name ?? ""} ${c.last_name ?? ""}
- Lifecycle stage: ${c.lifecycle_stage ?? "prospect"}
- Tags: ${(c.tags ?? []).join(", ") || "(none)"}
- Total visits: ${c.total_visits ?? 0}
- Total spend: $${Number(c.total_spend ?? 0).toLocaleString()}
- Last visit: ${c.last_visit_date ?? "never"}
- Phone on file: ${c.phone ? "yes" : "no"} · email on file: ${c.email ? "yes" : "no"}

Recent service visits:
${visitLines}

Recent outreach:
${commLines}

Rules:
- Lead with the most decision-relevant fact (e.g. "Lapsed VIP — 2022 Camry owner, last service 9 months ago, no email on file.").
- Mention a concrete next-best-action at the end if obvious.
- No salutations, no headings, no bullet points — one paragraph only.
- Do NOT invent facts. If a field is missing, say so or skip it.`;

  // ── Claude call ──────────────────────────────────────────────────────
  let summary: string;
  let model: string = MODELS.standard;
  try {
    const client = getAnthropicClient();
    const res = await client.messages.create({
      model,
      max_tokens: 250,
      temperature: 0.5,
      messages: [{ role: "user", content: promptUser }],
    });
    const block = res.content[0];
    if (!block || block.type !== "text" || !block.text.trim()) {
      return NextResponse.json(
        { error: "Empty response from model" },
        { status: 502 },
      );
    }
    summary = block.text.trim();
    model = res.model;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to call Anthropic API",
      },
      { status: 502 },
    );
  }

  // ── Persist + audit ──────────────────────────────────────────────────
  await svc
    .from("customers")
    .update({
      swarm_summary: summary,
      swarm_summary_at: new Date().toISOString(),
      swarm_summary_model: model,
    })
    .eq("id", id)
    .eq("dealership_id", dealershipId);

  await svc.from("agent_runs").insert({
    dealership_id: dealershipId,
    agent_type: "data",
    status: "completed",
    output_summary: `Generated swarm summary for customer ${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
    metadata: { customer_id: id, model },
  });

  return NextResponse.json({
    summary,
    model,
    generated_at: new Date().toISOString(),
  });
}
