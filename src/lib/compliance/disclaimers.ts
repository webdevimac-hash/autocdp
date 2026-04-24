/**
 * Compliance disclaimer generator.
 *
 * These strings are VERBATIM legal text required by TCPA, CAN-SPAM, and FTC regulations.
 * DO NOT pass through AI or allow any modification.
 * Always append AFTER message content, AFTER guardrails have run on the main copy.
 *
 * References:
 *   TCPA  — 47 U.S.C. § 227 (SMS/phone marketing)
 *   CAN-SPAM — 15 U.S.C. § 7704 (commercial email)
 *   FTC   — 16 C.F.R. Part 251 (direct mail offers/disclosures)
 */

export interface DisclaimerContext {
  dealershipName: string;
  dealershipPhone?: string | null;
  dealershipAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null;
  /** For email: the unsubscribe URL or "reply UNSUBSCRIBE" fallback. */
  unsubscribeUrl?: string | null;
  /** For email: the email address customers can reply to opt out. */
  replyToEmail?: string | null;
  /** Only true when marketing message (vs. transactional). */
  isMarketing?: boolean;
}

// ── SMS (TCPA) ────────────────────────────────────────────────

/**
 * Verbatim TCPA-compliant SMS footer.
 * Must appear in every marketing SMS to a subscriber list.
 *
 * Per TCPA: must include opt-out instructions in every message.
 * Per CTIA: must include "Msg & data rates may apply."
 */
export function buildSmsDisclaimer(ctx: DisclaimerContext): string {
  return `Reply STOP to opt out. Msg & data rates may apply. ${ctx.dealershipName}${ctx.dealershipPhone ? ` | ${ctx.dealershipPhone}` : ""}.`;
}

// ── Email (CAN-SPAM) ──────────────────────────────────────────

/**
 * Verbatim CAN-SPAM footer required in all commercial email.
 *
 * 15 U.S.C. § 7704(a)(5) requires:
 *   (A) a functioning return email address (or opt-out mechanism)
 *   (B) a physical postal address of the sender
 * The opt-out mechanism must be honored within 10 business days.
 */
export function buildEmailDisclaimerHtml(ctx: DisclaimerContext): string {
  const addr = ctx.dealershipAddress;
  const physicalAddress = addr
    ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(", ")
    : "Contact dealership for physical address";

  const optOutLine = ctx.unsubscribeUrl
    ? `<a href="${ctx.unsubscribeUrl}" style="color:#666;">Unsubscribe</a>`
    : ctx.replyToEmail
    ? `Reply to this email with "UNSUBSCRIBE" to opt out`
    : `Reply to this email with "UNSUBSCRIBE" to opt out`;

  return [
    `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;font-family:sans-serif;line-height:1.5;">`,
    `  <p style="margin:0 0 4px;">${ctx.dealershipName} | ${physicalAddress}</p>`,
    `  <p style="margin:0;">You are receiving this email because you are a customer of ${ctx.dealershipName}.`,
    `  ${optOutLine}. We must honor opt-out requests within 10 business days per CAN-SPAM.</p>`,
    `</div>`,
  ].join("\n");
}

/** Plain-text version for text/plain email parts. */
export function buildEmailDisclaimerText(ctx: DisclaimerContext): string {
  const addr = ctx.dealershipAddress;
  const physicalAddress = addr
    ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(", ")
    : "contact dealership for physical address";

  const optOut = ctx.unsubscribeUrl
    ? `Unsubscribe: ${ctx.unsubscribeUrl}`
    : `Reply to this email with "UNSUBSCRIBE" to opt out.`;

  return [
    `---`,
    `${ctx.dealershipName} | ${physicalAddress}`,
    `You are receiving this email as a customer of ${ctx.dealershipName}. ${optOut}`,
    `Opt-out requests honored within 10 business days.`,
  ].join("\n");
}

// ── Direct mail (FTC / offer disclosure) ─────────────────────

/**
 * Direct mail offer disclaimer.
 * Not required by TCPA (physical mail is exempt) but FTC requires clear offer disclosures.
 * This is appended to the personalized_text as a small-print footer.
 */
export function buildDirectMailDisclaimer(ctx: DisclaimerContext): string {
  return `Offer valid at ${ctx.dealershipName}. See dealer for complete details and eligibility. Not valid with other offers.`;
}

// ── Universal append helper ───────────────────────────────────

/**
 * Appends the appropriate disclaimer to a message.
 * Always call this AFTER guardrails have run — this text is exempt from guardrail scanning.
 */
export function appendDisclaimer(
  content: string,
  channel: "sms" | "email" | "direct_mail",
  ctx: DisclaimerContext
): string {
  if (!ctx.isMarketing) return content;

  switch (channel) {
    case "sms":
      return `${content}\n\n${buildSmsDisclaimer(ctx)}`;

    case "email": {
      // For plain-text email content (no HTML tags), append text footer
      const isHtml = content.includes("<") && content.includes(">");
      if (isHtml) {
        return content + "\n" + buildEmailDisclaimerHtml(ctx);
      }
      return content + "\n\n" + buildEmailDisclaimerText(ctx);
    }

    case "direct_mail":
      // Offer disclaimer only if content contains offer language
      if (/offer|discount|saving|free|special|deal|price/i.test(content)) {
        return content + "\n\n" + buildDirectMailDisclaimer(ctx);
      }
      return content;

    default:
      return content;
  }
}

// ── Opt-out sync helper ───────────────────────────────────────

/**
 * Notify an external provider's opt-out webhook when a customer opts out in AutoCDP.
 * Fires for bidirectional sync (AutoCDP → DealerFunnel).
 * Non-throwing: logs on failure but never blocks the main opt-out flow.
 */
export async function notifyExternalOptOut(
  webhookUrl: string,
  identifiers: { phone?: string | null; email?: string | null },
  secret?: string | null
): Promise<void> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["x-lead-secret"] = secret;

    await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        opt_out: true,
        tcpa_opt_out: true,
        phone: identifiers.phone ?? undefined,
        email: identifiers.email ?? undefined,
        source: "autocdp",
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn("[notifyExternalOptOut] failed to notify external webhook:", err);
  }
}
