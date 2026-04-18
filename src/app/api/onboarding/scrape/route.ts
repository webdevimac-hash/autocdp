import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";

// POST /api/onboarding/scrape
// Phase 1: Uses Claude to extract dealership info from a website URL.
// Phase 2: Replace with Puppeteer for reliable DOM scraping.
export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
  }

  try {
    // Phase 1: Ask Claude to infer likely dealership metadata from the URL/domain alone.
    // Phase 2: Fetch the page HTML with Puppeteer/Playwright, pass to Claude with content.
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Given this auto dealership website URL: ${url}

Extract or reasonably infer the following information. If you cannot determine something with confidence, return null for that field.

Note: In production this would pass the actual page HTML. For now, infer from the domain and URL structure.

Return ONLY valid JSON matching this schema:
{
  "name": "Dealership name (from domain if possible)",
  "phone": null,
  "address": null,
  "hours": null,
  "logoUrl": null,
  "confidence": "low|medium|high"
}`,
      }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[/api/onboarding/scrape]", error);
    // Return empty scaffold so UI still renders manual entry fields
    return NextResponse.json(
      { name: null, phone: null, address: null, hours: null, logoUrl: null, confidence: "none" },
      { status: 200 }
    );
  }
}
