/**
 * Shared Ads Sync Engine
 *
 * Pulls performance data from Google Ads and Meta Ads and upserts
 * daily rows into `ads_performance`.  Called by:
 *   - /api/integrations/google-ads/sync  (POST)
 *   - /api/integrations/meta-ads/sync    (POST)
 *   - Cron job (daily)
 *
 * Also exposes helpers for logging swarm push results to ads_push_log.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { decryptTokens } from "@/lib/dms/encrypt";

import {
  fetchGoogleAdsCampaignPerformance,
  GoogleAdsTokens,
  GoogleAdsCampaignRow,
} from "./google-ads";

import {
  fetchMetaAdInsights,
  MetaAdsTokens,
  MetaCampaignInsightsRow,
} from "./meta-ads";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdsPlatform = "google_ads" | "meta_ads" | "tiktok_ads";

export interface AdsSyncResult {
  platform:    AdsPlatform;
  rowsUpserted: number;
  since:       string;
  until:       string;
  durationMs:  number;
}

export interface AdsPushLogEntry {
  dealershipId: string;
  platform:     AdsPlatform;
  pushType:     "creative" | "budget_rule" | "headline_test";
  status:       "pending" | "succeeded" | "failed";
  platformId?:  string;
  payload:      Record<string, unknown>;
  response?:    Record<string, unknown>;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Google Ads sync
// ---------------------------------------------------------------------------

async function upsertGoogleRows(
  dealershipId: string,
  accountId: string,
  rows: GoogleAdsCampaignRow[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const svc = createServiceClient();

  const records = rows.map((r) => ({
    dealership_id: dealershipId,
    platform:      "google_ads" as const,
    account_id:    accountId,
    campaign_id:   r.campaignId,
    campaign_name: r.campaignName,
    ad_group_id:   r.adGroupId,
    ad_group_name: r.adGroupName,
    ad_id:         r.adId,
    date_start:    r.dateStart,
    date_end:      r.dateEnd,
    impressions:   r.impressions,
    clicks:        r.clicks,
    conversions:   r.conversions,
    spend_usd:     +(r.costMicros / 1_000_000).toFixed(4),
    roas:          r.conversionValue > 0 && r.costMicros > 0
      ? +(r.conversionValue / (r.costMicros / 1_000_000)).toFixed(4)
      : null,
    metadata: { costMicros: r.costMicros, conversionValue: r.conversionValue },
    synced_at: new Date().toISOString(),
  }));

  const { error } = await (svc as ReturnType<typeof createServiceClient>)
    .from("ads_performance" as never)
    .upsert(records as never, {
      onConflict: "dealership_id,platform,campaign_id,ad_id,date_start",
      ignoreDuplicates: false,
    });

  if (error) throw new Error(`Google Ads upsert failed: ${error.message}`);
  return records.length;
}

export async function syncGoogleAds(
  dealershipId: string,
  connectionId: string,
  since?: string,
  until?: string
): Promise<AdsSyncResult> {
  const t0 = Date.now();
  const svc = createServiceClient();

  // Load connection + decrypt tokens
  const { data: conn, error: connErr } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .select("encrypted_tokens, metadata" as never)
    .eq("id" as never, connectionId as never)
    .single() as unknown as {
      data: { encrypted_tokens: string; metadata: Record<string, unknown> } | null;
      error: { message: string } | null;
    };

  if (connErr || !conn) throw new Error("Google Ads connection not found");

  const tokens = await decryptTokens<GoogleAdsTokens>(conn.encrypted_tokens);
  const sinceDate = since ?? daysAgoIso(30);
  const untilDate = until ?? todayIso();

  const rows = await fetchGoogleAdsCampaignPerformance(tokens, sinceDate, untilDate);
  const rowsUpserted = await upsertGoogleRows(dealershipId, tokens.customerId, rows);

  // Update last_sync_at
  await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .update({ last_sync_at: new Date().toISOString(), status: "active" } as never)
    .eq("id" as never, connectionId as never);

  return {
    platform:     "google_ads",
    rowsUpserted,
    since:        sinceDate,
    until:        untilDate,
    durationMs:   Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Meta Ads sync
// ---------------------------------------------------------------------------

async function upsertMetaRows(
  dealershipId: string,
  adAccountId: string,
  rows: MetaCampaignInsightsRow[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const svc = createServiceClient();

  const records = rows.map((r) => ({
    dealership_id: dealershipId,
    platform:      "meta_ads" as const,
    account_id:    adAccountId,
    campaign_id:   r.campaignId,
    campaign_name: r.campaignName,
    ad_group_id:   r.adSetId,
    ad_group_name: r.adSetName,
    ad_id:         r.adId,
    date_start:    r.dateStart,
    date_end:      r.dateEnd,
    impressions:   r.impressions,
    clicks:        r.clicks,
    conversions:   r.conversions,
    spend_usd:     +r.spend.toFixed(4),
    roas:          r.purchaseValue > 0 && r.spend > 0
      ? +(r.purchaseValue / r.spend).toFixed(4)
      : null,
    metadata: { purchaseValue: r.purchaseValue },
    synced_at: new Date().toISOString(),
  }));

  const { error } = await (svc as ReturnType<typeof createServiceClient>)
    .from("ads_performance" as never)
    .upsert(records as never, {
      onConflict: "dealership_id,platform,campaign_id,ad_id,date_start",
      ignoreDuplicates: false,
    });

  if (error) throw new Error(`Meta Ads upsert failed: ${error.message}`);
  return records.length;
}

export async function syncMetaAds(
  dealershipId: string,
  connectionId: string,
  since?: string,
  until?: string
): Promise<AdsSyncResult> {
  const t0 = Date.now();
  const svc = createServiceClient();

  const { data: conn, error: connErr } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .select("encrypted_tokens, metadata" as never)
    .eq("id" as never, connectionId as never)
    .single() as unknown as {
      data: { encrypted_tokens: string; metadata: Record<string, unknown> } | null;
      error: { message: string } | null;
    };

  if (connErr || !conn) throw new Error("Meta Ads connection not found");

  const tokens = await decryptTokens<MetaAdsTokens>(conn.encrypted_tokens);
  const sinceDate = since ?? daysAgoIso(30);
  const untilDate = until ?? todayIso();

  const rows = await fetchMetaAdInsights(tokens, sinceDate, untilDate);
  const rowsUpserted = await upsertMetaRows(dealershipId, tokens.adAccountId, rows);

  await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .update({ last_sync_at: new Date().toISOString(), status: "active" } as never)
    .eq("id" as never, connectionId as never);

  return {
    platform:     "meta_ads",
    rowsUpserted,
    since:        sinceDate,
    until:        untilDate,
    durationMs:   Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// ads_push_log helpers
// ---------------------------------------------------------------------------

export async function logAdsPush(entry: AdsPushLogEntry): Promise<string | null> {
  const svc = createServiceClient();

  const { data, error } = await (svc as ReturnType<typeof createServiceClient>)
    .from("ads_push_log" as never)
    .insert({
      dealership_id: entry.dealershipId,
      platform:      entry.platform,
      push_type:     entry.pushType,
      status:        entry.status,
      platform_id:   entry.platformId ?? null,
      payload:       entry.payload,
      response:      entry.response ?? {},
      error_message: entry.errorMessage ?? null,
    } as never)
    .select("id" as never)
    .single() as unknown as { data: { id: string } | null; error: { message: string } | null };

  if (error) {
    console.error("[ads-sync] logAdsPush failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function updateAdsPushLog(
  logId: string,
  status: "succeeded" | "failed",
  platformId?: string,
  response?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  const svc = createServiceClient();
  await (svc as ReturnType<typeof createServiceClient>)
    .from("ads_push_log" as never)
    .update({
      status,
      platform_id:   platformId ?? null,
      response:      response ?? {},
      error_message: errorMessage ?? null,
      updated_at:    new Date().toISOString(),
    } as never)
    .eq("id" as never, logId as never);
}

// ---------------------------------------------------------------------------
// Performance summary (for Integrations page)
// ---------------------------------------------------------------------------

export interface AdsPerfSummary {
  platform:    AdsPlatform;
  accountId:   string;
  last7Days: {
    impressions: number;
    clicks:      number;
    conversions: number;
    spendUsd:    number;
    roas:        number | null;
  };
  last30Days: {
    impressions: number;
    clicks:      number;
    conversions: number;
    spendUsd:    number;
    roas:        number | null;
  };
  lastSyncedAt: string | null;
}

export async function getAdsPerfSummary(dealershipId: string): Promise<AdsPerfSummary[]> {
  const svc = createServiceClient();
  const since30 = daysAgoIso(30);
  const since7  = daysAgoIso(7);
  const today   = todayIso();

  const { data: rows } = await (svc as ReturnType<typeof createServiceClient>)
    .from("ads_performance" as never)
    .select("platform,account_id,date_start,impressions,clicks,conversions,spend_usd,roas,synced_at" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .gte("date_start" as never, since30 as never)
    .lte("date_start" as never, today as never) as unknown as {
      data: Array<{
        platform: AdsPlatform;
        account_id: string;
        date_start: string;
        impressions: number;
        clicks: number;
        conversions: number;
        spend_usd: number;
        roas: number | null;
        synced_at: string;
      }> | null;
    };

  if (!rows || rows.length === 0) return [];

  // Group by platform + account
  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.platform}::${r.account_id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  const summaries: AdsPerfSummary[] = [];

  for (const [key, data] of grouped) {
    const [platform, accountId] = key.split("::") as [AdsPlatform, string];

    const agg = (subset: typeof rows) => {
      let imp = 0, clk = 0, conv = 0, spend = 0, rv = 0;
      for (const r of subset) {
        imp   += r.impressions;
        clk   += r.clicks;
        conv  += Number(r.conversions);
        spend += Number(r.spend_usd);
        rv    += r.roas != null ? Number(r.roas) * Number(r.spend_usd) : 0;
      }
      return {
        impressions: imp,
        clicks:      clk,
        conversions: conv,
        spendUsd:    +spend.toFixed(2),
        roas:        spend > 0 ? +(rv / spend).toFixed(4) : null,
      };
    };

    const last7  = agg(data.filter((r) => r.date_start >= since7));
    const last30 = agg(data);
    const latestSync = data.reduce<string | null>((acc, r) => {
      if (!acc || r.synced_at > acc) return r.synced_at;
      return acc;
    }, null);

    summaries.push({ platform, accountId, last7Days: last7, last30Days: last30, lastSyncedAt: latestSync });
  }

  return summaries;
}
