/**
 * TikTok Ads API adapter — Marketing API v1.3
 *
 * Auth: OAuth 2.0 access token (long-lived) or App-level access token.
 * Pull: Campaign + ad group + ad performance via reporting API.
 * Push: In-Feed video ads, Spark Ads, TopView campaigns.
 *
 * Env vars (platform-level):
 *   TIKTOK_APP_ID      — TikTok App ID (from developer.tiktok.com)
 *   TIKTOK_APP_SECRET  — TikTok App Secret
 *
 * Per-dealership tokens stored in dms_connections.encrypted_tokens:
 *   { accessToken, advertiserId }
 *   advertiserId: TikTok advertiser account ID (numeric string)
 *
 * API Base: https://business-api.tiktok.com/open_api/v1.3
 *
 * Key endpoints:
 *   /campaign/get/       — list campaigns
 *   /report/integrated/get/ — performance data
 *   /campaign/create/    — create campaign
 *   /adgroup/create/     — create ad group
 *   /ad/create/          — create ad
 */

export const TIKTOK_API_BASE =
  process.env.TIKTOK_API_BASE ?? "https://business-api.tiktok.com/open_api/v1.3";

export const TIKTOK_AUTH_URL  = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TikTokAdsTokens {
  accessToken:   string;
  advertiserId:  string;  // numeric string
  refreshToken?: string;
}

export interface TikTokCampaignRow {
  campaignId:    string;
  campaignName:  string;
  adGroupId:     string;
  adGroupName:   string;
  adId:          string;
  dateStart:     string;  // YYYY-MM-DD
  dateEnd:       string;
  impressions:   number;
  clicks:        number;
  conversions:   number;
  spend:         number;  // USD
  reach:         number;
  videoViews:    number;
  videoViewRate: number;  // %
  cpm:           number;
  ctr:           number;
  cvr:           number;
}

export interface PushTikTokAdPayload {
  campaignName:   string;
  objective:      "TRAFFIC" | "CONVERSIONS" | "REACH" | "VIDEO_VIEWS" | "LEAD_GENERATION" | "APP_PROMOTION";
  adGroupName:    string;
  dailyBudget:    number;     // USD
  startTime:      string;     // YYYY-MM-DD HH:MM:SS
  endTime?:       string;
  // Targeting
  ageGroups?:     Array<"AGE_13_17" | "AGE_18_24" | "AGE_25_34" | "AGE_35_44" | "AGE_45_54" | "AGE_55_100">;
  genders?:       Array<"MALE" | "FEMALE">;
  locations?:     string[];   // ISO country codes or DMA IDs
  interests?:     string[];   // TikTok interest category IDs
  // Creative
  videoUrl?:      string;     // publicly reachable video URL (MP4, ≥720p, 9:16)
  imageUrl?:      string;     // cover image
  adText:         string;     // ad description ≤100 chars
  callToAction:   "LEARN_MORE" | "SHOP_NOW" | "CONTACT_US" | "DOWNLOAD" | "BOOK_NOW" | "SIGN_UP";
  landingPageUrl: string;
  displayName:    string;     // brand display name ≤20 chars
  // Optional Spark Ad (boost organic content)
  sparkAdPostId?: string;
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

export function buildTikTokAuthUrl(state: string): string {
  const appId     = process.env.TIKTOK_APP_ID ?? "";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com"}/api/integrations/tiktok-ads/callback`;

  return (
    `${TIKTOK_AUTH_URL}?` +
    new URLSearchParams({
      client_key:    appId,
      response_type: "code",
      scope:         "tt_business_auth_write,tt_business_auth_read",
      redirect_uri:  redirectUri,
      state,
    })
  );
}

export async function exchangeTikTokCode(code: string): Promise<TikTokAdsTokens & { advertiserId: "" }> {
  const appId     = process.env.TIKTOK_APP_ID     ?? "";
  const appSecret = process.env.TIKTOK_APP_SECRET ?? "";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com"}/api/integrations/tiktok-ads/callback`;

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_key:    appId,
      client_secret: appSecret,
      code,
      grant_type:    "authorization_code",
      redirect_uri:  redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TikTok code exchange failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    data?: { access_token?: string; refresh_token?: string };
    message?: string;
  };

  const accessToken = data.data?.access_token;
  if (!accessToken) throw new Error(data.message ?? "TikTok did not return an access_token");

  return { accessToken, refreshToken: data.data?.refresh_token, advertiserId: "" };
}

// ---------------------------------------------------------------------------
// API fetch helper
// ---------------------------------------------------------------------------

async function ttFetch<T>(
  endpoint: string,
  tokens: TikTokAdsTokens,
  body?: unknown,
  method: "GET" | "POST" = "POST"
): Promise<T> {
  const url = `${TIKTOK_API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    "Access-Token": tokens.accessToken,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`TikTok API ${method} ${endpoint} → ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const json = (await res.json()) as { code?: number; message?: string; data?: T };

  if (json.code !== 0) {
    throw new Error(`TikTok API error ${json.code}: ${json.message ?? "Unknown error"}`);
  }

  return json.data as T;
}

// ---------------------------------------------------------------------------
// Pull — Campaign performance (Integrated Reporting API)
// ---------------------------------------------------------------------------

interface TikTokReportRow {
  dimensions: {
    stat_time_day:  string;  // YYYY-MM-DD
    campaign_id:    string;
    campaign_name:  string;
    adgroup_id:     string;
    adgroup_name:   string;
    ad_id:          string;
  };
  metrics: {
    spend:          string;
    impressions:    string;
    clicks:         string;
    reach:          string;
    video_play_actions: string;
    video_views_p25:    string;
    cpm:                string;
    ctr:                string;
    conversion:         string;
    cost_per_conversion: string;
  };
}

interface TikTokReportResponse {
  list:   TikTokReportRow[];
  page_info?: { total_number: number; page: number; page_size: number };
}

export async function fetchTikTokAdPerformance(
  tokens: TikTokAdsTokens,
  since: string,
  until: string
): Promise<TikTokCampaignRow[]> {
  const rows: TikTokCampaignRow[] = [];
  let page = 1;
  const pageSize = 1000;

  while (true) {
    const res = await ttFetch<TikTokReportResponse>(
      "/report/integrated/get/",
      tokens,
      {
        advertiser_id: tokens.advertiserId,
        report_type:   "BASIC",
        data_level:    "AUCTION_AD",
        dimensions:    ["stat_time_day", "campaign_id", "campaign_name", "adgroup_id", "adgroup_name", "ad_id"],
        metrics: [
          "spend", "impressions", "clicks", "reach",
          "video_play_actions", "video_views_p25",
          "cpm", "ctr", "conversion", "cost_per_conversion",
        ],
        start_date:   since,
        end_date:     until,
        page,
        page_size:    pageSize,
      }
    );

    for (const r of res.list ?? []) {
      rows.push({
        campaignId:    r.dimensions.campaign_id,
        campaignName:  r.dimensions.campaign_name,
        adGroupId:     r.dimensions.adgroup_id,
        adGroupName:   r.dimensions.adgroup_name,
        adId:          r.dimensions.ad_id,
        dateStart:     r.dimensions.stat_time_day,
        dateEnd:       r.dimensions.stat_time_day,
        impressions:   Number(r.metrics.impressions ?? 0),
        clicks:        Number(r.metrics.clicks ?? 0),
        conversions:   Number(r.metrics.conversion ?? 0),
        spend:         Number(r.metrics.spend ?? 0),
        reach:         Number(r.metrics.reach ?? 0),
        videoViews:    Number(r.metrics.video_play_actions ?? 0),
        videoViewRate: Number(r.metrics.video_views_p25 ?? 0),
        cpm:           Number(r.metrics.cpm ?? 0),
        ctr:           Number(r.metrics.ctr ?? 0),
        cvr:           Number(r.metrics.cost_per_conversion ?? 0),
      });
    }

    const total = res.page_info?.total_number ?? 0;
    if (page * pageSize >= total || res.list.length === 0) break;
    page++;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Push — Create In-Feed Ad (Campaign → Ad Group → Ad)
// ---------------------------------------------------------------------------

export interface PushTikTokAdResult {
  campaignId: string;
  adGroupId:  string;
  adId:       string;
  status:     string;
}

export async function pushTikTokAd(
  tokens: TikTokAdsTokens,
  payload: PushTikTokAdPayload
): Promise<PushTikTokAdResult> {
  // 1. Create campaign
  const campaign = await ttFetch<{ campaign_id: string }>(
    "/campaign/create/",
    tokens,
    {
      advertiser_id:    tokens.advertiserId,
      campaign_name:    payload.campaignName,
      objective_type:   payload.objective,
      budget_mode:      "BUDGET_MODE_TOTAL",
      budget:           String(payload.dailyBudget * 30), // approximate monthly
      operation_status: "DISABLE",   // start paused
    }
  );

  // 2. Create ad group (targeting + budget)
  const adGroup = await ttFetch<{ adgroup_id: string }>(
    "/adgroup/create/",
    tokens,
    {
      advertiser_id:   tokens.advertiserId,
      campaign_id:     campaign.campaign_id,
      adgroup_name:    payload.adGroupName,
      placement_type:  "PLACEMENT_TYPE_AUTOMATIC",
      budget_mode:     "BUDGET_MODE_DAY",
      budget:          String(payload.dailyBudget),
      schedule_type:   "SCHEDULE_START_END",
      schedule_start_time: payload.startTime,
      schedule_end_time:   payload.endTime ?? "",
      optimization_goal:   payload.objective === "TRAFFIC" ? "CLICK" : "CONVERT",
      bid_type:            "BID_TYPE_NO_BID",
      billing_event:       payload.objective === "REACH" ? "CPM" : "OCPM",
      operation_status:    "DISABLE",
      location_ids:        payload.locations ?? ["US"],
      age:                 payload.ageGroups ?? ["AGE_18_24", "AGE_25_34", "AGE_35_44"],
      gender:              payload.genders ?? [],
      interest_category_ids: payload.interests ?? [],
    }
  );

  // 3. Create ad (creative)
  const adCreativePayload: Record<string, unknown> = {
    advertiser_id:    tokens.advertiserId,
    adgroup_id:       adGroup.adgroup_id,
    ad_name:          `AutoCDP Ad — ${new Date().toISOString().slice(0, 10)}`,
    operation_status: "DISABLE",
    ad_text:          payload.adText.slice(0, 100),
    call_to_action:   payload.callToAction,
    landing_page_url: payload.landingPageUrl,
    display_name:     payload.displayName.slice(0, 20),
  };

  if (payload.sparkAdPostId) {
    // Spark Ad (boost existing organic post)
    adCreativePayload.tiktok_item_id = payload.sparkAdPostId;
    adCreativePayload.ad_format      = "SPARK_ADS";
  } else if (payload.videoUrl) {
    // In-Feed video ad
    adCreativePayload.video_id   = payload.videoUrl;   // caller must pre-upload to TikTok
    adCreativePayload.image_ids  = payload.imageUrl ? [payload.imageUrl] : [];
    adCreativePayload.ad_format  = "SINGLE_VIDEO";
  } else {
    throw new Error("TikTok ad requires either sparkAdPostId or videoUrl");
  }

  const ad = await ttFetch<{ ad_id: string }>(
    "/ad/create/",
    tokens,
    adCreativePayload
  );

  return {
    campaignId: campaign.campaign_id,
    adGroupId:  adGroup.adgroup_id,
    adId:       ad.ad_id,
    status:     "PAUSED",
  };
}

// ---------------------------------------------------------------------------
// Update ad group budget
// ---------------------------------------------------------------------------

export async function updateTikTokAdGroupBudget(
  tokens: TikTokAdsTokens,
  adGroupId: string,
  newDailyBudgetUsd: number
): Promise<void> {
  await ttFetch<unknown>("/adgroup/update/", tokens, {
    advertiser_id: tokens.advertiserId,
    adgroup_id:    adGroupId,
    budget:        String(newDailyBudgetUsd),
    budget_mode:   "BUDGET_MODE_DAY",
  });
}

// ---------------------------------------------------------------------------
// Validate token
// ---------------------------------------------------------------------------

export async function validateTikTokToken(tokens: TikTokAdsTokens): Promise<boolean> {
  try {
    await ttFetch<unknown>("/advertiser/info/", tokens, {
      advertiser_ids: [tokens.advertiserId],
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Fetch advertiser list (post-OAuth account picker)
// ---------------------------------------------------------------------------

export async function fetchTikTokAdvertisers(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const res = await fetch(`${TIKTOK_API_BASE}/oauth2/advertiser/get/`, {
      method: "GET",
      headers: { "Access-Token": accessToken, "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: { list?: Array<{ advertiser_id: string; advertiser_name: string }> };
    };
    return (data.data?.list ?? []).map((a) => ({ id: a.advertiser_id, name: a.advertiser_name }));
  } catch {
    return [];
  }
}
