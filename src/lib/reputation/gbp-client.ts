/**
 * Google Business Profile (GBP) API Client
 *
 * Uses the Google My Business API v4 for reviews, local posts, and Q&A.
 * Auth: OAuth 2.0 with scope `https://www.googleapis.com/auth/business.manage`
 *
 * Env vars (platform-level):
 *   GBP_CLIENT_ID       — Google OAuth client_id (can share with Google Ads)
 *   GBP_CLIENT_SECRET   — Google OAuth client_secret
 *
 * Per-dealership tokens in dms_connections (provider = 'google_business_profile'):
 *   { refreshToken, accountId, locationId, locationName }
 */

export const GBP_API_BASE     = "https://mybusiness.googleapis.com/v4";
export const GBP_TOKEN_URL    = "https://oauth2.googleapis.com/token";
export const GBP_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth";
export const GBP_ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
export const GBP_SCOPE        = "https://www.googleapis.com/auth/business.manage";

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export interface GbpTokens {
  refreshToken: string;
  accountId:    string;  // e.g. "accounts/123456789"
  locationId:   string;  // e.g. "locations/987654321"
  locationName: string;  // human-readable
}

// ---------------------------------------------------------------------------
// Raw GBP API shapes (subset of fields we care about)
// ---------------------------------------------------------------------------

export interface GbpReview {
  reviewId:     string;
  name:         string;  // full resource name
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating:   "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?:     string;
  createTime:   string;
  updateTime:   string;
  reviewReply?: {
    comment:     string;
    updateTime:  string;
  };
}

export interface GbpPost {
  name?:        string;
  languageCode: string;
  summary:      string;
  state?:       string;
  topicType:    string;
  callToAction?: {
    actionType: string;
    url:        string;
  };
  event?: {
    title:     string;
    schedule?: {
      startDate: { year: number; month: number; day: number };
      endDate:   { year: number; month: number; day: number };
    };
  };
  createTime?:  string;
  updateTime?:  string;
}

export interface GbpQuestion {
  name:        string;  // full resource name
  author: {
    displayName: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  text:        string;
  createTime:  string;
  updateTime:  string;
  upvoteCount: number;
  topAnswers?: Array<{
    author: { displayName: string };
    text:   string;
    createTime: string;
    upvoteCount: number;
  }>;
}

export interface GbpLocation {
  name:          string;   // full resource name e.g. "accounts/123/locations/456"
  locationName:  string;   // human-readable name
  primaryPhone?: string;
  websiteUri?:   string;
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

export function buildGbpAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GBP_CLIENT_ID ?? "",
    redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gbp/callback`,
    response_type: "code",
    scope:         GBP_SCOPE,
    access_type:   "offline",
    prompt:        "consent",
    state,
  });
  return `${GBP_AUTH_URL}?${params}`;
}

export async function exchangeGbpCode(
  code: string
): Promise<{ refreshToken: string; accessToken: string }> {
  const res = await fetch(GBP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GBP_CLIENT_ID ?? "",
      client_secret: process.env.GBP_CLIENT_SECRET ?? "",
      redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gbp/callback`,
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`GBP token exchange failed: ${await res.text()}`);
  const json = await res.json() as { refresh_token?: string; access_token: string };
  if (!json.refresh_token) throw new Error("GBP did not return a refresh_token — ensure prompt=consent was set");
  return { refreshToken: json.refresh_token, accessToken: json.access_token };
}

export async function getGbpAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GBP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GBP_CLIENT_ID ?? "",
      client_secret: process.env.GBP_CLIENT_SECRET ?? "",
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`GBP refresh failed: ${await res.text()}`);
  const json = await res.json() as { access_token: string };
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Account + location discovery (used during OAuth callback)
// ---------------------------------------------------------------------------

export async function fetchGbpAccounts(
  accessToken: string
): Promise<Array<{ name: string; accountName: string; type: string }>> {
  const res = await fetch(GBP_ACCOUNTS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GBP accounts fetch failed: ${await res.text()}`);
  const json = await res.json() as { accounts?: Array<{ name: string; accountName: string; type: string }> };
  return json.accounts ?? [];
}

export async function fetchGbpLocations(
  accessToken: string,
  accountId: string
): Promise<GbpLocation[]> {
  const url = `${GBP_API_BASE}/${accountId}/locations?readMask=name,locationName,primaryPhone,websiteUri`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GBP locations fetch failed: ${await res.text()}`);
  const json = await res.json() as { locations?: GbpLocation[] };
  return json.locations ?? [];
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function fetchGbpReviews(
  tokens: GbpTokens,
  pageSize = 50
): Promise<GbpReview[]> {
  const accessToken = await getGbpAccessToken(tokens.refreshToken);
  const url = `${GBP_API_BASE}/${tokens.accountId}/${tokens.locationId}/reviews?pageSize=${pageSize}&orderBy=updateTime+desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GBP reviews fetch failed: ${res.status} ${await res.text()}`);
  const json = await res.json() as { reviews?: GbpReview[] };
  return json.reviews ?? [];
}

export async function postGbpReply(
  tokens: GbpTokens,
  reviewName: string,  // full resource name
  comment: string
): Promise<void> {
  const accessToken = await getGbpAccessToken(tokens.refreshToken);
  const url = `${GBP_API_BASE}/${reviewName}/reply`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new Error(`GBP post reply failed: ${res.status} ${await res.text()}`);
}

export async function deleteGbpReply(
  tokens: GbpTokens,
  reviewName: string
): Promise<void> {
  const accessToken = await getGbpAccessToken(tokens.refreshToken);
  const res = await fetch(`${GBP_API_BASE}/${reviewName}/reply`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404 is fine — reply was already gone
  if (!res.ok && res.status !== 404) {
    throw new Error(`GBP delete reply failed: ${res.status} ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Local Posts
// ---------------------------------------------------------------------------

export async function fetchGbpPosts(tokens: GbpTokens): Promise<GbpPost[]> {
  const accessToken = await getGbpAccessToken(tokens.refreshToken);
  const url = `${GBP_API_BASE}/${tokens.accountId}/${tokens.locationId}/localPosts?pageSize=25`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GBP posts fetch failed: ${res.status}`);
  const json = await res.json() as { localPosts?: GbpPost[] };
  return json.localPosts ?? [];
}

export async function createGbpPost(
  tokens: GbpTokens,
  post: GbpPost
): Promise<GbpPost> {
  const accessToken = await getGbpAccessToken(tokens.refreshToken);
  const url = `${GBP_API_BASE}/${tokens.accountId}/${tokens.locationId}/localPosts`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(post),
  });
  if (!res.ok) throw new Error(`GBP create post failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<GbpPost>;
}

// ---------------------------------------------------------------------------
// Q&A
// ---------------------------------------------------------------------------

export async function fetchGbpQAndA(tokens: GbpTokens): Promise<GbpQuestion[]> {
  const accessToken = await getGbpAccessToken(tokens.refreshToken);
  const url = `${GBP_API_BASE}/${tokens.accountId}/${tokens.locationId}/questions?questionsPerLocation=20&answersPerQuestion=1&orderBy=updateTime+desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GBP Q&A fetch failed: ${res.status}`);
  const json = await res.json() as { questions?: GbpQuestion[] };
  return json.questions ?? [];
}

export async function postGbpAnswer(
  tokens: GbpTokens,
  questionName: string,  // full resource name
  text: string
): Promise<void> {
  const accessToken = await getGbpAccessToken(tokens.refreshToken);
  const url = `${GBP_API_BASE}/${questionName}/answers:upsert`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ answer: { text } }),
  });
  if (!res.ok) throw new Error(`GBP post answer failed: ${res.status} ${await res.text()}`);
}
