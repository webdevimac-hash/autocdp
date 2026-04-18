import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/webhooks/resend
 *
 * Handles Resend email lifecycle events:
 *   email.delivered   → status = "delivered", delivered_at
 *   email.opened      → status = "opened",    opened_at
 *   email.clicked     → status = "clicked",   clicked_at
 *   email.bounced     → status = "bounced"
 *   email.complained  → status = "failed"  (spam complaint)
 *
 * To configure: add this URL in your Resend dashboard → Webhooks.
 * Optional signing secret: set RESEND_WEBHOOK_SECRET in .env.local.
 *
 * Resend sends the provider_id (email ID) in the payload, which we store
 * on the communications row when the email is first sent.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Optional signature verification
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers.get("svix-signature") ?? req.headers.get("webhook-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      // Svix HMAC-SHA256 verification (used by Resend)
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const svixId = req.headers.get("svix-id") ?? "";
      const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
      const payload = `${svixId}.${svixTimestamp}.${rawBody}`;
      const sigBytes = Buffer.from(signature.split(",").find((s) => s.startsWith("v1,"))?.slice(3) ?? signature, "base64");
      const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payload));
      if (!valid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody) as {
      type: string;
      data: {
        email_id?: string;
        object?: string;
        [key: string]: unknown;
      };
    };

    const emailId = event.data?.email_id;
    if (!emailId) {
      return NextResponse.json({ ok: true, note: "No email_id in payload" });
    }

    const supabase = createServiceClient();

    // Find the communication row by provider_id = emailId
    const { data: comm } = await supabase
      .from("communications")
      .select("id, status")
      .eq("provider_id", emailId)
      .maybeSingle();

    if (!comm) {
      // Not found — may be from a different system or already deleted
      return NextResponse.json({ ok: true, note: "Communication not found for this email_id" });
    }

    const now = new Date().toISOString();
    const updates: Record<string, string | null> = {};

    switch (event.type) {
      case "email.delivered":
        updates.status = "delivered";
        updates.delivered_at = now;
        break;
      case "email.opened":
        if (comm.status !== "clicked" && comm.status !== "converted") {
          updates.status = "opened";
          updates.opened_at = now;
        }
        break;
      case "email.clicked":
        updates.status = "clicked";
        updates.clicked_at = now;
        break;
      case "email.bounced":
      case "email.delivery_delayed":
        updates.status = "bounced";
        break;
      case "email.complained":
        updates.status = "failed";
        break;
      default:
        return NextResponse.json({ ok: true, note: `Unhandled event type: ${event.type}` });
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("communications").update(updates).eq("id", comm.id);
    }

    return NextResponse.json({ ok: true, event: event.type, communicationId: comm.id });
  } catch (error) {
    console.error("[/api/webhooks/resend]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
