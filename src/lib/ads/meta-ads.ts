/**
 * Meta Ads (Facebook/Instagram) Marketing API adapter — Graph API v19.
 *
 * Auth: Long-lived System User Access Token (recommended for server-to-server).
 *       OAuth user-token flow also supported for initial connect.
 * Pull: Campaign + ad-set + ad insights (impressions, clicks, spend, ROAS).
 * Push: Single-image ads and headline text ads into an existing ad set.
 *
 * Env vars (platform-level):
 *   META_APP_ID      — Facebook App ID
 *   META_APP_SECRET  — Facebook App Secret
 *
 * Per-dealership tokens stored in dms_connections.encrypted_tokens:
 *   { accessToken, adAccountId, businessId? }
 *   adAccountId format: "act_XXXXXXXXXXXXXXX"
 */

export const META_GRAPH_BASE =
  process.env.META_GRAPH_BASE ?? "https://graph.facebook.com/v19.0";

export const META_AUTH_URL      = "https://www.facebook.com/v19.0/dialog/oauth";
export const META_TOKEN_URL     = "https://graph.facebook.com/v19.0/oauth/access_token";
export const META_TOKEN_EXTEND  = "https://graph.facebook.com/v19.0/oauth/access_token";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetaAdsTokens {
  accessToken:  string;
  adAccountId:  string;  // "act_XXXXXXXXXXXXXXX"
  businessId?:  string;
}

export interface MetaCampaignInsightsRow {
  campaignId:    string;
  campaignName:  string;
  adSetId:       string;
  adSetName:     string;
  adId:          string;
  adName:        string;
  dateStart:     string;  // YYYY-MM-DD
  dateEnd:       string;
  impressions:   number;
  clicks:        number;
  conversions:   number;
  spend:         number;  // USD
  purchaseValue: number;  // conversion value for ROAS
}

export interface PushMetaAdPayload {
  adSetId:      string;
  pageId:       string;    // Facebook Page ID for the ad
  headline:     string;    // ≤40 chars (link_title)
  primaryText:  string;    // ≤125 chars (message)
  description?: string;    // ≤30 chars
  callToAction: "LEARN_MORE" | "SHOP_NOW" | "CONTACT_US" | "GET_QUOTE" | "BOOK_TRAVEL";
  imageUrl:     string;    // publicly reachable image URL
  finalUrl:     string;    // destination URL
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

export function buildMetaAuthUrl(state: string): string {
  const appId      = process.env.META_APP_ID ?? "";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com"}/api/integrations/meta-ads/callback`;

  return (
    `${META_AUTH_URL}?` +
    new URLSearchParams({
      client_id:     appId,
      redirect_uri:  redirectUri,
      response_type: "code",
      scope:         "ads_read,ads_management,business_management",
      state,
    })
  );
}

export async function exchangeMetaCode(code: string): Promise<{ accessToken: string }> {
  const appId     = process.env.META_APP_ID     ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com"}/api/integrations/meta-ads/callback`;

  const res = await fetch(
    `${META_TOKEN_URL}?` +
    new URLSearchParams({
      client_id:     appId,
      client_secret: appSecret,
      redirect_uri:  redirectUri,
      code,
    })
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Meta code exchange failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { access_token?: string; error?: { message: string } };
  if (!data.access_token) throw new Error(data.error?.message ?? "Meta did not return an access_token");
  return { accessToken: data.access_token };
}

/** Extend a short-lived token to 60-day long-lived token */
export async function extendMetaToken(shortToken: string): Promise<string> {
  const appId     = process.env.META_APP_ID     ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";

  const res = await fetch(
    `${META_TOKEN_EXTEND}?` +
    new URLSearchParams({
      grant_type:        "fb_exchange_token",
      client_id:         appId,
      client_secret:     appSecret,
      fb_exchange_token: shortToken,
    })
  );

  if (!res.ok) return shortToken;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? shortToken;
}

// ---------------------------------------------------------------------------
// API fetch helper
// ---------------------------------------------------------------------------

async function metaFetch<T>(
  path: string,
  tokens: MetaAdsTokens,
  params?: Record<string, string>,
  body?: unknown,
  method: "GET" | "POST" | "DELETE" = "GET"
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}/${path}`);
  url.searchParams.set("access_token", tokens.accessToken);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body:    body  ? JSON.stringify(body)                   : undefined,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Meta Graph API ${method} /${path} → ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const json = (await res.json()) as T & { error?: { message: string } };
  if ("error" in json && json.error) {
    throw new Error(`Meta Graph API error: ${(json as { error: { message: string } }).error.message}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Pull — Ad insights
// ---------------------------------------------------------------------------

const INSIGHT_FIELDS =
  "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name," +
  "impressions,clicks,actions,spend,action_values";

interface MetaInsightRow {
  campaign_id:   string;
  campaign_name: string;
  adset_id:      string;
  adset_name:    string;
  ad_id:         string;
  ad_name:       string;
  date_start:    string;
  date_stop:     string;
  impressions:   string;
  clicks:        string;
  spend:         string;
  actions?:      Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

interface MetaInsightResponse {
  data: MetaInsightRow[];
  paging?: { cursors?: { after?: string }; next?: string };
}

export async function fetchMetaAdInsights(
  tokens: MetaAdsTokens,
  since: string,
  until: string
): Promise<MetaCampaignInsightsRow[]> {
  const rows: MetaCampaignInsightsRow[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      level:        "ad",
      fields:       INSIGHT_FIELDS,
      time_range:   JSON.stringify({ since, until }),
      time_increment: "1",
      limit:        "500",
    };
    if (after) params.after = after;

    const res = await metaFetch<MetaInsightResponse>(
      `${tokens.adAccountId}/insights`,
      tokens,
      params
    );

    for (const r of res.data) {
      const conv = (r.actions ?? [])
        .filter((a) => ["purchase", "lead", "complete_registration"].includes(a.action_type))
        .reduce((s, a) => s + Number(a.value ?? 0), 0);
      const convValue = (r.action_values ?? [])
        .filter((a) => a.action_type === "purchase")
        .reduce((s, a) => s + Number(a.value ?? 0), 0);

      rows.push({
        campaignId:    r.campaign_id,
        campaignName:  r.campaign_name,
        adSetId:       r.adset_id,
        adSetName:     r.adset_name,
        adId:          r.ad_id,
        adName:        r.ad_name,
        dateStart:     r.date_start,
        dateEnd:       r.date_stop,
        impressions:   Number(r.impressions ?? 0),
        clicks:        Number(r.clicks ?? 0),
        conversions:   conv,
        spend:         Number(r.spend ?? 0),
        purchaseValue: convValue,
      });
    }

    after = res.paging?.cursors?.after && res.paging.next ? res.paging.cursors.after : undefined;
  } while (after);

  return rows;
}

/** Fetch ad account name for metadata */
export async function fetchMetaAdAccountInfo(tokens: MetaAdsTokens): Promise<{ name: string; currency: string }> {
  const res = await metaFetch<{ name?: string; currency?: string }>(
    tokens.adAccountId,
    tokens,
    { fields: "name,currency" }
  );
  return { name: res.name ?? tokens.adAccountId, currency: res.currency ?? "USD" };
}

// ---------------------------------------------------------------------------
// Push — Create single-image ad
// ---------------------------------------------------------------------------

export interface PushMetaAdResult {
  adId:       string;
  creativeId: string;
  status:     string;
}

export async function pushMetaAd(
  tokens: MetaAdsTokens,
  payload: PushMetaAdPayload
): Promise<PushMetaAdResult> {
  // 1. Create ad creative
  const creative = await metaFetch<{ id: string }>(
    `${tokens.adAccountId}/adcreatives`,
    tokens,
    undefined,
    {
      name:           `AutoCDP Creative — ${new Date().toISOString().slice(0, 10)}`,
      object_story_spec: {
        page_id: payload.pageId,
        link_data: {
          link:         payload.finalUrl,
          message:      payload.primaryText.slice(0, 125),
          name:         payload.headline.slice(0, 40),
          description:  (payload.description ?? "").slice(0, 30),
          call_to_action: { type: payload.callToAction },
          picture:      payload.imageUrl,
        },
      },
    },
    "POST"
  );

  // 2. Create the ad in the given ad set
  const ad = await metaFetch<{ id: string }>(
    `${tokens.adAccountId}/ads`,
    tokens,
    undefined,
    {
      name:       `AutoCDP Ad — ${new Date().toISOString().slice(0, 10)}`,
      adset_id:   payload.adSetId,
      creative:   { creative_id: creative.id },
      status:     "PAUSED",   // always paused; dealer enables manually
    },
    "POST"
  );

  return { adId: ad.id, creativeId: creative.id, status: "PAUSED" };
}

// ---------------------------------------------------------------------------
// Push — Update ad set budget
// ---------------------------------------------------------------------------

export async function updateMetaAdSetBudget(
  tokens: MetaAdsTokens,
  adSetId: string,
  dailyBudgetCents: number  // Meta budgets in account currency cents
): Promise<void> {
  await metaFetch<unknown>(
    adSetId,
    tokens,
    undefined,
    { daily_budget: String(dailyBudgetCents) },
    "POST"
  );
}

// ---------------------------------------------------------------------------
// Validate token (used during connect to check credentials work)
// ---------------------------------------------------------------------------

export async function validateMetaToken(tokens: MetaAdsTokens): Promise<boolean> {
  try {
    await fetchMetaAdAccountInfo(tokens);
    return true;
  } catch {
    return false;
  }
}
