/**
 * Resend email client wrapper.
 * Returns null when API key is not configured.
 */
import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    resendClient = new Resend(key);
  }
  return resendClient;
}

export interface EmailSendResult {
  success: boolean;
  provider_id?: string;
  error?: string;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
}): Promise<EmailSendResult> {
  const client = getResendClient();
  if (!client) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const fromName = opts.fromName ?? "AutoCDP";
  const fromEmail = opts.fromEmail ?? "noreply@autocdp.io";

  try {
    const result = await client.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, provider_id: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
