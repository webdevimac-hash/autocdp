/**
 * send_sms — Anthropic tool implementation.
 *
 * Called by the Orchestrator when Claude decides to send an SMS.
 * Writes to the `communications` table, calls Twilio, records billing.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { sendSms, isTwilioConfigured } from "@/lib/twilio";
import { recordBillingEvent } from "@/lib/billing/metering";
import { buildSmsTrackingUrl } from "@/lib/tracking";
import type { Customer } from "@/types";

// ── Tool definition for Anthropic SDK ────────────────────────

export const SEND_SMS_TOOL_DEFINITION = {
  name: "send_sms",
  description: `Send a personalized SMS message to a customer via Twilio.
Use when the campaign channel is SMS and you have written the message body.
Max 160 characters. The tool handles delivery tracking and billing automatically.`,
  input_schema: {
    type: "object" as const,
    properties: {
      customer_id: {
        type: "string",
        description: "UUID of the customer to text (must belong to current dealership)",
      },
      message: {
        type: "string",
        description: "SMS body. Max 160 characters. Conversational, first name included. No HTML.",
      },
    },
    required: ["customer_id", "message"],
  },
} as const;

// ── Tool types ─────────────────────────────────────────────────

export interface SendSmsToolInput {
  customer_id: string;
  message: string;
}

export interface SendSmsToolResult {
  success: boolean;
  communication_id?: string;
  provider_id?: string;
  message: string;
  error?: string;
}

export interface SendSmsContext {
  dealershipId: string;
  campaignId?: string;
  createdBy?: string;
  dryRun?: boolean;
}

// ── Executor ───────────────────────────────────────────────────

export async function executeSendSmsTool(
  input: SendSmsToolInput,
  context: SendSmsContext
): Promise<SendSmsToolResult> {
  const supabase = createServiceClient();

  try {
    const { data: customer, error: customerErr } = await supabase
      .from("customers")
      .select("first_name, last_name, phone")
      .eq("id", input.customer_id)
      .eq("dealership_id", context.dealershipId)
      .single();

    if (customerErr || !customer) {
      return {
        success: false,
        message: `Customer ${input.customer_id} not found`,
        error: "CUSTOMER_NOT_FOUND",
      };
    }

    const rawPhone = (customer as Pick<Customer, "first_name" | "last_name" | "phone">).phone;
    if (!rawPhone) {
      return {
        success: false,
        message: `Customer ${customer.first_name} ${customer.last_name} has no phone number`,
        error: "NO_PHONE",
      };
    }
    // Defensive E.164 normalisation — handles legacy rows stored before the
    // onboard/upload fix that saved 10-digit strings without the +1 prefix.
    const digits = rawPhone.replace(/\D/g, "");
    const phone =
      rawPhone.startsWith("+") ? rawPhone
      : digits.length === 11 && digits.startsWith("1") ? `+${digits}`
      : digits.length === 10 ? `+1${digits}`
      : rawPhone; // pass through unchanged; Twilio will surface a clear error

    // Insert communication record
    const { data: comm, error: insertErr } = await supabase
      .from("communications")
      .insert({
        dealership_id: context.dealershipId,
        customer_id: input.customer_id,
        campaign_id: context.campaignId ?? null,
        channel: "sms",
        status: "pending",
        content: input.message,
        ai_generated: true,
        created_by: context.createdBy ?? null,
      })
      .select()
      .single();

    if (insertErr || !comm) {
      return {
        success: false,
        message: `DB insert failed: ${insertErr?.message}`,
        error: "DB_INSERT_FAILED",
      };
    }

    // Dry run — skip Twilio call
    if (context.dryRun) {
      return {
        success: true,
        communication_id: comm.id,
        message: `[DRY RUN] Would send SMS to ${customer.first_name} ${customer.last_name} (${phone})`,
      };
    }

    if (!isTwilioConfigured()) {
      await supabase.from("communications").update({ status: "failed" }).eq("id", comm.id);
      return {
        success: false,
        communication_id: comm.id,
        message: "Twilio is not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to .env.local",
        error: "TWILIO_NOT_CONFIGURED",
      };
    }

    const trackingUrl = buildSmsTrackingUrl(comm.id);
    const messageWithLink = `${input.message}\n${trackingUrl}`;

    const smsResult = await sendSms(phone, messageWithLink);

    await supabase.from("communications").update({
      status: smsResult.success ? "sent" : "failed",
      provider_id: smsResult.provider_id ?? null,
      sent_at: smsResult.success ? new Date().toISOString() : null,
    }).eq("id", comm.id);

    if (smsResult.success) {
      await recordBillingEvent(context.dealershipId, "sms_sent", 1, {
        communication_id: comm.id,
        customer_id: input.customer_id,
        provider_id: smsResult.provider_id,
      });
    }

    return {
      success: smsResult.success,
      communication_id: comm.id,
      provider_id: smsResult.provider_id,
      message: smsResult.success
        ? `✓ SMS sent to ${customer.first_name} ${customer.last_name} (${phone}). SID: ${smsResult.provider_id}`
        : `SMS failed: ${smsResult.error}`,
      error: smsResult.error,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg, error: msg };
  }
}
