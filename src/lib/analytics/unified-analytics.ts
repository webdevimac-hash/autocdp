/**
 * Unified Analytics — Cross-Channel ROI Attribution
 *
 * Aggregates performance data from every marketing channel AutoCDP touches:
 *   Paid Digital  : ads_performance (Google / Meta / TikTok)
 *   Direct Mail   : mail_pieces + mail_scans
 *   SMS / Email   : communications + billing_events
 *   Attribution   : ua_touchpoint_revenue (CRM-linked) + dm_attribution
 *
 * Called by:
 *   /api/analytics/unified  (GET)
 *   /dashboard/analytics/unified  (server component)
 */

import { createServiceClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type AttributionModel = "last_touch" | "first_touch" | "linear";
export type AnalyticsDays    = 30 | 60 | 90;

export interface ChannelStat {
  channel:              string;
  label:                string;
  colorHex:             string;
  gradientCss:          string;
  spend:                number;   // USD
  reach:                number;   // impressions / sends
  engagements:          number;   // clicks / opens / scans
  conversions:          number;   // ad conversions / sale touches
  revenueAttributed:    number;   // USD from ua_touchpoint_revenue or roas estimate
  revenueIsEstimate:    boolean;  // true when falling back to ROAS × spend
  roi:                  number | null; // (revenue – spend) / spend
  cpe:                  number | null; // cost per engagement
  cpa:                  number | null; // cost per conversion
}

export interface DailyPoint {
  date:        string;
  spend:       number;
  revenue:     number;
  engagements: number;
}

export interface AttributionPath {
  channels:     string[];
  pathLabel:    string;
  count:        number;
  revenueTotal: number;
  avgRevenue:   number;
}

export interface FunnelRow {
  channel:          string;
  label:            string;
  colorHex:         string;
  reach:            number;
  engagements:      number;
  conversions:      number;
  engagementRate:   number; // engagements / reach
  conversionRate:   number; // conversions / engagements
}

export interface UnifiedAnalyticsData {
  since:   string;
  until:   string;
  days:    number;
  model:   AttributionModel;

  totals: {
    spend:                number;
    revenue:              number;
    reach:                number;
    engagements:          number;
    conversions:          number;
    roi:                  number | null;
    hasAttributedRevenue: boolean;
  };

  channels:          ChannelStat[];
  dailySeries:       DailyPoint[];
  attributionPaths:  AttributionPath[];
  funnel:            FunnelRow[];
}

// ---------------------------------------------------------------------------
// Colour palette — matches the Digital Command Center + Analytics page
// ---------------------------------------------------------------------------

const CHANNEL_META: Record<string, { label: string; hex: string; grad: string }> = {
  google_ads:   { label: "Google Ads",   hex: "#4285F4", grad: "linear-gradient(90deg,#4285F4,#72A4F7)" },
  meta_ads:     { label: "Meta Ads",     hex: "#1877F2", grad: "linear-gradient(90deg,#1877F2,#4FA3FF)" },
  tiktok_ads:   { label: "TikTok Ads",   hex: "#000000", grad: "linear-gradient(90deg,#010101,#69C9D0)" },
  direct_mail:  { label: "Direct Mail",  hex: "#6366F1", grad: "linear-gradient(90deg,#6366F1,#818CF8)" },
  sms:          { label: "SMS",          hex: "#8B5CF6", grad: "linear-gradient(90deg,#8B5CF6,#A78BFA)" },
  email:        { label: "Email",        hex: "#0EA5E9", grad: "linear-gradient(90deg,#0EA5E9,#38BDF8)" },
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build an ordered list of ISO date strings covering [since, today]. */
function buildDateRange(since: string, until: string): string[] {
  const dates: string[] = [];
  const cur = new Date(since);
  const end = new Date(until);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Internal types for raw Supabase rows
// ---------------------------------------------------------------------------

interface AdsPerfRow {
  platform:    string;
  date_start:  string;
  impressions: number;
  clicks:      number;
  conversions: number;
  spend_usd:   number;
  roas:        number | null;
}

interface MailPieceRow {
  cost_cents:    number | null;
  status:        string;
  scanned_count: number;
  created_at:    string;
}

interface MailScanRow {
  scanned_at: string;
}

interface CommRow {
  channel:    string;
  status:     string;
  sent_at:    string | null;
  opened_at:  string | null;
  clicked_at: string | null;
  created_at: string;
}

interface BillingRow {
  event_type:     string;
  quantity:       number;
  unit_cost_cents: number;
  created_at:     string;
}

interface AttributionRow {
  customer_id:   string | null;
  touch_channel: string;
  touch_type:    string;
  revenue_usd:   number | null;
  occurred_at:   string;
}

interface RevenueRow {
  credited_channel:  string;
  credited_amount:   number;
  revenue_usd:       number;
  credited_fraction: number;
  occurred_at:       string;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function getUnifiedAnalytics(
  dealershipId: string,
  days: AnalyticsDays = 30,
  model: AttributionModel = "last_touch"
): Promise<UnifiedAnalyticsData> {
  const svc    = createServiceClient();
  const since  = daysAgoIso(days);
  const until  = todayIso();

  // ── Fire all queries in parallel ──────────────────────────────────────────
  const [
    adsRes,
    mailRes,
    scanRes,
    commRes,
    billingRes,
    attrRevenueRes,
    dmAttrRes,
  ] = await Promise.all([

    // 1. Paid digital performance (all platforms)
    (svc as ReturnType<typeof createServiceClient>)
      .from("ads_performance" as never)
      .select("platform,date_start,impressions,clicks,conversions,spend_usd,roas" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .gte("date_start" as never, since as never)
      .lte("date_start" as never, until as never) as unknown as Promise<{
        data: AdsPerfRow[] | null;
      }>,

    // 2. Direct mail pieces (live only)
    (svc as ReturnType<typeof createServiceClient>)
      .from("mail_pieces" as never)
      .select("cost_cents,status,scanned_count,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("is_test" as never, false as never)
      .gte("created_at" as never, `${since}T00:00:00Z` as never) as unknown as Promise<{
        data: MailPieceRow[] | null;
      }>,

    // 3. Mail scans
    (svc as ReturnType<typeof createServiceClient>)
      .from("mail_scans" as never)
      .select("scanned_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .gte("scanned_at" as never, `${since}T00:00:00Z` as never) as unknown as Promise<{
        data: MailScanRow[] | null;
      }>,

    // 4. SMS + Email communications
    (svc as ReturnType<typeof createServiceClient>)
      .from("communications" as never)
      .select("channel,status,sent_at,opened_at,clicked_at,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .in("channel" as never, ["sms", "email"] as never)
      .gte("created_at" as never, `${since}T00:00:00Z` as never) as unknown as Promise<{
        data: CommRow[] | null;
      }>,

    // 5. Billing events for owned-channel cost data
    (svc as ReturnType<typeof createServiceClient>)
      .from("billing_events" as never)
      .select("event_type,quantity,unit_cost_cents,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .in("event_type" as never, ["sms_sent", "email_sent", "mail_piece_sent"] as never)
      .gte("created_at" as never, `${since}T00:00:00Z` as never) as unknown as Promise<{
        data: BillingRow[] | null;
      }>,

    // 6. Attributed revenue (ua_touchpoint_revenue) — prefer requested model,
    //    fall back to last_touch when model-specific rows don't exist yet
    (svc as ReturnType<typeof createServiceClient>)
      .from("ua_touchpoint_revenue" as never)
      .select("credited_channel,credited_amount,revenue_usd,credited_fraction,occurred_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("model" as never, model === "linear" ? "linear" : model === "first_touch" ? "first_touch" : "last_touch" as never)
      .gte("occurred_at" as never, `${since}T00:00:00Z` as never) as unknown as Promise<{
        data: RevenueRow[] | null;
      }>,

    // 7. dm_attribution for path analysis (all touch types)
    (svc as ReturnType<typeof createServiceClient>)
      .from("dm_attribution" as never)
      .select("customer_id,touch_channel,touch_type,revenue_usd,occurred_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .gte("occurred_at" as never, `${since}T00:00:00Z` as never)
      .order("occurred_at" as never, { ascending: true })
      .limit(2000) as unknown as Promise<{
        data: AttributionRow[] | null;
      }>,
  ]);

  const adsRows        = adsRes.data         ?? [];
  const mailRows       = mailRes.data         ?? [];
  const scanRows       = scanRes.data         ?? [];
  const commRows       = commRes.data         ?? [];
  const billingRows    = billingRes.data       ?? [];
  const revenueRows    = attrRevenueRes.data   ?? [];
  const dmAttrRows     = dmAttrRes.data        ?? [];

  // ── Compute owned-channel costs ──────────────────────────────────────────
  // Prefer billing_events; fall back to count × unit price constants
  const FALLBACK_SMS_CENTS   = 2;   // $0.02
  const FALLBACK_EMAIL_CENTS = 0;   // $0.00 (plan-included)
  const FALLBACK_MAIL_CENTS  = 120; // $1.20

  let smsCostCents   = 0;
  let emailCostCents = 0;
  let mailCostCents  = 0;

  for (const b of billingRows) {
    const cents = (b.unit_cost_cents ?? 0) * (b.quantity ?? 1);
    if (b.event_type === "sms_sent")       smsCostCents   += cents;
    if (b.event_type === "email_sent")     emailCostCents += cents;
    if (b.event_type === "mail_piece_sent") mailCostCents  += cents;
  }

  // If billing_events has no cost data (unit_cost_cents=0), estimate from counts
  const smsSent   = commRows.filter((c) => c.channel === "sms"   && c.status === "sent");
  const emailSent = commRows.filter((c) => c.channel === "email" && c.status === "sent");

  if (smsCostCents === 0)   smsCostCents   = smsSent.length   * FALLBACK_SMS_CENTS;
  if (emailCostCents === 0) emailCostCents = emailSent.length * FALLBACK_EMAIL_CENTS;
  if (mailCostCents === 0)  mailCostCents  = mailRows.reduce((s, m) => s + (m.cost_cents ?? FALLBACK_MAIL_CENTS), 0);

  // ── Build attributed revenue map by channel ───────────────────────────────
  // Channel → total credited_amount USD
  const attrRevenueByChannel: Record<string, number> = {};
  for (const r of revenueRows) {
    attrRevenueByChannel[r.credited_channel] =
      (attrRevenueByChannel[r.credited_channel] ?? 0) + Number(r.credited_amount ?? 0);
  }
  const hasAnyAttributedRevenue = revenueRows.length > 0;

  // ── Build paid-ads channel stats ──────────────────────────────────────────
  const adsByPlatform = new Map<string, {
    impressions: number; clicks: number; conversions: number;
    spend: number; roasWeightedRevenue: number; roasWeightedSpend: number;
  }>();

  for (const r of adsRows) {
    const prev = adsByPlatform.get(r.platform) ?? {
      impressions: 0, clicks: 0, conversions: 0,
      spend: 0, roasWeightedRevenue: 0, roasWeightedSpend: 0,
    };
    prev.impressions += r.impressions;
    prev.clicks      += r.clicks;
    prev.conversions += Number(r.conversions);
    prev.spend       += Number(r.spend_usd);
    if (r.roas != null) {
      prev.roasWeightedRevenue += Number(r.roas) * Number(r.spend_usd);
      prev.roasWeightedSpend   += Number(r.spend_usd);
    }
    adsByPlatform.set(r.platform, prev);
  }

  // ── Build per-channel stats array ─────────────────────────────────────────
  const channels: ChannelStat[] = [];

  // Paid platforms
  for (const platform of ["google_ads", "meta_ads", "tiktok_ads"] as const) {
    const d = adsByPlatform.get(platform);
    if (!d || d.spend === 0) continue;

    const meta = CHANNEL_META[platform];
    const attrRev = attrRevenueByChannel[platform] ?? 0;
    const roasEst = d.roasWeightedSpend > 0
      ? (d.roasWeightedRevenue / d.roasWeightedSpend) * d.spend
      : 0;

    const revenue          = attrRev > 0 ? attrRev : roasEst;
    const revenueIsEstimate = attrRev === 0 && roasEst > 0;

    channels.push({
      channel:          platform,
      label:            meta.label,
      colorHex:         meta.hex,
      gradientCss:      meta.grad,
      spend:            +d.spend.toFixed(2),
      reach:            d.impressions,
      engagements:      d.clicks,
      conversions:      Math.round(d.conversions),
      revenueAttributed: +revenue.toFixed(2),
      revenueIsEstimate,
      roi:    d.spend > 0 && revenue > 0 ? +((revenue - d.spend) / d.spend).toFixed(4) : null,
      cpe:    d.clicks > 0 ? +(d.spend / d.clicks).toFixed(4) : null,
      cpa:    d.conversions > 0 ? +(d.spend / d.conversions).toFixed(4) : null,
    });
  }

  // Direct Mail
  const mailSpend    = mailCostCents / 100;
  const mailReach    = mailRows.filter((m) => m.status === "delivered").length || mailRows.length;
  const mailEngaged  = scanRows.length;
  const mailAttrRev  = attrRevenueByChannel["direct_mail"] ?? 0;

  if (mailSpend > 0 || mailRows.length > 0) {
    const meta = CHANNEL_META["direct_mail"];
    channels.push({
      channel:          "direct_mail",
      label:            meta.label,
      colorHex:         meta.hex,
      gradientCss:      meta.grad,
      spend:            +mailSpend.toFixed(2),
      reach:            mailReach,
      engagements:      mailEngaged,
      conversions:      0,  // mail conversions require CRM link
      revenueAttributed: +mailAttrRev.toFixed(2),
      revenueIsEstimate: false,
      roi:    mailSpend > 0 && mailAttrRev > 0 ? +((mailAttrRev - mailSpend) / mailSpend).toFixed(4) : null,
      cpe:    mailEngaged > 0 ? +(mailSpend / mailEngaged).toFixed(4) : null,
      cpa:    null,
    });
  }

  // SMS
  const smsSpend   = smsCostCents / 100;
  const smsReach   = smsSent.length;
  const smsClicked = commRows.filter((c) => c.channel === "sms" && c.clicked_at).length;
  const smsAttrRev = attrRevenueByChannel["sms"] ?? 0;

  if (smsReach > 0 || smsSpend > 0) {
    const meta = CHANNEL_META["sms"];
    channels.push({
      channel:          "sms",
      label:            meta.label,
      colorHex:         meta.hex,
      gradientCss:      meta.grad,
      spend:            +smsSpend.toFixed(2),
      reach:            smsReach,
      engagements:      smsClicked,
      conversions:      0,
      revenueAttributed: +smsAttrRev.toFixed(2),
      revenueIsEstimate: false,
      roi:    smsSpend > 0 && smsAttrRev > 0 ? +((smsAttrRev - smsSpend) / smsSpend).toFixed(4) : null,
      cpe:    smsClicked > 0 ? +(smsSpend / smsClicked).toFixed(4) : null,
      cpa:    null,
    });
  }

  // Email
  const emailSpend   = emailCostCents / 100;
  const emailReach   = emailSent.length;
  const emailOpened  = commRows.filter((c) => c.channel === "email" && c.opened_at).length;
  const emailClicked = commRows.filter((c) => c.channel === "email" && c.clicked_at).length;
  const emailEngaged = emailOpened + emailClicked;
  const emailAttrRev = attrRevenueByChannel["email"] ?? 0;

  if (emailReach > 0 || emailSpend > 0) {
    const meta = CHANNEL_META["email"];
    channels.push({
      channel:          "email",
      label:            meta.label,
      colorHex:         meta.hex,
      gradientCss:      meta.grad,
      spend:            +emailSpend.toFixed(2),
      reach:            emailReach,
      engagements:      emailEngaged,
      conversions:      0,
      revenueAttributed: +emailAttrRev.toFixed(2),
      revenueIsEstimate: false,
      roi:    emailSpend > 0 && emailAttrRev > 0 ? +((emailAttrRev - emailSpend) / emailSpend).toFixed(4) : null,
      cpe:    emailEngaged > 0 && emailSpend > 0 ? +(emailSpend / emailEngaged).toFixed(4) : null,
      cpa:    null,
    });
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalSpend   = channels.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = channels.reduce((s, c) => s + c.revenueAttributed, 0);
  const totalReach   = channels.reduce((s, c) => s + c.reach, 0);
  const totalEngaged = channels.reduce((s, c) => s + c.engagements, 0);
  const totalConv    = channels.reduce((s, c) => s + c.conversions, 0);
  const blendedRoi   = totalSpend > 0 && totalRevenue > 0
    ? +((totalRevenue - totalSpend) / totalSpend).toFixed(4) : null;

  // ── Daily series ──────────────────────────────────────────────────────────
  const dateRange  = buildDateRange(since, until);
  const dailyMap   = new Map<string, DailyPoint>(
    dateRange.map((d) => [d, { date: d, spend: 0, revenue: 0, engagements: 0 }])
  );

  // Ads spend + engagements by date_start
  for (const r of adsRows) {
    const dp = dailyMap.get(r.date_start);
    if (dp) {
      dp.spend       += Number(r.spend_usd);
      dp.engagements += r.clicks;
    }
  }

  // Mail spend by piece creation date
  for (const m of mailRows) {
    const day = m.created_at?.slice(0, 10);
    const dp  = day ? dailyMap.get(day) : undefined;
    if (dp) dp.spend += (m.cost_cents ?? FALLBACK_MAIL_CENTS) / 100;
  }

  // Mail scan engagements by scan date
  for (const s of scanRows) {
    const day = s.scanned_at?.slice(0, 10);
    const dp  = day ? dailyMap.get(day) : undefined;
    if (dp) dp.engagements++;
  }

  // SMS/email spend by event date (from billing)
  for (const b of billingRows) {
    const day = b.created_at?.slice(0, 10);
    const dp  = day ? dailyMap.get(day) : undefined;
    if (dp) dp.spend += (b.unit_cost_cents ?? 0) * (b.quantity ?? 1) / 100;
  }

  // Email/SMS engagements
  for (const c of commRows) {
    if (c.clicked_at) {
      const day = c.clicked_at.slice(0, 10);
      const dp  = dailyMap.get(day);
      if (dp) dp.engagements++;
    }
    if (c.channel === "email" && c.opened_at) {
      const day = c.opened_at.slice(0, 10);
      const dp  = dailyMap.get(day);
      if (dp) dp.engagements++;
    }
  }

  // Attributed revenue by occurred_at
  for (const r of revenueRows) {
    const day = r.occurred_at?.slice(0, 10);
    const dp  = day ? dailyMap.get(day) : undefined;
    if (dp) dp.revenue += Number(r.credited_amount ?? 0);
  }

  // If no attribution data, distribute ROAS-based estimates across ad dates
  if (!hasAnyAttributedRevenue) {
    for (const r of adsRows) {
      if (r.roas != null && Number(r.roas) > 0) {
        const dp = dailyMap.get(r.date_start);
        if (dp) dp.revenue += Number(r.roas) * Number(r.spend_usd);
      }
    }
  }

  const dailySeries = Array.from(dailyMap.values()).map((dp) => ({
    date:        dp.date,
    spend:       +dp.spend.toFixed(2),
    revenue:     +dp.revenue.toFixed(2),
    engagements: dp.engagements,
  }));

  // ── Attribution paths ─────────────────────────────────────────────────────
  // Find customers who have a 'sale' touch event, then build their path
  const saleCustomers = new Set<string>();
  for (const r of dmAttrRows) {
    if (r.touch_type === "sale" && r.customer_id) saleCustomers.add(r.customer_id);
  }

  const customerPaths = new Map<string, { channels: string[]; revenue: number }>();

  for (const customerId of saleCustomers) {
    const touches = dmAttrRows
      .filter((r) => r.customer_id === customerId)
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

    const pathChannels = touches
      .filter((t) => t.touch_type !== "sale")
      .map((t) => t.touch_channel)
      // Deduplicate consecutive same channels
      .filter((ch, i, arr) => i === 0 || ch !== arr[i - 1]);

    const revenue = touches
      .filter((t) => t.touch_type === "sale")
      .reduce((s, t) => s + Number(t.revenue_usd ?? 0), 0);

    if (pathChannels.length > 0) {
      customerPaths.set(customerId, { channels: pathChannels, revenue });
    }
  }

  // Group identical paths
  const pathGroups = new Map<string, { channels: string[]; count: number; revenueTotal: number }>();
  for (const { channels: chs, revenue } of customerPaths.values()) {
    const key = chs.join(" → ");
    const prev = pathGroups.get(key) ?? { channels: chs, count: 0, revenueTotal: 0 };
    prev.count++;
    prev.revenueTotal += revenue;
    pathGroups.set(key, prev);
  }

  const attributionPaths: AttributionPath[] = Array.from(pathGroups.values())
    .sort((a, b) => b.revenueTotal - a.revenueTotal)
    .slice(0, 8)
    .map((p) => ({
      channels:     p.channels,
      pathLabel:    p.channels.map((ch) => CHANNEL_META[ch]?.label ?? ch).join(" → "),
      count:        p.count,
      revenueTotal: +p.revenueTotal.toFixed(2),
      avgRevenue:   p.count > 0 ? +(p.revenueTotal / p.count).toFixed(2) : 0,
    }));

  // ── Funnel data ───────────────────────────────────────────────────────────
  const funnel: FunnelRow[] = channels.map((ch) => ({
    channel:         ch.channel,
    label:           ch.label,
    colorHex:        ch.colorHex,
    reach:           ch.reach,
    engagements:     ch.engagements,
    conversions:     ch.conversions,
    engagementRate:  ch.reach > 0 ? +((ch.engagements / ch.reach) * 100).toFixed(2) : 0,
    conversionRate:  ch.engagements > 0 ? +((ch.conversions / ch.engagements) * 100).toFixed(2) : 0,
  })).filter((f) => f.reach > 0);

  return {
    since,
    until,
    days,
    model,
    totals: {
      spend:                +totalSpend.toFixed(2),
      revenue:              +totalRevenue.toFixed(2),
      reach:                totalReach,
      engagements:          totalEngaged,
      conversions:          totalConv,
      roi:                  blendedRoi,
      hasAttributedRevenue: hasAnyAttributedRevenue,
    },
    channels,
    dailySeries,
    attributionPaths,
    funnel,
  };
}
