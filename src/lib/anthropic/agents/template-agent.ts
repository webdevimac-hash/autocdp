/**
 * Template Agent — analyzes campaign performance data and suggests new message templates.
 *
 * Pipeline:
 *   1. Fetch top-performing communications (high open/click rate for email/sms)
 *   2. Fetch top-performing mail pieces (high scan rate for direct mail)
 *   3. Fetch credit tier distribution (if 700Credit connected)
 *   4. Prompt Claude Sonnet to derive patterns and generate fresh templates
 *   5. Return structured template suggestions (not auto-saved — caller decides)
 */

import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";
import { createServiceClient } from "@/lib/supabase/server";

export type TemplateChannel = "direct_mail" | "sms" | "email";
export type TemplateGoal =
  | "service_reminder" | "win_back" | "aged_inventory"
  | "vip_appreciation" | "seasonal" | "financing" | "general";
export type TemplateTone = "friendly" | "urgent" | "premium" | "casual" | "professional";

export interface TemplateSuggestion {
  name: string;
  channel: TemplateChannel;
  subject: string | null;
  body: string;
  goal: TemplateGoal;
  tone: TemplateTone;
  credit_tiers: string[];
  lifecycle_stages: string[];
  ai_rationale: string;
  performance_basis: string;
}

export interface TemplateAgentResult {
  suggestions: TemplateSuggestion[];
  tokensUsed: number;
  performanceSummary: string;
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export async function runTemplateAgent(
  dealershipId: string,
  dealershipName: string,
  channels: TemplateChannel[]
): Promise<TemplateAgentResult> {
  const svc = createServiceClient();
  const client = getAnthropicClient();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Fetch high-performing email + SMS communications ──────
  type CommRow = { channel: string; status: string; content: string; subject: string | null };
  const { data: commData } = await (svc
    .from("communications")
    .select("channel, status, content, subject")
    .eq("dealership_id", dealershipId)
    .in("status", ["opened", "clicked", "converted"])
    .gte("created_at", ninetyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(60)) as unknown as { data: CommRow[] | null };

  const commRows = commData ?? [];

  // ── 2. Fetch high-performing mail pieces ─────────────────────
  type MailRow = { personalized_text: string; scanned_count: number };
  const { data: mailData } = await (svc
    .from("mail_pieces")
    .select("personalized_text, scanned_count")
    .eq("dealership_id", dealershipId)
    .gt("scanned_count", 0)
    .gte("created_at", ninetyDaysAgo)
    .order("scanned_count", { ascending: false })
    .limit(30)) as unknown as { data: MailRow[] | null };

  const mailRows = mailData ?? [];

  // ── 3. Credit tier distribution ──────────────────────────────
  type CustRow = { metadata: Record<string, unknown> | null };
  const { data: custData } = await (svc
    .from("customers")
    .select("metadata")
    .eq("dealership_id", dealershipId)
    .not("metadata", "is", null)
    .limit(5000)) as unknown as { data: CustRow[] | null };

  const tierCounts: Record<string, number> = { excellent: 0, good: 0, fair: 0, poor: 0, unknown: 0 };
  for (const c of custData ?? []) {
    const tier = (c.metadata?.credit_tier as string | undefined) ?? "unknown";
    if (tier in tierCounts) tierCounts[tier]++;
    else tierCounts.unknown++;
  }
  const totalWithTier = Object.values(tierCounts).reduce((s, n) => s + n, 0);
  const hasCreditData = totalWithTier > 0 && tierCounts.unknown < totalWithTier;

  // ── 4. Format context for prompt ────────────────────────────
  const emailExamples = commRows
    .filter((c) => c.channel === "email")
    .slice(0, 10)
    .map((c, i) =>
      `Email ${i + 1}${c.subject ? ` (subject: "${c.subject}")` : ""}:\n${c.content.slice(0, 250)}`
    );

  const smsExamples = commRows
    .filter((c) => c.channel === "sms")
    .slice(0, 8)
    .map((c, i) => `SMS ${i + 1}: ${c.content.slice(0, 160)}`);

  const mailExamples = mailRows
    .slice(0, 10)
    .map((m, i) =>
      `Mail ${i + 1} (${m.scanned_count} scans):\n${m.personalized_text.slice(0, 300)}`
    );

  const creditSection = hasCreditData
    ? `\nCREDIT TIER DISTRIBUTION (700Credit data):\n` +
      Object.entries(tierCounts)
        .filter(([, n]) => n > 0)
        .map(([tier, n]) => `  ${tier}: ${n} customers (${Math.round((n / totalWithTier) * 100)}%)`)
        .join("\n") +
      `\nUse this to create tier-specific templates where financing/offer framing matters.\n`
    : "";

  const channelList = channels.join(", ");
  const perChannel = channels.length === 1 ? "3-4" : `2-3 per channel`;

  const prompt =
    `You are a dealership marketing strategist for ${dealershipName}. Analyze these high-performing ` +
    `messages and generate ${perChannel} new templates for: ${channelList}.\n\n` +

    (emailExamples.length > 0
      ? `HIGH-PERFORMING EMAIL EXAMPLES (opened/clicked):\n${emailExamples.join("\n---\n")}\n\n`
      : "") +
    (smsExamples.length > 0
      ? `HIGH-PERFORMING SMS EXAMPLES (clicked):\n${smsExamples.join("\n---\n")}\n\n`
      : "") +
    (mailExamples.length > 0
      ? `HIGH-PERFORMING DIRECT MAIL EXAMPLES (QR scanned):\n${mailExamples.join("\n---\n")}\n\n`
      : "No high-performing mail examples yet — generate templates based on best practices.\n\n") +
    creditSection +

    `TEMPLATE BODY RULES:\n` +
    `- Use {firstName}, {vehicle}, {advisorName}, {phone}, {offer}, {mileage} as placeholders\n` +
    `- Direct mail: 55–80 words, 3-4 paragraphs, handwritten advisory tone, start with "{firstName},"\n` +
    `- SMS: under 140 chars, conversational, clear CTA\n` +
    `- Email: 100–200 words, warm subject line, paragraph structure\n` +
    `- Do NOT include any opt-out or unsubscribe text (appended automatically)\n` +
    `- credit_tiers: empty array = all tiers; otherwise specify which tiers this offer suits\n` +
    `- lifecycle_stages: empty = all; values: "vip", "active", "at_risk", "lapsed", "prospect"\n\n` +

    `Respond with ONLY valid JSON:\n` +
    `{\n` +
    `  "performance_summary": "2-3 sentences on what patterns make these messages successful",\n` +
    `  "suggestions": [\n` +
    `    {\n` +
    `      "name": "Template name (5-8 words)",\n` +
    `      "channel": "direct_mail|sms|email",\n` +
    `      "subject": "Email subject line or null",\n` +
    `      "body": "Full template body with {placeholders}",\n` +
    `      "goal": "service_reminder|win_back|aged_inventory|vip_appreciation|seasonal|financing|general",\n` +
    `      "tone": "friendly|urgent|premium|casual|professional",\n` +
    `      "credit_tiers": [],\n` +
    `      "lifecycle_stages": [],\n` +
    `      "ai_rationale": "Why this template, what pattern it leverages",\n` +
    `      "performance_basis": "Which specific examples or patterns inspired this"\n` +
    `    }\n` +
    `  ]\n` +
    `}`;

  const resp = await client.messages.create({
    model: MODELS.standard,
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const tokensUsed = resp.usage.input_tokens + resp.usage.output_tokens;
  const raw = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  const parsed = JSON.parse(raw) as {
    performance_summary: string;
    suggestions: TemplateSuggestion[];
  };

  return {
    suggestions: parsed.suggestions ?? [],
    tokensUsed,
    performanceSummary: parsed.performance_summary ?? "",
  };
}
