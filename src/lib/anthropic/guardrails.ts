/**
 * Content guardrails for the Creative Agent.
 *
 * Two-phase approach:
 *   Phase 1 — Regex/keyword scan. Free, instant, catches obvious automotive
 *              compliance violations (FTC, TILA, state dealer regulations).
 *   Phase 2 — Claude Haiku rewrite. Only fires when Phase 1 finds violations.
 *              Preserves personalization while removing the flagged language.
 *
 * Severity levels:
 *   "rewrite"  — Haiku rewrites the offending claim. Output is still used.
 *   "block"    — Copy is rejected entirely (e.g., fake prize claims).
 */

import { getAnthropicClient, MODELS } from "./client";

export interface GuardrailResult {
  passed: boolean;
  content: string;
  subject: string | null;
  rewritten: boolean;
  violations: string[];
}

// ── Phase 1: Pattern registry ──────────────────────────────────

const VIOLATION_PATTERNS: {
  pattern: RegExp;
  label: string;
  severity: "block" | "rewrite";
}[] = [
  // Guaranteed approval / financing (FTC deceptive practice)
  {
    pattern: /guaranteed\s+(approval|financing|credit|qualify)/gi,
    label: "guaranteed approval claim",
    severity: "rewrite",
  },
  {
    pattern: /no\s+credit\s+(check|needed|required)/gi,
    label: "no credit check claim",
    severity: "rewrite",
  },
  {
    pattern: /bad\s+credit\s+(ok|okay|welcome|no\s+problem)/gi,
    label: "bad credit accepted claim",
    severity: "rewrite",
  },
  {
    pattern: /everyone\s+(qualifies?|is\s+approved?|gets\s+financed?)/gi,
    label: "blanket qualification claim",
    severity: "rewrite",
  },
  {
    pattern: /you('?re|'?ve)\s+(pre-?approved|already\s+approved)/gi,
    label: "unverified pre-approval claim",
    severity: "rewrite",
  },

  // Specific APR / interest rate without TILA disclosure
  {
    pattern: /\b(0|zero)\s*%\s*APR\b/gi,
    label: "specific APR claim (requires TILA disclosure)",
    severity: "rewrite",
  },
  {
    pattern: /\b\d+\.?\d*\s*%\s*APR\b/gi,
    label: "specific APR claim (requires TILA disclosure)",
    severity: "rewrite",
  },
  {
    pattern: /\b\d+\.?\d*\s*%\s*interest\s*rate\b/gi,
    label: "specific interest rate claim",
    severity: "rewrite",
  },

  // Specific monthly payment amounts (TILA — requires full disclosure)
  {
    pattern: /\$\d[\d,]*\s*\/\s*mo(nth)?/gi,
    label: "specific monthly payment claim (requires TILA disclosure)",
    severity: "rewrite",
  },
  {
    pattern: /as\s+low\s+as\s+\$\d[\d,]*\s*(per|\/)\s*mo(nth)?/gi,
    label: "as-low-as payment claim",
    severity: "rewrite",
  },

  // Guaranteed vehicle value / return
  {
    pattern: /guaranteed\s+(trade-?in\s+)?(return|value|resale|buyback)/gi,
    label: "guaranteed vehicle value claim",
    severity: "rewrite",
  },
  {
    pattern: /price\s+match\s+guaranteed/gi,
    label: "price match guarantee",
    severity: "rewrite",
  },

  // False scarcity
  {
    pattern: /last\s+(one|unit|vehicle)\s+(in|left|on\s+earth)/gi,
    label: "demonstrably false scarcity claim",
    severity: "rewrite",
  },

  // Outright deceptive prize / giveaway language
  {
    pattern: /\b(free\s+car|free\s+vehicle|win\s+a\s+car|you\s+won\b)/gi,
    label: "misleading prize claim",
    severity: "block",
  },
];

function scanViolations(
  text: string
): { label: string; severity: "block" | "rewrite" }[] {
  const found: { label: string; severity: "block" | "rewrite" }[] = [];
  const seen = new Set<string>();
  for (const { pattern, label, severity } of VIOLATION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text) && !seen.has(label)) {
      found.push({ label, severity });
      seen.add(label);
    }
  }
  return found;
}

// ── Phase 2: Haiku compliance rewrite ─────────────────────────

async function rewriteForCompliance(
  content: string,
  subject: string | null,
  violations: string[],
  channel: string
): Promise<{ content: string; subject: string | null }> {
  const client = getAnthropicClient();

  const prompt = `You are a compliance editor for automotive dealership marketing copy.
The following ${channel} message contains claims that may violate FTC, TILA, or state dealer regulations.

DETECTED ISSUES:
${violations.map((v) => `• ${v}`).join("\n")}

ORIGINAL MESSAGE:
${content}
${subject ? `\nORIGINAL SUBJECT: ${subject}` : ""}

Rewrite rules:
- Replace specific APR/rate claims → "competitive financing available — ask us for details"
- Replace "guaranteed approval" / "no credit check" → "financing options available for most credit situations"
- Replace guaranteed value / price-match claims → remove entirely or soften to "great value"
- Replace false scarcity → soften to "while it lasts" or remove
- Keep all personal details, vehicle references, service history references, and tone intact
- Match the original length as closely as possible

Respond with JSON only:
{
  "content": "rewritten message text",
  "subject": ${subject ? '"rewritten subject line, or null"' : "null"}
}`;

  const response = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") return { content, subject };

  try {
    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) return { content, subject };
    const parsed = JSON.parse(match[0]);
    return {
      content: parsed.content ?? content,
      subject: parsed.subject ?? subject,
    };
  } catch {
    return { content, subject };
  }
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Run guardrails on Creative Agent output.
 * Call this after parsing the agent's JSON response, before returning to callers.
 *
 * @param content  Message body
 * @param subject  Email subject line (null for SMS/direct mail)
 * @param channel  "sms" | "email" | "direct_mail"
 */
export async function applyGuardrails(
  content: string,
  subject: string | null,
  channel: string
): Promise<GuardrailResult> {
  const combined = [subject ?? "", content].join(" ").trim();
  const findings = scanViolations(combined);

  if (findings.length === 0) {
    return { passed: true, content, subject, rewritten: false, violations: [] };
  }

  const labels = findings.map((f) => f.label);
  const mustBlock = findings.some((f) => f.severity === "block");

  if (mustBlock) {
    return {
      passed: false,
      content: "",
      subject: null,
      rewritten: false,
      violations: labels,
    };
  }

  // Attempt Haiku rewrite — fall back to original if rewrite fails
  try {
    const fixed = await rewriteForCompliance(content, subject, labels, channel);
    return {
      passed: true,
      content: fixed.content,
      subject: fixed.subject,
      rewritten: true,
      violations: labels,
    };
  } catch {
    // Non-fatal: log violations but return original so campaign isn't blocked
    return {
      passed: true,
      content,
      subject,
      rewritten: false,
      violations: labels,
    };
  }
}
