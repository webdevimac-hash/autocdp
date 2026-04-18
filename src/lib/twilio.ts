/**
 * Twilio SMS client wrapper.
 * Returns null when credentials are not configured so callers can degrade gracefully.
 */

let twilioClient: ReturnType<typeof import("twilio")> | null = null;

function getTwilioClient() {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return null;
    // Dynamic require so the module is only loaded when credentials exist
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require("twilio") as typeof import("twilio");
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

export interface SmsSendResult {
  success: boolean;
  provider_id?: string;
  error?: string;
}

export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    return { success: false, error: "TWILIO_PHONE_NUMBER not configured" };
  }

  const client = getTwilioClient();
  if (!client) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  try {
    const msg = await client.messages.create({ to, from, body });
    return { success: true, provider_id: msg.sid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}
