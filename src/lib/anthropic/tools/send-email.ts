/**
 * send_email — Anthropic tool implementation.
 *
 * Called by the Orchestrator when Claude decides to send an email.
 * Writes to `communications`, calls Resend, records billing.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail, isResendConfigured } from "@/lib/resend-client";
import { recordBillingEvent } from "@/lib/billing/metering";
import type { Customer, Dealership } from "@/types";

// ── Tool definition for Anthropic SDK ────────────────────────

export const SEND_EMAIL_TOOL_DEFINITION = {
  name: "send_email",
  description: `Send a personalized HTML email to a customer via Resend.
Use when the campaign channel is email and you have written the subject and body.
The tool handles delivery tracking and billing automatically.`,
  input_schema: {
    type: "object" as const,
    properties: {
      customer_id: {
        type: "string",
        description: "UUID of the customer to email (must belong to current dealership)",
      },
      subject: {
        type: "string",
        description: "Email subject line. Concise, personalized, no spammy words.",
      },
      body_html: {
        type: "string",
        description: "Full email body as HTML. May include a greeting, 1–3 paragraphs, and a clear CTA button or link. Use inline styles for compatibility.",
      },
    },
    required: ["customer_id", "subject", "body_html"],
  },
} as const;

// ── Tool types ─────────────────────────────────────────────────

export interface SendEmailToolInput {
  customer_id: string;
  subject: string;
  body_html: string;
}

export interface SendEmailToolResult {
  success: boolean;
  communication_id?: string;
  provider_id?: string;
  message: string;
  error?: string;
}

export interface SendEmailContext {
  dealershipId: string;
  campaignId?: string;
  createdBy?: string;
  dryRun?: boolean;
}

// ── Executor ───────────────────────────────────────────────────

export async function executeSendEmailTool(
  input: SendEmailToolInput,
  context: SendEmailContext
): Promise<SendEmailToolResult> {
  const supabase = createServiceClient();

  try {
    const { data: customer, error: customerErr } = await supabase
      .from("customers")
      .select("first_name, last_name, email")
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

    const email = (customer as Pick<Customer, "first_name" | "last_name" | "email">).email;
    if (!email) {
      return {
        success: false,
        message: `Customer ${customer.first_name} ${customer.last_name} has no email address`,
        error: "NO_EMAIL",
      };
    }

    // Load dealership name for the From field
    const { data: dealership } = await supabase
      .from("dealerships")
      .select("name")
      .eq("id", context.dealershipId)
      .single();

    const dealershipName = (dealership as Pick<Dealership, "name"> | null)?.name ?? "AutoCDP";

    // Insert communication record
    const { data: comm, error: insertErr } = await supabase
      .from("communications")
      .insert({
        dealership_id: context.dealershipId,
        customer_id: input.customer_id,
        campaign_id: context.campaignId ?? null,
        channel: "email",
        status: "pending",
        subject: input.subject,
        content: input.body_html,
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

    // Dry run — skip Resend call
    if (context.dryRun) {
      return {
        success: true,
        communication_id: comm.id,
        message: `[DRY RUN] Would send email to ${customer.first_name} ${customer.last_name} (${email}). Subject: "${input.subject}"`,
      };
    }

    if (!isResendConfigured()) {
      await supabase.from("communications").update({ status: "failed" }).eq("id", comm.id);
      return {
        success: false,
        communication_id: comm.id,
        message: "Resend is not configured — add RESEND_API_KEY to .env.local",
        error: "RESEND_NOT_CONFIGURED",
      };
    }

    const emailResult = await sendEmail({
      to: email,
      subject: input.subject,
      html: input.body_html,
      fromName: dealershipName,
    });

    await supabase.from("communications").update({
      status: emailResult.success ? "sent" : "failed",
      provider_id: emailResult.provider_id ?? null,
      sent_at: emailResult.success ? new Date().toISOString() : null,
    }).eq("id", comm.id);

    if (emailResult.success) {
      await recordBillingEvent(context.dealershipId, "email_sent", 1, {
        communication_id: comm.id,
        customer_id: input.customer_id,
        provider_id: emailResult.provider_id,
      });
    }

    return {
      success: emailResult.success,
      communication_id: comm.id,
      provider_id: emailResult.provider_id,
      message: emailResult.success
        ? `✓ Email sent to ${customer.first_name} ${customer.last_name} (${email}). ID: ${emailResult.provider_id}`
        : `Email failed: ${emailResult.error}`,
      error: emailResult.error,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg, error: msg };
  }
}
