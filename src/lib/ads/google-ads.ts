/**
 * Google Ads API adapter (REST v16).
 *
 * Auth: OAuth 2.0 (client_credentials refresh flow) + Developer Token.
 * Pull: Campaign performance via GAQL searchStream.
 * Push: Responsive Search Ads (RSA) with AI-generated headlines/descriptions.
 *
 * Env vars (platform-level, shared across all dealerships):
 *   GOOGLE_ADS_CLIENT_ID        — OAuth client_id
 *   GOOGLE_ADS_CLIENT_SECRET    — OAuth client_secret
 *   GOOGLE_ADS_DEVELOPER_TOKEN  — Google Ads Developer Token (header)
 *
 * Per-dealership tokens stored in dms_connections.encrypted_tokens:
 *   { refreshToken, customerId, loginCustomerId? }
 */

export const GOOGLE_ADS_API_BASE =
  process.env.GOOGLE_ADS_API_BASE ?? "https://googleads.googleapis.com/v16";

export const GOOGLE_ADS_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_ADS_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoogleAdsTokens {
  refreshToken:    string;
  customerId:      string;   // 10-digit customer ID without dashes
  loginCustomerId?: string;  // MCC account ID if connecting through MCC
}

export interface GoogleAdsCampaignRow {
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
  costMicros:    number;  // divide by 1_000_000 for USD
  conversionValue: number;
}

export interface GoogleAdsAdGroup {
  id:   string;
  name: string;
  campaignId: string;
}

export interface RsaHeadline   { text: string; pinnedField?: "HEADLINE_1" | "HEADLINE_2" | "HEADLINE_3" }
export interface RsaDescription { text: string; pinnedField?: "DESCRIPTION_1" | "DESCRIPTION_2" }

export interface PushRsaPayload {
  campaignId:   string;
  adGroupId:    string;
  finalUrl:     string;
  headlines:    RsaHeadline[];     // 3–15 headlines, each ≤30 chars
  descriptions: RsaDescription[];  // 2–4 descriptions, each ≤90 chars
  path1?:       string;            // URL path display (≤15 chars)
  path2?:       string;
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

interface AccessTokenCache {
  accessToken: string;
  expiresAt:   number;
}

const tokenCache = new Map<string, AccessTokenCache>();

export async function getGoogleAdsAccessToken(refreshToken: string): Promise<string> {
  const cached = tokenCache.get(refreshToken.slice(-16));
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;

  const clientId     = process.env.GOOGLE_ADS_CLIENT_ID     ?? "";
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? "";

  const res = await fetch(GOOGLE_ADS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Ads token refresh failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const entry: AccessTokenCache = {
    accessToken: data.access_token,
    expiresAt:   Date.now() + data.expires_in * 1000,
  };
  tokenCache.set(refreshToken.slice(-16), entry);
  return entry.accessToken;
}

/** Build the OAuth authorization URL for the initial connect flow */
export function buildGoogleAdsAuthUrl(state: string): string {
  const clientId   = process.env.GOOGLE_ADS_CLIENT_ID ?? "";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com"}/api/integrations/google-ads/callback`;

  return (
    `${GOOGLE_ADS_AUTH_URL}?` +
    new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: "code",
      scope:         "https://www.googleapis.com/auth/adwords",
      access_type:   "offline",
      prompt:        "consent",
      state,
    })
  );
}

/** Exchange auth code → refresh token */
export async function exchangeGoogleAdsCode(code: string): Promise<{ refreshToken: string }> {
  const clientId     = process.env.GOOGLE_ADS_CLIENT_ID     ?? "";
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? "";
  const redirectUri  = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com"}/api/integrations/google-ads/callback`;

  const res = await fetch(GOOGLE_ADS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      code,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Ads code exchange failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { refresh_token?: string };
  if (!data.refresh_token) throw new Error("Google Ads did not return a refresh_token — ensure offline access + consent prompt");
  return { refreshToken: data.refresh_token };
}

// ---------------------------------------------------------------------------
// API fetch helper
// ---------------------------------------------------------------------------

function devToken(): string {
  return process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
}

async function gadsFetch<T>(
  path: string,
  tokens: GoogleAdsTokens,
  body: unknown,
  method: "POST" | "GET" = "POST"
): Promise<T> {
  const accessToken = await getGoogleAdsAccessToken(tokens.refreshToken);

  const headers: Record<string, string> = {
    Authorization:        `Bearer ${accessToken}`,
    "developer-token":    devToken(),
    "Content-Type":       "application/json",
    Accept:               "application/json",
  };
  if (tokens.loginCustomerId) {
    headers["login-customer-id"] = tokens.loginCustomerId;
  }

  const res = await fetch(`${GOOGLE_ADS_API_BASE}/${path}`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Google Ads API ${method} /${path} → ${res.status}: ${errBody.slice(0, 500)}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Pull — Campaign performance (GAQL searchStream)
// ---------------------------------------------------------------------------

const PERFORMANCE_QUERY = (since: string, until: string) => `
  SELECT
    campaign.id,
    campaign.name,
    ad_group.id,
    ad_group.name,
    ad_group_ad.ad.id,
    segments.date,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.cost_micros,
    metrics.conversions_value
  FROM ad_group_ad
  WHERE segments.date BETWEEN '${since}' AND '${until}'
    AND campaign.status != 'REMOVED'
    AND ad_group.status != 'REMOVED'
    AND ad_group_ad.status != 'REMOVED'
  ORDER BY segments.date DESC
`;

interface GadsSearchRow {
  campaign:    { id: string; name: string };
  adGroup:     { id: string; name: string };
  adGroupAd:   { ad: { id: string } };
  segments:    { date: string };
  metrics:     {
    impressions:        string;
    clicks:             string;
    conversions:        string;
    costMicros:         string;
    conversionsValue:   string;
  };
}

interface GadsSearchResponse {
  results?: GadsSearchRow[];
}

export async function fetchGoogleAdsCampaignPerformance(
  tokens: GoogleAdsTokens,
  since: string,  // YYYY-MM-DD
  until: string
): Promise<GoogleAdsCampaignRow[]> {
  const response = await gadsFetch<GadsSearchResponse[]>(
    `customers/${tokens.customerId}/googleAds:searchStream`,
    tokens,
    { query: PERFORMANCE_QUERY(since, until) }
  );

  const rows: GoogleAdsCampaignRow[] = [];
  for (const batch of response) {
    for (const r of batch.results ?? []) {
      rows.push({
        campaignId:      r.campaign.id,
        campaignName:    r.campaign.name,
        adGroupId:       r.adGroup.id,
        adGroupName:     r.adGroup.name,
        adId:            r.adGroupAd.ad.id,
        dateStart:       r.segments.date,
        dateEnd:         r.segments.date,
        impressions:     Number(r.metrics.impressions     ?? 0),
        clicks:          Number(r.metrics.clicks          ?? 0),
        conversions:     Number(r.metrics.conversions     ?? 0),
        costMicros:      Number(r.metrics.costMicros      ?? 0),
        conversionValue: Number(r.metrics.conversionsValue ?? 0),
      });
    }
  }
  return rows;
}

/** Fetch accessible customer IDs (for account picker after OAuth) */
export async function fetchGoogleAdsAccessibleCustomers(refreshToken: string): Promise<string[]> {
  const accessToken = await getGoogleAdsAccessToken(refreshToken);
  const res = await fetch(`${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization:     `Bearer ${accessToken}`,
      "developer-token": devToken(),
      Accept:            "application/json",
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { resourceNames?: string[] };
  return (data.resourceNames ?? []).map((n) => n.replace("customers/", ""));
}

// ---------------------------------------------------------------------------
// Push — Responsive Search Ad (RSA)
// ---------------------------------------------------------------------------

export interface PushRsaResult {
  adId:       string;
  adGroupId:  string;
  campaignId: string;
  status:     string;
}

export async function pushGoogleAdsRsa(
  tokens: GoogleAdsTokens,
  payload: PushRsaPayload
): Promise<PushRsaResult> {
  // Build mutate operation
  const operation = {
    adGroupAdOperation: {
      create: {
        adGroup: `customers/${tokens.customerId}/adGroups/${payload.adGroupId}`,
        status:  "PAUSED",   // always start paused; dealer enables manually
        ad: {
          finalUrls: [payload.finalUrl],
          responsiveSearchAd: {
            headlines:    payload.headlines.map((h) => ({
              text:        h.text.slice(0, 30),
              pinnedField: h.pinnedField,
            })),
            descriptions: payload.descriptions.map((d) => ({
              text:        d.text.slice(0, 90),
              pinnedField: d.pinnedField,
            })),
            path1: payload.path1?.slice(0, 15),
            path2: payload.path2?.slice(0, 15),
          },
        },
      },
    },
  };

  const res = await gadsFetch<{
    mutateOperationResponses?: Array<{
      adGroupAdResult?: { resourceName: string };
    }>;
  }>(
    `customers/${tokens.customerId}/googleAds:mutate`,
    tokens,
    { mutateOperations: [operation] }
  );

  const resourceName =
    res.mutateOperationResponses?.[0]?.adGroupAdResult?.resourceName ?? "";
  // resourceName = "customers/XXXXXXXX/adGroupAds/YYYYYYY~ZZZZZZZ"
  const parts = resourceName.split("/").pop()?.split("~") ?? [];

  return {
    adGroupId:  parts[0] ?? payload.adGroupId,
    adId:       parts[1] ?? "",
    campaignId: payload.campaignId,
    status:     "PAUSED",
  };
}

// ---------------------------------------------------------------------------
// Push — Budget rule update
// ---------------------------------------------------------------------------

export async function updateGoogleAdsBudget(
  tokens: GoogleAdsTokens,
  campaignBudgetId: string,
  newDailyBudgetUsd: number
): Promise<void> {
  await gadsFetch(
    `customers/${tokens.customerId}/googleAds:mutate`,
    tokens,
    {
      mutateOperations: [{
        campaignBudgetOperation: {
          update: {
            resourceName:    `customers/${tokens.customerId}/campaignBudgets/${campaignBudgetId}`,
            amountMicros:    Math.round(newDailyBudgetUsd * 1_000_000),
          },
          updateMask: "amountMicros",
        },
      }],
    }
  );
}
