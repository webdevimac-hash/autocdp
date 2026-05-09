/**
 * Dealership Insights Engine
 *
 * Computes six data-driven insight types from a dealership's own records:
 *   trade_in_lines       — top makes/models customers trade in
 *   top_vehicles         — top vehicles serviced (by visit count)
 *   popular_colors       — most common vehicle colors in inventory
 *   inventory_turnover   — avg days on lot by model (fast vs. slow movers)
 *   sentiment_patterns   — themes extracted from service notes via Claude Haiku
 *   google_review_trends — themes from Google My Business reviews (if URL configured)
 *
 * Insights are stored in dealership_insights (one row per type, upserted on refresh)
 * and injected as soft guidance into every agent prompt.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";
import type { InsightType } from "@/lib/insights-shared";

// Re-export so callers can import everything from one place (server-side only).
export type { InsightType };
export { INSIGHT_TITLES, INSIGHT_DESCRIPTIONS } from "@/lib/insights-shared";

export interface DealershipInsight {
  id: string;
  dealership_id: string;
  insight_type: InsightType;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  dealer_notes: string | null;
  refreshed_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsightRefreshResult {
  insightsRefreshed: number;
  insightTypes: InsightType[];
  tokensUsed: number;
  errors: Array<{ type: InsightType; message: string }>;
}

// Internal raw row shapes
type RawVisit = {
  make: string | null;
  model: string | null;
  service_type: string | null;
  service_notes: string | null;
  visit_date: string | null;
};

type RawInventory = {
  make: string | null;
  model: string | null;
  color: string | null;
  days_on_lot: number;
  status: string;
};

// ── Load & format for agents ──────────────────────────────────────────────────

export async function loadDealershipInsights(dealershipId: string): Promise<DealershipInsight[]> {
  try {
    const svc = createServiceClient();
    const { data } = await (svc
      .from("dealership_insights")
      .select("*")
      .eq("dealership_id", dealershipId)
      .eq("is_active", true)
      .order("insight_type") as unknown as Promise<{ data: DealershipInsight[] | null }>);
    return data ?? [];
  } catch {
    return [];
  }
}

export function formatInsightsForPrompt(insights: DealershipInsight[]): string {
  if (!insights.length) return "";

  const sections: string[] = [];

  for (const insight of insights) {
    const d = insight.data as Record<string, unknown>;
    const lines: string[] = [];

    switch (insight.insight_type) {
      case "trade_in_lines": {
        const items = (d.items as Array<{ make: string; model: string; count: number; pct: number }> ?? []).slice(0, 5);
        lines.push(...items.map((i) => `  • ${i.make} ${i.model} — ${i.pct.toFixed(0)}% of trade-ins`));
        break;
      }
      case "top_vehicles": {
        const items = (d.items as Array<{ make: string; model: string; service_count: number }> ?? []).slice(0, 5);
        lines.push(...items.map((i) => `  • ${i.make} ${i.model} — ${i.service_count} visits`));
        break;
      }
      case "popular_colors": {
        const items = (d.items as Array<{ color: string; count: number; pct: number }> ?? []).slice(0, 5);
        lines.push(...items.map((i) => `  • ${i.color} — ${i.pct.toFixed(0)}% of vehicles`));
        break;
      }
      case "inventory_turnover": {
        type TurnItem = { make: string; model: string; avg_days: number; status: string };
        const items = d.items as TurnItem[] ?? [];
        const fast = items.filter((i) => i.status === "fast").slice(0, 3);
        const slow = items.filter((i) => i.status === "slow").slice(0, 3);
        if (fast.length) lines.push(`  Fast movers: ${fast.map((i) => `${i.make} ${i.model} (avg ${i.avg_days}d)`).join(", ")}`);
        if (slow.length) lines.push(`  Slow movers: ${slow.map((i) => `${i.make} ${i.model} (avg ${i.avg_days}d)`).join(", ")}`);
        break;
      }
      case "sentiment_patterns": {
        type Theme = { theme: string; sentiment: string; frequency: string };
        const themes = (d.themes as Theme[] ?? []).slice(0, 4);
        if (d.overall) lines.push(`  Overall sentiment: ${d.overall}`);
        lines.push(...themes.map((t) => `  • ${t.theme} — ${t.sentiment} (${t.frequency})`));
        break;
      }
      case "google_review_trends": {
        if (d.available) {
          if (d.avg_rating) lines.push(`  Avg rating: ${d.avg_rating}/5.0`);
          type ReviewTheme = { theme: string; sentiment: string };
          const themes = (d.themes as ReviewTheme[] ?? []).slice(0, 3);
          lines.push(...themes.map((t) => `  • ${t.theme} — ${t.sentiment}`));
        } else {
          return; // skip unavailable Google insight
        }
        break;
      }
      case "credit_tier_patterns": {
        if (!d.available) return; // skip if no 700Credit data
        type TierStat = { tier: string; count: number; pct: number; response_rate: number | null };
        const tiers = (d.tiers as TierStat[] ?? []).slice(0, 4);
        lines.push(...tiers.map((t) => {
          const rr = t.response_rate != null ? `, ${t.response_rate}% response` : "";
          return `  • ${t.tier}: ${t.pct}% of customers${rr}`;
        }));
        break;
      }
    }

    if (lines.length || insight.summary) {
      const notesLine = insight.dealer_notes ? `\n  [Notes from team: ${insight.dealer_notes}]` : "";
      sections.push(
        `${insight.title.toUpperCase()}:\n  ${insight.summary}` +
        (lines.length ? "\n" + lines.join("\n") : "") +
        notesLine
      );
    }
  }

  if (!sections.length) return "";

  return (
    `\nDEALERSHIP INSIGHTS — real patterns from this dealership's data.\n` +
    `Reference these naturally to make copy feel specific and informed.\n` +
    `Do not quote them verbatim — weave them in where they fit:\n\n` +
    sections.join("\n\n") + `\n`
  );
}

// ── Individual insight computations ──────────────────────────────────────────

function aggregateByMakeModel(
  visits: RawVisit[],
  filterFn?: (v: RawVisit) => boolean
): Array<{ make: string; model: string; count: number; pct: number }> {
  const src = filterFn ? visits.filter(filterFn) : visits;
  const counts: Record<string, number> = {};
  for (const v of src) {
    if (!v.make?.trim()) continue;
    const key = `${v.make.trim()}|||${(v.model ?? "").trim()}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => {
      const [make, model] = key.split("|||");
      return { make, model: model || "(unknown)", count, pct: total > 0 ? (count / total) * 100 : 0 };
    });
}

async function computeTradeInLines(
  visits: RawVisit[]
): Promise<{ data: Record<string, unknown>; summary: string }> {
  const isTradeIn = (v: RawVisit) =>
    v.service_type?.toLowerCase().includes("trade") === true ||
    v.service_notes?.toLowerCase().includes("trade-in") === true ||
    v.service_notes?.toLowerCase().includes("traded in") === true;

  const tradeItems = aggregateByMakeModel(visits, isTradeIn);
  const items = tradeItems.length >= 3 ? tradeItems : aggregateByMakeModel(visits);
  const total = items.reduce((s, i) => s + i.count, 0);
  const isTradeSpecific = tradeItems.length >= 3;

  const top3 = items.slice(0, 3).map((i) => `${i.make} ${i.model}`).join(", ");
  const summary = items.length
    ? `${isTradeSpecific ? "Top trade-in vehicles" : "Top vehicles in service history (trade-in data limited)"}: ${top3}. ${total} records analyzed.`
    : "Not enough service records to identify trade-in patterns yet.";

  return { data: { items, total, is_trade_specific: isTradeSpecific }, summary };
}

async function computeTopVehicles(
  visits: RawVisit[]
): Promise<{ data: Record<string, unknown>; summary: string }> {
  const raw = aggregateByMakeModel(visits);
  const items = raw.map((i) => ({ ...i, service_count: i.count }));
  const total = visits.filter((v) => v.make?.trim()).length;

  const top3 = items.slice(0, 3).map((i) => `${i.make} ${i.model}`).join(", ");
  const summary = items.length
    ? `Most-serviced vehicles: ${top3}. Derived from ${total} service records.`
    : "No service records found yet.";

  return { data: { items, total }, summary };
}

async function computePopularColors(
  inventory: RawInventory[]
): Promise<{ data: Record<string, unknown>; summary: string }> {
  const counts: Record<string, number> = {};
  for (const v of inventory) {
    const color = v.color?.trim();
    if (!color) continue;
    const normalized = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
    counts[normalized] = (counts[normalized] ?? 0) + 1;
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const items = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([color, count]) => ({ color, count, pct: total > 0 ? (count / total) * 100 : 0 }));

  const top3 = items.slice(0, 3).map((i) => i.color).join(", ");
  const summary = items.length
    ? `Most popular colors in inventory: ${top3}. Based on ${total} vehicles with color data.`
    : "No color data available in inventory records.";

  return { data: { items, total }, summary };
}

async function computeInventoryTurnover(
  inventory: RawInventory[]
): Promise<{ data: Record<string, unknown>; summary: string }> {
  const available = inventory.filter((v) => v.status === "available" && v.make?.trim());

  const groups: Record<string, { total_days: number; count: number }> = {};
  for (const v of available) {
    const key = `${v.make!.trim()}|||${(v.model ?? "").trim()}`;
    const g = groups[key] ?? { total_days: 0, count: 0 };
    g.total_days += v.days_on_lot;
    g.count += 1;
    groups[key] = g;
  }

  const overall_avg_days = available.length > 0
    ? Math.round(available.reduce((s, v) => s + v.days_on_lot, 0) / available.length)
    : 0;

  const items = Object.entries(groups)
    .filter(([, g]) => g.count >= 2)
    .map(([key, g]) => {
      const [make, model] = key.split("|||");
      const avg_days = Math.round(g.total_days / g.count);
      const status: "fast" | "normal" | "slow" =
        avg_days < 30 ? "fast" : avg_days > 60 ? "slow" : "normal";
      return { make, model: model || "(unknown)", avg_days, unit_count: g.count, status };
    })
    .sort((a, b) => a.avg_days - b.avg_days)
    .slice(0, 15);

  const fastMovers = items.filter((i) => i.status === "fast").map((i) => `${i.make} ${i.model}`).slice(0, 2).join(", ");
  const slowMovers = items.filter((i) => i.status === "slow").map((i) => `${i.make} ${i.model}`).slice(0, 2).join(", ");

  const parts: string[] = [`Avg days on lot: ${overall_avg_days} days (${available.length} available units).`];
  if (fastMovers) parts.push(`Fast movers: ${fastMovers}.`);
  if (slowMovers) parts.push(`Slow movers needing campaigns: ${slowMovers}.`);

  const summary = available.length > 0 ? parts.join(" ") : "No available inventory found.";

  return { data: { items, overall_avg_days, total_available: available.length }, summary };
}

async function computeSentimentPatterns(
  visits: RawVisit[],
  dealershipName: string,
  tokensRef: { used: number }
): Promise<{ data: Record<string, unknown>; summary: string }> {
  const notes = visits
    .filter((v) => (v.service_notes?.trim().length ?? 0) > 15)
    .sort(() => Math.random() - 0.5) // random sample for diversity
    .slice(0, 80)
    .map((v) => v.service_notes!.trim());

  if (notes.length < 5) {
    return {
      data: { themes: [], analyzed_notes: notes.length, overall: "neutral" },
      summary: "Not enough service notes to analyze sentiment. Add notes to visit records to enable this insight.",
    };
  }

  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 700,
    system:
      `You are an automotive dealership analyst. Extract customer sentiment themes from service advisor notes.\n` +
      `Be specific — generic themes like "good service" are not useful.\n` +
      `Focus on what's notable: recurring praise, recurring complaints, patterns in vehicle issues, service preferences.\n` +
      `Return JSON only. No markdown, no explanation.`,
    messages: [{
      role: "user",
      content:
        `Analyze these ${notes.length} service notes from ${dealershipName}.\n\n` +
        `SERVICE NOTES:\n${notes.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n` +
        `Return JSON:\n` +
        `{\n` +
        `  "overall": "positive|neutral|mixed|negative",\n` +
        `  "themes": [\n` +
        `    {\n` +
        `      "theme": "Specific theme in 3-5 words",\n` +
        `      "sentiment": "positive|neutral|negative",\n` +
        `      "example_phrases": ["exact phrase from notes", "another phrase"],\n` +
        `      "frequency": "high|medium|low"\n` +
        `    }\n` +
        `  ],\n` +
        `  "summary": "1-2 sentences summarizing what the data tells us about customer sentiment"\n` +
        `}`,
    }],
  });

  tokensRef.used += response.usage.input_tokens + response.usage.output_tokens;

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response from sentiment analysis");

  const jsonMatch = block.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Sentiment analysis did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]) as {
    overall: string;
    themes: Array<{ theme: string; sentiment: string; example_phrases: string[]; frequency: string }>;
    summary: string;
  };

  return {
    data: {
      themes: parsed.themes ?? [],
      overall: parsed.overall ?? "neutral",
      analyzed_notes: notes.length,
    },
    summary: parsed.summary ?? "Sentiment analysis complete.",
  };
}

async function computeGoogleReviewTrends(
  dealership: { name: string; website_url?: string | null; settings?: Record<string, unknown> | null },
  tokensRef: { used: number }
): Promise<{ data: Record<string, unknown>; summary: string }> {
  const settings = dealership.settings ?? {};
  const gmbUrl =
    (settings.google_reviews_url as string | null | undefined) ??
    (settings.gmb_url as string | null | undefined) ??
    null;

  if (!gmbUrl) {
    return {
      data: { available: false },
      summary:
        `Google My Business URL not configured. Add \`google_reviews_url\` to dealership settings to enable this insight.`,
    };
  }

  try {
    const res = await fetch(gmbUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AutoCDP/1.0; +https://autocdp.com)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    // Extract review-length text blobs from the HTML (heuristic — works for public GMB embeds)
    const reviewTexts: string[] = [];
    const textRegex = /"([A-Z][^"]{30,400})"/g;
    let m: RegExpExecArray | null;
    while ((m = textRegex.exec(html)) !== null && reviewTexts.length < 40) {
      const t = m[1];
      if (t.split(" ").length >= 6 && !t.includes("\\u") && !t.startsWith("http")) {
        reviewTexts.push(t);
      }
    }

    if (reviewTexts.length < 3) {
      return {
        data: { available: false, gmb_url: gmbUrl },
        summary: "Could not extract review text from the Google My Business URL. Confirm the URL is publicly accessible.",
      };
    }

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 500,
      system:
        `You are an automotive dealership analyst extracting insight from customer reviews.\n` +
        `Identify specific recurring themes — not generic ("good service"). Return JSON only.`,
      messages: [{
        role: "user",
        content:
          `Analyze these ${Math.min(reviewTexts.length, 30)} review snippets from ${dealership.name}.\n\n` +
          `REVIEW SNIPPETS:\n${reviewTexts.slice(0, 30).map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\n` +
          `Return JSON:\n` +
          `{\n` +
          `  "avg_rating": 4.5,\n` +
          `  "review_count": 0,\n` +
          `  "themes": [{"theme": "Specific theme", "sentiment": "positive|negative|neutral", "count": 3}],\n` +
          `  "period": "description of time range"\n` +
          `}`,
      }],
    });

    tokensRef.used += response.usage.input_tokens + response.usage.output_tokens;

    const block = response.content[0];
    if (block.type !== "text") throw new Error("Unexpected response");

    const jsonMatch = block.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]) as {
      avg_rating?: number;
      review_count?: number;
      themes?: Array<{ theme: string; sentiment: string; count: number }>;
      period?: string;
    };

    const themes = parsed.themes ?? [];
    const top3 = themes.slice(0, 3).map((t) => t.theme).join(", ");
    const ratingStr = parsed.avg_rating ? ` ${parsed.avg_rating}/5 avg rating.` : "";
    const summary = `Google reviews highlight: ${top3 || "mixed feedback"}.${ratingStr}`;

    return {
      data: {
        available: true,
        gmb_url: gmbUrl,
        avg_rating: parsed.avg_rating ?? null,
        review_count: parsed.review_count ?? reviewTexts.length,
        themes,
        period: parsed.period ?? "recent reviews",
      },
      summary,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      data: { available: false, gmb_url: gmbUrl, fetch_error: msg },
      summary: `Could not fetch Google reviews: ${msg}. Check that the GMB URL is publicly accessible.`,
    };
  }
}

// ── Credit tier patterns ──────────────────────────────────────────────────────

async function computeCreditTierPatterns(
  dealershipId: string,
  svc: ReturnType<typeof createServiceClient>
): Promise<{ data: Record<string, unknown>; summary: string }> {
  // Distribution from customer metadata
  type CustMeta = { metadata: Record<string, unknown> | null };
  const { data: custData } = await (svc
    .from("customers")
    .select("metadata")
    .eq("dealership_id", dealershipId)
    .limit(10000)) as unknown as { data: CustMeta[] | null };

  const dist: Record<string, number> = { excellent: 0, good: 0, fair: 0, poor: 0, unknown: 0 };
  for (const c of custData ?? []) {
    const tier = (c.metadata?.credit_tier as string | undefined) ?? "unknown";
    dist[tier in dist ? tier : "unknown"]++;
  }
  const total = Object.values(dist).reduce((s, n) => s + n, 0);
  const hasCreditData = total > 0 && dist.unknown < total * 0.9;

  if (!hasCreditData) {
    return {
      data: { available: false, distribution: dist },
      summary: "No 700Credit data connected yet. Connect via Integrations → 700Credit to enable credit-aware targeting.",
    };
  }

  // Response rates by tier from communications
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  type CommJoin = { status: string; customers: { metadata: Record<string, unknown> | null } | null };
  const { data: commData } = await (svc
    .from("communications")
    .select("status, customers(metadata)")
    .eq("dealership_id", dealershipId)
    .in("status", ["sent", "delivered", "opened", "clicked", "converted"])
    .gte("created_at", ninetyDaysAgo)
    .limit(5000)) as unknown as { data: CommJoin[] | null };

  const tierResponse: Record<string, { sent: number; engaged: number }> = {
    excellent: { sent: 0, engaged: 0 },
    good: { sent: 0, engaged: 0 },
    fair: { sent: 0, engaged: 0 },
    poor: { sent: 0, engaged: 0 },
    unknown: { sent: 0, engaged: 0 },
  };

  for (const row of commData ?? []) {
    const tier = (row.customers?.metadata?.credit_tier as string | undefined) ?? "unknown";
    const key = tier in tierResponse ? tier : "unknown";
    tierResponse[key].sent++;
    if (["opened", "clicked", "converted"].includes(row.status)) {
      tierResponse[key].engaged++;
    }
  }

  type TierStat = { tier: string; count: number; pct: number; response_rate: number | null };
  const tiers: TierStat[] = (["excellent", "good", "fair", "poor"] as const)
    .filter((t) => dist[t] > 0)
    .map((tier) => {
      const r = tierResponse[tier];
      return {
        tier,
        count: dist[tier],
        pct: total > 0 ? Math.round((dist[tier] / total) * 100) : 0,
        response_rate: r.sent > 0 ? Math.round((r.engaged / r.sent) * 100) : null,
      };
    });

  const dominantTier = tiers.sort((a, b) => b.count - a.count)[0];
  const bestResponder = tiers
    .filter((t) => t.response_rate != null)
    .sort((a, b) => (b.response_rate ?? 0) - (a.response_rate ?? 0))[0];

  const summaryParts: string[] = [];
  if (dominantTier) {
    summaryParts.push(`${dominantTier.pct}% of customers are ${dominantTier.tier}-tier.`);
  }
  if (bestResponder?.response_rate != null) {
    summaryParts.push(
      `${bestResponder.tier.charAt(0).toUpperCase() + bestResponder.tier.slice(1)}-tier customers have the highest campaign response rate (${bestResponder.response_rate}%).`
    );
  }
  if (dist.unknown > 0 && total > 0) {
    summaryParts.push(`${Math.round((dist.unknown / total) * 100)}% have no credit data yet.`);
  }

  return {
    data: { available: true, distribution: dist, tiers, total },
    summary: summaryParts.join(" ") || "Credit tier data available.",
  };
}

// ── Main refresh ──────────────────────────────────────────────────────────────

export async function refreshDealershipInsights(
  dealershipId: string
): Promise<InsightRefreshResult> {
  const svc = createServiceClient();
  const tokensRef = { used: 0 };
  const errors: Array<{ type: InsightType; message: string }> = [];
  const refreshed: InsightType[] = [];

  // Load raw data in parallel
  const [visitsRes, inventoryRes, dealershipRes] = await Promise.all([
    svc
      .from("visits")
      .select("make, model, service_type, service_notes, visit_date")
      .eq("dealership_id", dealershipId)
      .gte("visit_date", new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString())
      .order("visit_date", { ascending: false })
      .limit(2000) as unknown as Promise<{ data: RawVisit[] | null }>,
    svc
      .from("inventory")
      .select("make, model, color, days_on_lot, status")
      .eq("dealership_id", dealershipId)
      .limit(500) as unknown as Promise<{ data: RawInventory[] | null }>,
    svc
      .from("dealerships")
      .select("name, website_url, settings")
      .eq("id", dealershipId)
      .single() as unknown as Promise<{
        data: { name: string; website_url: string | null; settings: Record<string, unknown> | null } | null;
      }>,
  ]);

  const visits = visitsRes.data ?? [];
  const inventory = inventoryRes.data ?? [];
  const dealership = dealershipRes.data ?? { name: "this dealership", website_url: null, settings: null };

  const computations: Array<{
    type: InsightType;
    fn: () => Promise<{ data: Record<string, unknown>; summary: string }>;
  }> = [
    { type: "trade_in_lines",       fn: () => computeTradeInLines(visits) },
    { type: "top_vehicles",         fn: () => computeTopVehicles(visits) },
    { type: "popular_colors",       fn: () => computePopularColors(inventory) },
    { type: "inventory_turnover",   fn: () => computeInventoryTurnover(inventory) },
    { type: "sentiment_patterns",   fn: () => computeSentimentPatterns(visits, dealership.name, tokensRef) },
    { type: "google_review_trends", fn: () => computeGoogleReviewTrends(dealership, tokensRef) },
    { type: "credit_tier_patterns", fn: () => computeCreditTierPatterns(dealershipId, svc) },
  ];

  for (const { type, fn } of computations) {
    try {
      const { data, summary } = await fn();
      const now = new Date().toISOString();

      const { error } = await svc
        .from("dealership_insights")
        .upsert(
          {
            dealership_id: dealershipId,
            insight_type: type,
            title: INSIGHT_TITLES[type],
            summary,
            data,
            refreshed_at: now,
            is_active: true,
            updated_at: now,
          },
          { onConflict: "dealership_id,insight_type" }
        );

      if (error) throw error;
      refreshed.push(type);
    } catch (err) {
      errors.push({
        type,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    insightsRefreshed: refreshed.length,
    insightTypes: refreshed,
    tokensUsed: tokensRef.used,
    errors,
  };
}
