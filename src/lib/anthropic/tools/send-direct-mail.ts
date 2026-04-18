/**
 * send_direct_mail — Anthropic tool implementation.
 *
 * This is the server-side executor that runs when Claude invokes the
 * `send_direct_mail` tool. It:
 *   1. Validates the customer exists in the dealership
 *   2. Creates a pending mail_piece record (to get a stable ID for QR)
 *   3. Generates a QR code embedding the tracking URL
 *   4. Calls PostGrid to submit the print job
 *   5. Updates mail_piece with PostGrid IDs and status
 *   6. Records a billing event
 *
 * Tool definition (pass to Anthropic messages.create):
 *   see SEND_DIRECT_MAIL_TOOL_DEFINITION below
 */
import { createServiceClient } from "@/lib/supabase/server";
import { sendMailPiece } from "@/lib/postgrid";
import { generateQRDataURL, buildTrackingUrl } from "@/lib/qrcode-gen";
import { recordBillingEvent } from "@/lib/billing/metering";
import type {
  SendDirectMailToolInput,
  SendDirectMailToolResult,
  Customer,
  Dealership,
} from "@/types";

// ── Tool definition for Anthropic SDK ────────────────────────

export const SEND_DIRECT_MAIL_TOOL_DEFINITION = {
  name: "send_direct_mail",
  description: `Send a personalized physical mail piece (postcard or letter) to a customer via PostGrid.
Use this tool when the campaign channel is direct_mail and you have generated personalized copy for a customer.
The tool handles QR code generation, print submission, and billing automatically.
Only call this when you are ready to commit to sending — production jobs incur real costs.`,
  input_schema: {
    type: "object" as const,
    properties: {
      customer_id: {
        type: "string",
        description: "UUID of the customer to send mail to (must belong to the current dealership)",
      },
      template_type: {
        type: "string",
        enum: ["postcard_6x9", "letter_6x9", "letter_8.5x11"],
        description: "Physical mail format. postcard_6x9 is most cost-effective for reactivation campaigns.",
      },
      personalized_text: {
        type: "string",
        description: "The full personalized message body. Write in first person, as if handwritten by a service advisor. Include the customer's first name. 50–120 words for postcards, 150–300 for letters.",
      },
      variables: {
        type: "object",
        description: "Optional template variables to embed: vehicle (string), service_type (string), offer (string), technician (string), mileage (number).",
        properties: {
          vehicle: { type: "string" },
          service_type: { type: "string" },
          offer: { type: "string" },
          technician: { type: "string" },
          mileage: { type: "number" },
        },
      },
    },
    required: ["customer_id", "template_type", "personalized_text"],
  },
} as const;

// ── Tool executor ─────────────────────────────────────────────

export interface SendDirectMailContext {
  dealershipId: string;
  campaignId?: string;
  createdBy?: string;
  isTest?: boolean;
}

export async function executeSendDirectMailTool(
  input: SendDirectMailToolInput,
  context: SendDirectMailContext
): Promise<SendDirectMailToolResult> {
  const supabase = createServiceClient();

  try {
    // ── 1. Validate customer belongs to this dealership ───────
    const { data: customer, error: customerErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", input.customer_id)
      .eq("dealership_id", context.dealershipId)
      .single();

    if (customerErr || !customer) {
      return {
        success: false,
        message: `Customer ${input.customer_id} not found in this dealership`,
        error: "CUSTOMER_NOT_FOUND",
      };
    }

    // Validate address is present (required by PostGrid)
    const addr = (customer as Customer).address ?? {};
    if (!addr.street || !addr.city || !addr.state || !addr.zip) {
      return {
        success: false,
        message: `Customer ${customer.first_name} ${customer.last_name} has an incomplete address. Direct mail requires street, city, state, and zip.`,
        error: "INCOMPLETE_ADDRESS",
      };
    }

    // ── 2. Load dealership (for from-address and branding) ────
    const { data: dealership, error: dealershipErr } = await supabase
      .from("dealerships")
      .select("*")
      .eq("id", context.dealershipId)
      .single();

    if (dealershipErr || !dealership) {
      return {
        success: false,
        message: "Dealership not found",
        error: "DEALERSHIP_NOT_FOUND",
      };
    }

    // ── 3. Insert pending mail_piece to reserve the ID ────────
    const { data: mailPiece, error: insertErr } = await supabase
      .from("mail_pieces")
      .insert({
        dealership_id: context.dealershipId,
        customer_id: input.customer_id,
        campaign_id: context.campaignId ?? null,
        template_type: input.template_type,
        personalized_text: input.personalized_text,
        variables: (input.variables as Record<string, unknown>) ?? {},
        status: "pending",
        is_test: context.isTest ?? false,
        created_by: context.createdBy ?? null,
      })
      .select()
      .single();

    if (insertErr || !mailPiece) {
      return {
        success: false,
        message: `Failed to create mail piece record: ${insertErr?.message}`,
        error: "DB_INSERT_FAILED",
      };
    }

    // ── 4. Generate QR code ───────────────────────────────────
    const trackingUrl = buildTrackingUrl(mailPiece.id);
    let qrDataUrl = "";
    try {
      qrDataUrl = await generateQRDataURL(trackingUrl);
    } catch (qrErr) {
      // QR failure is non-fatal — continue with blank QR
      console.warn("[send_direct_mail] QR generation failed:", qrErr);
    }

    // ── 5. Submit to PostGrid ─────────────────────────────────
    let postgridResult;
    let postgridError: string | undefined;

    try {
      postgridResult = await sendMailPiece({
        customer: customer as Customer,
        dealership: dealership as Dealership,
        templateType: input.template_type,
        personalizedText: input.personalized_text,
        variables: (input.variables ?? {}) as Record<string, unknown>,
        qrCodeDataUrl: qrDataUrl,
        trackingUrl,
      });
    } catch (pgErr) {
      postgridError = pgErr instanceof Error ? pgErr.message : String(pgErr);
      console.error("[send_direct_mail] PostGrid error:", postgridError);
    }

    // ── 6. Update mail_piece with result ──────────────────────
    const updateData: Record<string, unknown> = {
      qr_code_url: trackingUrl,
      qr_image_data_url: qrDataUrl || null,
      status: postgridError ? "error" : "processing",
      sent_at: postgridError ? null : new Date().toISOString(),
    };

    if (postgridResult) {
      updateData.postgrid_mail_id = postgridResult.id;
      updateData.postgrid_status = postgridResult.status;
      updateData.postgrid_pdf_url = postgridResult.url ?? null;
      updateData.estimated_delivery = postgridResult.estimatedDeliveryDate ?? null;
      // PostGrid test mode pieces cost $0; live pieces typically $80–$150 cents
      updateData.cost_cents = postgridResult.isTestMode ? 0 : 120;
    }

    await supabase.from("mail_pieces").update(updateData).eq("id", mailPiece.id);

    if (postgridError) {
      return {
        success: false,
        mail_piece_id: mailPiece.id,
        message: `Mail piece saved but PostGrid submission failed: ${postgridError}`,
        error: postgridError,
      };
    }

    // ── 7. Record billing event ───────────────────────────────
    await recordBillingEvent(
      context.dealershipId,
      "mail_piece_sent",
      1,
      {
        mail_piece_id: mailPiece.id,
        template_type: input.template_type,
        postgrid_id: postgridResult!.id,
        customer_id: input.customer_id,
        is_test: postgridResult!.isTestMode,
      }
    );

    return {
      success: true,
      mail_piece_id: mailPiece.id,
      postgrid_id: postgridResult!.id,
      tracking_url: trackingUrl,
      estimated_delivery: postgridResult!.estimatedDeliveryDate,
      cost_cents: postgridResult!.isTestMode ? 0 : 120,
      message: `✓ Mail piece queued for ${customer.first_name} ${customer.last_name} (${input.template_type}). PostGrid ID: ${postgridResult!.id}${postgridResult!.isTestMode ? " [TEST MODE — no physical mail sent]" : ""}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[executeSendDirectMailTool] Unexpected error:", msg);
    return { success: false, message: msg, error: msg };
  }
}
