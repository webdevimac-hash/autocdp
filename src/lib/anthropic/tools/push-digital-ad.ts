/**
 * push_digital_ad — Anthropic tool definition + executor.
 *
 * Called by the Digital Marketing Agent (#6) to push an AI-generated ad
 * creative to Google Ads, Meta Ads, or TikTok Ads.  All ads start PAUSED
 * and require dealer enablement.  Every push is logged to ads_push_log.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { decryptTokens } from "@/lib/dms/encrypt";
import { pushGoogleAdsRsa, type GoogleAdsTokens } from "@/lib/ads/google-ads";
import { pushMetaAd, type MetaAdsTokens } from "@/lib/ads/meta-ads";
import { pushTikTokAd, type TikTokAdsTokens } from "@/lib/ads/tiktok-ads";
import { logAdsPush, updateAdsPushLog } from "@/lib/ads/ads-sync";

// ── Tool definition ───────────────────────────────────────────

export const PUSH_DIGITAL_AD_TOOL_DEFINITION = {
  name: "push_digital_ad",
  description: `Push an AI-generated ad creative to a paid advertising platform (Google Ads, Meta Ads, or TikTok Ads).
All ads are created in PAUSED status and require dealer manual activation.
Only call when you have a dealer-approved campaign or explicit spend approval.
This incurs real spend once the dealer activates the ad.`,
  input_schema: {
    type: "object" as const,
    required: ["platform", "campaign_name", "objective"],
    properties: {
      platform: {
        type: "string",
        enum: ["google_ads", "meta_ads", "tiktok_ads"],
        description: "Advertising platform to push to.",
      },
      campaign_name: {
        type: "string",
        description: "Human-readable campaign name (e.g. 'Spring Service Special — Toyota Owners')",
      },
      objective: {
        type: "string",
        enum: ["awareness", "consideration", "conversion", "retention", "conquest"],
        description: "Campaign funnel objective.",
      },

      // Google Ads (RSA)
      google_ad_group_id: {
        type: "string",
        description: "[Google Ads] Ad group ID to place the RSA in.",
      },
      google_headlines: {
        type: "array",
        items: { type: "string" },
        description: "[Google Ads] 3–15 headlines, each ≤30 characters.",
      },
      google_descriptions: {
        type: "array",
        items: { type: "string" },
        description: "[Google Ads] 2–4 descriptions, each ≤90 characters.",
      },
      google_final_url: {
        type: "string",
        description: "[Google Ads] Destination URL.",
      },
      google_path1: {
        type: "string",
        description: "[Google Ads] Display URL path 1 (≤15 chars).",
      },
      google_path2: {
        type: "string",
        description: "[Google Ads] Display URL path 2 (≤15 chars).",
      },

      // Meta Ads
      meta_ad_set_id: {
        type: "string",
        description: "[Meta] Ad set ID to place the ad in.",
      },
      meta_page_id: {
        type: "string",
        description: "[Meta] Facebook Page ID for the ad.",
      },
      meta_headline: {
        type: "string",
        description: "[Meta] Link title / headline (≤40 chars).",
      },
      meta_primary_text: {
        type: "string",
        description: "[Meta] Main ad copy (≤125 chars).",
      },
      meta_description: {
        type: "string",
        description: "[Meta] Short description below headline (≤30 chars).",
      },
      meta_call_to_action: {
        type: "string",
        enum: ["LEARN_MORE", "SHOP_NOW", "CONTACT_US", "GET_QUOTE", "BOOK_TRAVEL"],
        description: "[Meta] Call-to-action button label.",
      },
      meta_image_url: {
        type: "string",
        description: "[Meta] Publicly reachable image URL.",
      },
      meta_final_url: {
        type: "string",
        description: "[Meta] Destination URL.",
      },

      // TikTok Ads
      tiktok_ad_group_name: {
        type: "string",
        description: "[TikTok] Ad group name.",
      },
      tiktok_daily_budget_usd: {
        type: "number",
        description: "[TikTok] Daily budget in USD.",
      },
      tiktok_ad_text: {
        type: "string",
        description: "[TikTok] Ad description (≤100 chars).",
      },
      tiktok_call_to_action: {
        type: "string",
        enum: ["LEARN_MORE", "SHOP_NOW", "CONTACT_US", "DOWNLOAD", "BOOK_NOW", "SIGN_UP"],
        description: "[TikTok] CTA button.",
      },
      tiktok_landing_url: {
        type: "string",
        description: "[TikTok] Destination URL.",
      },
      tiktok_display_name: {
        type: "string",
        description: "[TikTok] Brand display name (≤20 chars).",
      },
      tiktok_video_url: {
        type: "string",
        description: "[TikTok] Pre-uploaded video URL or TikTok video ID.",
      },
      tiktok_spark_post_id: {
        type: "string",
        description: "[TikTok] Post ID to use as a Spark Ad (boosts organic content).",
      },

      // Common
      rationale: {
        type: "string",
        description: "Brief explanation of why this ad was created and what audience/goal it targets.",
      },
      push_type: {
        type: "string",
        enum: ["creative", "headline_test", "budget_rule"],
        description: "Type of push for the log.",
      },
    },
  },
} as const;

// ── Tool input type ───────────────────────────────────────────

export interface PushDigitalAdInput {
  platform:            "google_ads" | "meta_ads" | "tiktok_ads";
  campaign_name:       string;
  objective:           string;
  rationale?:          string;
  push_type?:          "creative" | "headline_test" | "budget_rule";

  // Google
  google_ad_group_id?:    string;
  google_headlines?:      string[];
  google_descriptions?:   string[];
  google_final_url?:      string;
  google_path1?:          string;
  google_path2?:          string;

  // Meta
  meta_ad_set_id?:       string;
  meta_page_id?:         string;
  meta_headline?:        string;
  meta_primary_text?:    string;
  meta_description?:     string;
  meta_call_to_action?:  "LEARN_MORE" | "SHOP_NOW" | "CONTACT_US" | "GET_QUOTE" | "BOOK_TRAVEL";
  meta_image_url?:       string;
  meta_final_url?:       string;

  // TikTok
  tiktok_ad_group_name?:      string;
  tiktok_daily_budget_usd?:   number;
  tiktok_ad_text?:            string;
  tiktok_call_to_action?:     string;
  tiktok_landing_url?:        string;
  tiktok_display_name?:       string;
  tiktok_video_url?:          string;
  tiktok_spark_post_id?:      string;
}

export interface PushDigitalAdResult {
  ok:         boolean;
  platform:   string;
  adId?:      string;
  campaignId?: string;
  logId?:     string;
  status:     string;
  error?:     string;
}

// ── Executor ─────────────────────────────────────────────────

export async function executePushDigitalAdTool(
  input: PushDigitalAdInput,
  dealershipId: string
): Promise<PushDigitalAdResult> {
  const svc = createServiceClient();
  const pushType = (input.push_type ?? "creative") as "creative" | "headline_test" | "budget_rule";

  // Load the platform connection
  const { data: conn } = await svc
    .from("dms_connections" as never)
    .select("encrypted_tokens" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, input.platform as never)
    .eq("status" as never, "active" as never)
    .maybeSingle() as unknown as { data: { encrypted_tokens: string } | null };

  if (!conn) {
    return {
      ok: false,
      platform: input.platform,
      status: "error",
      error: `${input.platform} is not connected for this dealership`,
    };
  }

  const logId = await logAdsPush({
    dealershipId,
    platform:  input.platform as "google_ads" | "meta_ads" | "tiktok_ads",
    pushType,
    status:    "pending",
    payload:   input as unknown as Record<string, unknown>,
  });

  try {
    let adId: string | undefined;
    let campaignId: string | undefined;

    if (input.platform === "google_ads") {
      if (!input.google_ad_group_id || !input.google_final_url || !input.google_headlines?.length) {
        throw new Error("Google Ads requires google_ad_group_id, google_final_url, and google_headlines");
      }
      const tokens = await decryptTokens<GoogleAdsTokens>(conn.encrypted_tokens);
      const result = await pushGoogleAdsRsa(tokens, {
        campaignId:   "",
        adGroupId:    input.google_ad_group_id,
        finalUrl:     input.google_final_url,
        headlines:    input.google_headlines.map((h) => ({ text: h })),
        descriptions: (input.google_descriptions ?? []).map((d) => ({ text: d })),
        path1:        input.google_path1,
        path2:        input.google_path2,
      });
      adId       = result.adId;
      campaignId = result.campaignId;

    } else if (input.platform === "meta_ads") {
      if (!input.meta_ad_set_id || !input.meta_page_id || !input.meta_headline || !input.meta_image_url || !input.meta_final_url) {
        throw new Error("Meta Ads requires meta_ad_set_id, meta_page_id, meta_headline, meta_image_url, meta_final_url");
      }
      const tokens = await decryptTokens<MetaAdsTokens>(conn.encrypted_tokens);
      const result = await pushMetaAd(tokens, {
        adSetId:      input.meta_ad_set_id,
        pageId:       input.meta_page_id,
        headline:     input.meta_headline,
        primaryText:  input.meta_primary_text ?? input.meta_headline,
        description:  input.meta_description,
        callToAction: input.meta_call_to_action ?? "LEARN_MORE",
        imageUrl:     input.meta_image_url,
        finalUrl:     input.meta_final_url,
      });
      adId = result.adId;

    } else if (input.platform === "tiktok_ads") {
      if (!input.tiktok_ad_text || !input.tiktok_landing_url || !input.tiktok_display_name) {
        throw new Error("TikTok Ads requires tiktok_ad_text, tiktok_landing_url, tiktok_display_name");
      }
      if (!input.tiktok_video_url && !input.tiktok_spark_post_id) {
        throw new Error("TikTok Ads requires either tiktok_video_url or tiktok_spark_post_id");
      }
      const tokens = await decryptTokens<TikTokAdsTokens>(conn.encrypted_tokens);
      const result = await pushTikTokAd(tokens, {
        campaignName:   input.campaign_name,
        objective:      "TRAFFIC",
        adGroupName:    input.tiktok_ad_group_name ?? `AutoCDP — ${new Date().toISOString().slice(0,10)}`,
        dailyBudget:    input.tiktok_daily_budget_usd ?? 50,
        startTime:      new Date().toISOString().replace("T", " ").slice(0, 19),
        adText:         input.tiktok_ad_text,
        callToAction:   (input.tiktok_call_to_action ?? "LEARN_MORE") as "LEARN_MORE",
        landingPageUrl: input.tiktok_landing_url,
        displayName:    input.tiktok_display_name,
        videoUrl:       input.tiktok_video_url,
        sparkAdPostId:  input.tiktok_spark_post_id,
      });
      adId       = result.adId;
      campaignId = result.campaignId;
    }

    if (logId) {
      await updateAdsPushLog(logId, "succeeded", adId, { adId, campaignId });
    }

    return { ok: true, platform: input.platform, adId, campaignId, logId: logId ?? undefined, status: "PAUSED" };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Push failed";
    if (logId) await updateAdsPushLog(logId, "failed", undefined, undefined, msg);
    return { ok: false, platform: input.platform, logId: logId ?? undefined, status: "error", error: msg };
  }
}
