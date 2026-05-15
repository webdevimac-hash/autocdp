/**
 * POST /api/dealership/baseline-examples/upload
 *
 * Accepts multipart/form-data with:
 *   file       — .jpg | .png | .pdf, max 10 MB
 *   mail_type  — optional string
 *   date_sent  — optional YYYY-MM-DD
 *   notes      — optional string
 *
 * Pipeline:
 *   1. Upload file → Supabase Storage "mail-examples" bucket
 *   2. Call Claude Vision/Document API → extract copy text + visual layout description
 *   3. Insert row into baseline_mail_examples with file_url + visual_description
 *   4. Return the saved example
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";
import { randomUUID } from "crypto";

// ── Config ────────────────────────────────────────────────────

export const maxDuration = 60; // allow up to 60s for vision analysis

const ALLOWED_TYPES: Record<string, "image/jpeg" | "image/png" | "image/webp" | "application/pdf"> = {
  "image/jpeg":      "image/jpeg",
  "image/jpg":       "image/jpeg",
  "image/png":       "image/png",
  "image/webp":      "image/webp",
  "application/pdf": "application/pdf",
};
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Vision prompt ─────────────────────────────────────────────

const VISION_SYSTEM = `You are a direct mail design analyst for an automotive dealership AI platform.
Your job: extract all text and produce a precise visual layout description from a physical mail piece.
Output ONLY valid JSON — no markdown, no prose outside the JSON.`;

const VISION_PROMPT = `Analyze this direct mail piece (postcard or letter) and return JSON with exactly these two fields:

{
  "extracted_text": "Full verbatim text of the mail piece — headline, body copy, offer, CTA, fine print, dealership info, everything readable",
  "visual_description": "Detailed visual layout description covering: (1) overall design style (e.g. clean white, dark premium, fluorescent neon, earth tones); (2) hero photo treatment (full-bleed vehicle photo, side inset, illustrated, no photo); (3) headline — size, weight, color, placement (top-center, left-rail, etc.); (4) offer/coupon treatment (badge shape, coupon strip, perforation, overlay, inline text); (5) color palette — primary background, accent colors, text colors; (6) urgency elements (banner strips, expiry date treatment, ACT NOW pills); (7) CTA design — button style, QR code position, phone number treatment; (8) layout hierarchy — what draws the eye first, second, third; (9) template format (postcard 6x9, letter, folded mailer); (10) estimated design style tag that best fits: standard | multi-panel | premium-fluorescent | complex-fold | conquest"
}

If the image is too small, blurry, or unreadable, still return valid JSON with whatever you can extract, using empty strings for fields you cannot determine.`;

// ── Auth helper ───────────────────────────────────────────────

async function getDealershipId(userId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", userId)
    .maybeSingle() as unknown as { data: { dealership_id: string } | null };
  return data?.dealership_id ?? null;
}

// ── Route handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership found" }, { status: 404 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
    }

    // Parse multipart form
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const mailType = (formData.get("mail_type") as string | null)?.trim() || null;
    const dateSent = (formData.get("date_sent") as string | null)?.trim() || null;
    const notes = (formData.get("notes") as string | null)?.trim() || null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
    }

    const mediaType = ALLOWED_TYPES[file.type];
    if (!mediaType) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Use JPEG, PNG, WebP, or PDF.` },
        { status: 415 }
      );
    }

    const isPdf = mediaType === "application/pdf";
    const ext = isPdf ? "pdf" : mediaType.split("/")[1];
    const storagePath = `${dealershipId}/${randomUUID()}.${ext}`;

    // ── 1. Upload to Supabase Storage ──────────────────────────
    const fileBuffer = await file.arrayBuffer();
    const svc = createServiceClient();

    const { error: storageErr } = await svc.storage
      .from("mail-examples")
      .upload(storagePath, fileBuffer, {
        contentType: mediaType,
        upsert: false,
      });

    if (storageErr) {
      console.error("[baseline-upload] Storage upload failed:", storageErr);
      return NextResponse.json({ error: "File storage failed" }, { status: 500 });
    }

    const { data: { publicUrl } } = svc.storage
      .from("mail-examples")
      .getPublicUrl(storagePath);

    // ── 2. Claude Vision / Document analysis ──────────────────
    let extractedText = "";
    let visualDescription = "";

    try {
      const client = getAnthropicClient();
      const base64 = Buffer.from(fileBuffer).toString("base64");

      // Build the content array for the vision API call.
      // Cast through unknown to sidestep the union narrowing — the SDK accepts both at runtime.
      const contentBlock = (
        isPdf
          ? [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              { type: "text", text: VISION_PROMPT },
            ]
          : [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
                  data: base64,
                },
              },
              { type: "text", text: VISION_PROMPT },
            ]
      ) as unknown as Parameters<typeof client.messages.create>[0]["messages"][0]["content"];

      const resp = await client.messages.create({
        model: MODELS.standard,          // Sonnet for quality vision analysis
        max_tokens: 1024,
        system: VISION_SYSTEM,
        messages: [{ role: "user", content: contentBlock }],
      });

      const raw = resp.content[0].type === "text" ? resp.content[0].text : "";
      // Strip potential markdown fences
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]+\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          extracted_text?: string;
          visual_description?: string;
        };
        extractedText    = (parsed.extracted_text    ?? "").trim();
        visualDescription = (parsed.visual_description ?? "").trim();
      }
    } catch (visionErr) {
      // Non-fatal — save the file with empty text; dealer can add text manually
      console.warn("[baseline-upload] Vision analysis failed:", visionErr);
    }

    // ── 3. Insert into baseline_mail_examples ─────────────────
    const row = {
      dealership_id:     dealershipId,
      example_text:      extractedText,
      mail_type:         mailType,
      date_sent:         dateSent,
      notes,
      source_type:       isPdf ? "pdf" : "image",
      file_url:          publicUrl,
      visual_description: visualDescription || null,
    };

    const { data: inserted, error: dbErr } = await svc
      .from("baseline_mail_examples")
      .insert(row as never)
      .select("id, example_text, mail_type, date_sent, notes, source_type, file_url, visual_description, created_at")
      .single() as unknown as {
        data: {
          id: string; example_text: string; mail_type: string | null;
          date_sent: string | null; notes: string | null; source_type: string;
          file_url: string | null; visual_description: string | null; created_at: string;
        } | null;
        error: unknown;
      };

    if (dbErr || !inserted) {
      console.error("[baseline-upload] DB insert failed:", dbErr);
      return NextResponse.json({ error: "Failed to save example" }, { status: 500 });
    }

    return NextResponse.json({
      example: inserted,
      visualAnalyzed: !!visualDescription,
      textExtracted: !!extractedText,
    });
  } catch (error) {
    console.error("[/api/dealership/baseline-examples/upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
