/**
 * Conquest Audience Push — Google Customer Match + Meta Custom Audience
 *
 * Pushes hashed customer lists from conquest_audiences and retargeting_audiences
 * to ad platforms for targeting.
 *
 * Google Customer Match:
 *   SHA-256 hash of lowercased, trimmed email/phone/name before upload.
 *   API: CustomerMatchUploadKeyType.CONTACT_INFO via UserDataService.
 *
 * Meta Custom Audience:
 *   SHA-256 hash of lowercased email/phone; uploaded via /customaudiences API.
 *   Schema: EMAIL_SHA256, PHONE_SHA256.
 *
 * PRIVACY NOTE:
 *   Raw PII (email, phone, name) is never sent to ad platforms.
 *   Only SHA-256 hashes are transmitted. Hash happens in-process immediately
 *   before the API call and the hash is never persisted.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { decryptTokens } from "@/lib/dms/encrypt";
import { getGoogleAdsAccessToken, GOOGLE_ADS_API_BASE, type GoogleAdsTokens } from "@/lib/ads/google-ads";
import { META_GRAPH_BASE, type MetaAdsTokens } from "@/lib/ads/meta-ads";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Hashing helpers
// ---------------------------------------------------------------------------

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizePhone(phone: string): string {
  // E.164 without + prefix: 12223334444
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

// ---------------------------------------------------------------------------
// Google Customer Match push
// ---------------------------------------------------------------------------

export interface GoogleCustomerMatchResult {
  userListResourceName: string;
  usersAdded:           number;
  created:              boolean;
}

async function getOrCreateGoogleUserList(
  tokens: GoogleAdsTokens,
  accessToken: string,
  listName: string
): Promise<string> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
  const headers: Record<string, string> = {
    Authorization:     `Bearer ${accessToken}`,
    "developer-token": devToken,
    "Content-Type":    "application/json",
  };
  if (tokens.loginCustomerId) headers["login-customer-id"] = tokens.loginCustomerId;

  // Search for existing user list
  const searchRes = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${tokens.customerId}/googleAds:search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `SELECT user_list.resource_name, user_list.name FROM user_list WHERE user_list.name = '${listName}' AND user_list.type = 'CRM_BASED' LIMIT 1`,
      }),
    }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json() as { results?: Array<{ userList: { resourceName: string } }> };
    const existing = searchData.results?.[0]?.userList?.resourceName;
    if (existing) return existing;
  }

  // Create new user list
  const createRes = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${tokens.customerId}/userLists:mutate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            name:                  listName,
            description:           `AutoCDP Conquest Audience — ${listName}`,
            membershipLifeSpan:    30,  // days
            crmBasedUserList: {
              uploadKeyType: "CONTACT_INFO",
              dataSourceType: "FIRST_PARTY",
            },
          },
        }],
      }),
    }
  );

  if (!createRes.ok) {
    throw new Error(`Google user list create failed: ${createRes.status} ${await createRes.text()}`);
  }

  const createData = await createRes.json() as { results?: Array<{ resourceName: string }> };
  const resourceName = createData.results?.[0]?.resourceName;
  if (!resourceName) throw new Error("Google user list created but no resourceName returned");
  return resourceName;
}

export async function pushToGoogleCustomerMatch(
  dealershipId: string,
  audienceId: string,
  leads: Array<{ email: string | null; phone: string | null; first_name: string | null; last_name: string | null }>,
  listName: string
): Promise<GoogleCustomerMatchResult> {
  const svc = createServiceClient();

  const { data: conn } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .select("encrypted_tokens" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "google_ads" as never)
    .eq("status" as never, "active" as never)
    .single() as unknown as { data: { encrypted_tokens: string } | null };

  if (!conn) throw new Error("Google Ads not connected");

  const tokens      = await decryptTokens<GoogleAdsTokens>(conn.encrypted_tokens);
  const accessToken = await getGoogleAdsAccessToken(tokens.refreshToken);
  const devToken    = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";

  const headers: Record<string, string> = {
    Authorization:     `Bearer ${accessToken}`,
    "developer-token": devToken,
    "Content-Type":    "application/json",
  };
  if (tokens.loginCustomerId) headers["login-customer-id"] = tokens.loginCustomerId;

  const userListResourceName = await getOrCreateGoogleUserList(tokens, accessToken, listName);

  // Build hashed user data (batch 500 at a time — Google limit)
  const BATCH = 500;
  let usersAdded = 0;

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);
    const userIdentifiers = batch
      .map((l) => {
        const identifiers: Array<Record<string, unknown>> = [];
        if (l.email) {
          identifiers.push({ hashedEmail: sha256(l.email) });
        }
        if (l.phone) {
          identifiers.push({ hashedPhoneNumber: sha256(normalizePhone(l.phone)) });
        }
        if (l.first_name || l.last_name) {
          identifiers.push({
            addressInfo: {
              hashedFirstName: l.first_name ? sha256(l.first_name) : undefined,
              hashedLastName:  l.last_name  ? sha256(l.last_name)  : undefined,
            },
          });
        }
        return identifiers.length > 0 ? { userIdentifiers: identifiers } : null;
      })
      .filter(Boolean);

    if (userIdentifiers.length === 0) continue;

    const res = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${tokens.customerId}/offlineUserDataJobs:create`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          job: {
            type: "CUSTOMER_MATCH_USER_LIST",
            customerMatchUserListMetadata: {
              userList: userListResourceName,
            },
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("[google-customer-match] job create failed:", await res.text());
      continue;
    }

    const jobData = await res.json() as { resourceName: string };
    const jobName = jobData.resourceName;

    // Add operations
    const opsRes = await fetch(
      `${GOOGLE_ADS_API_BASE}/${jobName}:addOperations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          enablePartialFailure: true,
          operations: userIdentifiers.map((u) => ({ create: u })),
        }),
      }
    );

    if (!opsRes.ok) {
      console.error("[google-customer-match] addOperations failed:", await opsRes.text());
      continue;
    }

    // Run the job
    await fetch(`${GOOGLE_ADS_API_BASE}/${jobName}:run`, { method: "POST", headers });
    usersAdded += userIdentifiers.length;
  }

  return {
    userListResourceName,
    usersAdded,
    created: true,
  };
}

// ---------------------------------------------------------------------------
// Meta Custom Audience push
// ---------------------------------------------------------------------------

export interface MetaCustomAudienceResult {
  audienceId:   string;
  usersAdded:   number;
  created:      boolean;
}

async function getOrCreateMetaAudience(
  tokens: MetaAdsTokens,
  audienceName: string
): Promise<{ id: string; created: boolean }> {
  // Check for existing audience by name
  const searchRes = await fetch(
    `${META_GRAPH_BASE}/${tokens.adAccountId}/customaudiences?fields=id,name&access_token=${tokens.accessToken}&limit=50`
  );

  if (searchRes.ok) {
    const data = await searchRes.json() as { data?: Array<{ id: string; name: string }> };
    const existing = data.data?.find((a) => a.name === audienceName);
    if (existing) return { id: existing.id, created: false };
  }

  // Create new audience
  const createRes = await fetch(
    `${META_GRAPH_BASE}/${tokens.adAccountId}/customaudiences`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token:    tokens.accessToken,
        name:            audienceName,
        description:     `AutoCDP Conquest Audience — ${audienceName}`,
        subtype:         "CUSTOM",
        customer_file_source: "USER_PROVIDED_ONLY",
      }),
    }
  );

  if (!createRes.ok) {
    throw new Error(`Meta audience create failed: ${createRes.status} ${await createRes.text()}`);
  }

  const createData = await createRes.json() as { id: string };
  return { id: createData.id, created: true };
}

export async function pushToMetaCustomAudience(
  dealershipId: string,
  audienceId: string,
  leads: Array<{ email: string | null; phone: string | null }>,
  audienceName: string
): Promise<MetaCustomAudienceResult> {
  const svc = createServiceClient();

  const { data: conn } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .select("encrypted_tokens" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "meta_ads" as never)
    .eq("status" as never, "active" as never)
    .single() as unknown as { data: { encrypted_tokens: string } | null };

  if (!conn) throw new Error("Meta Ads not connected");

  const tokens = await decryptTokens<MetaAdsTokens>(conn.encrypted_tokens);
  const { id: metaAudienceId, created } = await getOrCreateMetaAudience(tokens, audienceName);

  // Hash and batch upload (Meta: up to 10,000 per call)
  const BATCH = 5000;
  let usersAdded = 0;

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);

    const schema: string[] = [];
    const data: string[][] = [];

    for (const l of batch) {
      const row: string[] = [];
      const cols: string[] = [];

      if (l.email) {
        cols.push("EMAIL");
        row.push(sha256(l.email));
      }
      if (l.phone) {
        cols.push("PHONE");
        row.push(sha256(normalizePhone(l.phone)));
      }

      if (row.length > 0) {
        // Use first row's schema — Meta requires uniform schema per batch
        if (schema.length === 0) schema.push(...cols);
        if (row.length === schema.length) data.push(row);
      }
    }

    if (data.length === 0) continue;

    const res = await fetch(
      `${META_GRAPH_BASE}/${metaAudienceId}/users`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: tokens.accessToken,
          payload: { schema, data },
        }),
      }
    );

    if (res.ok) {
      const result = await res.json() as { num_received?: number };
      usersAdded += result.num_received ?? data.length;
    } else {
      console.error("[meta-custom-audience] upload failed:", await res.text());
    }
  }

  return {
    audienceId:  metaAudienceId,
    usersAdded,
    created,
  };
}

// ---------------------------------------------------------------------------
// Combined push — push to all connected platforms
// ---------------------------------------------------------------------------

export interface AudiencePushResult {
  google?: GoogleCustomerMatchResult;
  meta?:   MetaCustomAudienceResult;
  googleError?: string;
  metaError?:   string;
}

export async function pushAudienceToAllPlatforms(
  dealershipId: string,
  audienceId: string,
  audienceName: string,
  leads: Array<{ id: string; email: string | null; phone: string | null; first_name: string | null; last_name: string | null }>,
  platforms: Array<"google" | "meta"> = ["google", "meta"]
): Promise<AudiencePushResult> {
  const svc = createServiceClient();
  const result: AudiencePushResult = {};
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { status: "ready" };

  if (platforms.includes("google")) {
    try {
      result.google = await pushToGoogleCustomerMatch(dealershipId, audienceId, leads, audienceName);
      updates.google_audience_id = result.google.userListResourceName;
      updates.google_synced_at   = now;
    } catch (e) {
      result.googleError = e instanceof Error ? e.message : String(e);
    }
  }

  if (platforms.includes("meta")) {
    try {
      result.meta = await pushToMetaCustomAudience(dealershipId, audienceId, leads, audienceName);
      updates.meta_audience_id = result.meta.audienceId;
      updates.meta_synced_at   = now;
    } catch (e) {
      result.metaError = e instanceof Error ? e.message : String(e);
    }
  }

  // Update DB audience record
  await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_audiences" as never)
    .update(updates as never)
    .eq("id" as never, audienceId as never);

  // Mark leads as retargeted
  const leadIds = leads.map((l) => l.id);
  if (leadIds.length > 0 && platforms.includes("google")) {
    await (svc as ReturnType<typeof createServiceClient>)
      .from("conquest_leads" as never)
      .update({ retargeted_google: true } as never)
      .in("id" as never, leadIds as never);
  }
  if (leadIds.length > 0 && platforms.includes("meta")) {
    await (svc as ReturnType<typeof createServiceClient>)
      .from("conquest_leads" as never)
      .update({ retargeted_meta: true } as never)
      .in("id" as never, leadIds as never);
  }

  return result;
}
