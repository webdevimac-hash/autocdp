/**
 * POST /api/ads/creatives/generate
 *
 * Generates AI-powered ad creative variations for Google Ads or Meta Ads.
 * Returns a batch of thematically-distinct variants ready to push to the platform.
 *
 * Body:
 *   platform    : "google_ads" | "meta_ads"
 *   campaignGoal: string
 *   numVariants : number (optional, default 3/6)
 *   finalUrl    : string
 *   targetAudience?: string
 *   tone?       : string
 *   vehicles?   : Array<vehicle spec>  — override; falls back to aged inventory
 *   offers?     : Array<{ text, expires? }>
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import {
  generateAdCreatives,
  loadCreativeContext,
  type AdPlatform,
  type CreativeContext,
} from "@/lib/ads/creative-generator";

export const dynamic    = "force-dynamic";
export const maxDuration = 60; // Claude generation can take 15–30s for large batches

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const body = await req.json() as {
      platform:      string;
      campaignGoal:  string;
      finalUrl:      string;
      numVariants?:  number;
      targetAudience?: string;
      tone?:         string;
      vehicles?:     CreativeContext["vehicles"];
      offers?:       CreativeContext["offers"];
    };

    const { platform, campaignGoal, finalUrl, numVariants } = body;

    if (!platform || !campaignGoal || !finalUrl) {
      return NextResponse.json(
        { error: "platform, campaignGoal, finalUrl are required" },
        { status: 400 }
      );
    }

    if (!["google_ads", "meta_ads"].includes(platform)) {
      return NextResponse.json({ error: "platform must be google_ads or meta_ads" }, { status: 400 });
    }

    // Build context — start with dealership data, overlay any overrides from body
    const baseCtx = await loadCreativeContext(dealershipId, campaignGoal, finalUrl);
    const ctx: CreativeContext = {
      ...baseCtx,
      targetAudience: body.targetAudience ?? baseCtx.targetAudience,
      tone:           body.tone           ?? baseCtx.tone,
      vehicles:       body.vehicles?.length ? body.vehicles : baseCtx.vehicles,
      offers:         body.offers?.length  ? body.offers  : baseCtx.offers,
    };

    const result = await generateAdCreatives(platform as AdPlatform, ctx, numVariants);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/ads/creatives/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
