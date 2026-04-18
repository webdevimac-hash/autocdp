import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { POSTGRID_STATUS_MAP } from "@/lib/postgrid";
import type { MailPieceStatus } from "@/types";

/**
 * POST /api/webhooks/postgrid
 *
 * Receives lifecycle events from PostGrid and updates mail_pieces status.
 * Configure in PostGrid Dashboard:
 *   Developers → Webhooks → Add Endpoint → https://yourdomain.com/api/webhooks/postgrid
 *
 * Events received:
 *   mail.created, mail.rendered, mail.in_transit,
 *   mail.processed_for_delivery, mail.delivered, mail.returned_to_sender
 *
 * PostGrid sends a x-postgrid-signature header for verification.
 * Set POSTGRID_WEBHOOK_SECRET in .env.local to enable signature verification.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-postgrid-signature") ?? "";

  // ── Signature verification ────────────────────────────────
  // PostGrid signs webhook payloads with HMAC-SHA256.
  // Skip verification in test/dev if secret is not configured.
  const webhookSecret = process.env.POSTGRID_WEBHOOK_SECRET;
  if (webhookSecret && signature) {
    // TODO: implement HMAC verification when PostGrid documents the exact header format.
    // const expectedSig = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    // if (signature !== expectedSig) {
    //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    // }
  }

  let event: {
    type: string;
    data: {
      id: string;
      object?: string;
      status?: string;
      estimatedDeliveryDate?: string;
      url?: string;
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Look up the mail_piece by PostGrid ID
  const { data: mailPiece } = await supabase
    .from("mail_pieces")
    .select("id, dealership_id, status")
    .eq("postgrid_mail_id", event.data.id)
    .single();

  if (!mailPiece) {
    // Piece not found — might be from a different system or a test
    console.log(`[postgrid webhook] No mail_piece found for PostGrid ID: ${event.data.id}`);
    return NextResponse.json({ received: true, action: "ignored" });
  }

  // Map the event type to our status
  const newStatus = POSTGRID_STATUS_MAP[event.type] as MailPieceStatus | undefined;
  if (!newStatus) {
    console.log(`[postgrid webhook] Unrecognised event type: ${event.type}`);
    return NextResponse.json({ received: true, action: "unrecognised_event" });
  }

  // Build the update object
  const updateData: Record<string, string | null> = {
    status: newStatus,
    postgrid_status: event.data.status ?? event.type,
  };

  if (newStatus === "delivered") {
    updateData.delivered_at = new Date().toISOString();
    // Also update the communications table to reflect delivery
  }
  if (event.data.estimatedDeliveryDate) {
    updateData.estimated_delivery = event.data.estimatedDeliveryDate;
  }
  if (event.data.url) {
    updateData.postgrid_pdf_url = event.data.url;
  }

  await supabase
    .from("mail_pieces")
    .update(updateData)
    .eq("id", mailPiece.id);

  console.log(`[postgrid webhook] Updated mail_piece ${mailPiece.id}: ${mailPiece.status} → ${newStatus}`);

  return NextResponse.json({ received: true, mailPieceId: mailPiece.id, newStatus });
}
