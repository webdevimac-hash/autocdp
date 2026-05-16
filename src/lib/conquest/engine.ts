/**
 * Conquest & Retargeting Engine — Core Logic
 *
 * Responsibilities:
 *   1. Lead scoring (extended from base customer scoring)
 *   2. Audience building — evaluate criteria JSON against conquest_leads
 *   3. CRM-to-conquest matching — surface lapsed/at-risk CRM customers
 *   4. Credit tier enrichment — batch soft-pull via 700Credit (FCRA: conquest only)
 *   5. Retargeting audience building — session aggregation from retargeting_events
 *
 * FCRA NOTE (conquest soft pulls):
 *   Conquest soft-pulls use the "prescreened offers of credit" permissible purpose
 *   (FCRA § 604(c)(1)(B)) — ONLY if the dealership has a firm offer of credit program.
 *   Without that, 700Credit enrichment on conquest leads should use list-based
 *   demographic segmentation only (not individual credit scores).
 *   This engine follows the safer path: tier-only, no raw score stored.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { fetchCreditTierBatch, type BatchCreditInput } from "@/lib/dms/seven-hundred-credit";
import { decryptTokens } from "@/lib/dms/encrypt";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreditTier = "excellent" | "good" | "fair" | "poor" | "unknown";

export interface ConquestLead {
  id:                  string;
  dealership_id:       string;
  first_name:          string | null;
  last_name:           string | null;
  email:               string | null;
  phone:               string | null;
  address:             { street?: string; city?: string; state?: string; zip?: string } | null;
  vehicle_interest:    string | null;
  source:              string;
  score:               number;
  status:              "new" | "contacted" | "converted" | "disqualified";
  credit_tier:         CreditTier | null;
  in_market_signal:    boolean;
  estimated_equity_usd: number | null;
  make_interest:       string | null;
  model_interest:      string | null;
  year_min:            number | null;
  year_max:            number | null;
  price_max_usd:       number | null;
  data_provider:       string | null;
  created_at:          string;
}

export interface AudienceCriteria {
  credit_tiers?:       CreditTier[];
  min_score?:          number;
  in_market?:          boolean;
  vehicle_interests?:  string[];  // ["SUV","Truck","Sedan"]
  makes?:              string[];
  max_price_usd?:      number;
  zip_codes?:          string[];
  statuses?:           string[];
  sources?:            string[];
  exclude_customers?:  boolean;  // exclude existing CRM customers
  max_leads?:          number;   // cap audience size (default 50000)
}

export interface AudienceBuildResult {
  audienceId:     string;
  leadCount:      number;
  enrichedCount:  number;
  inMarketCount:  number;
  leads:          Array<{ id: string; email: string | null; phone: string | null; first_name: string | null; last_name: string | null }>;
}

export interface ConquestLeadScore {
  leadId:          string;
  score:           number;  // 0–100
  creditBonus:     number;
  inMarketBonus:   number;
  interestBonus:   number;
  recencyBonus:    number;
  breakdown:       string;
}

// ---------------------------------------------------------------------------
// Lead scoring (conquest-specific, no LLM)
// ---------------------------------------------------------------------------

const CREDIT_BONUS: Record<CreditTier, number> = {
  excellent: 30,
  good:      22,
  fair:      12,
  poor:       4,
  unknown:    0,
};

export function scoreConquestLead(
  lead: ConquestLead,
  dealershipMakes?: string[]
): ConquestLeadScore {
  // Credit tier (0–30)
  const creditBonus = CREDIT_BONUS[lead.credit_tier ?? "unknown"];

  // In-market signal (0–25)
  const inMarketBonus = lead.in_market_signal ? 25 : 0;

  // Vehicle interest match (0–20): does their interest match dealership inventory?
  let interestBonus = 0;
  if (lead.vehicle_interest || lead.make_interest) {
    interestBonus = 10; // generic interest expressed
    if (
      dealershipMakes?.length &&
      lead.make_interest &&
      dealershipMakes.some((m) => m.toLowerCase() === lead.make_interest?.toLowerCase())
    ) {
      interestBonus = 20; // direct brand match
    }
  }

  // Recency of import (0–15): newer = more likely to convert
  const daysSinceImport = lead.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86_400_000))
    : 365;
  const recencyBonus = daysSinceImport <= 7
    ? 15
    : daysSinceImport <= 30
    ? 10
    : daysSinceImport <= 90
    ? 5
    : 0;

  // Contact data quality: email + phone = more reachable
  const contactBonus = ((lead.email ? 5 : 0) + (lead.phone ? 5 : 0));

  const raw = creditBonus + inMarketBonus + interestBonus + recencyBonus + contactBonus;
  const score = Math.min(100, Math.max(0, raw));

  return {
    leadId:       lead.id,
    score,
    creditBonus,
    inMarketBonus,
    interestBonus,
    recencyBonus,
    breakdown: `credit=${creditBonus} in_market=${inMarketBonus} interest=${interestBonus} recency=${recencyBonus} contact=${contactBonus}`,
  };
}

// ---------------------------------------------------------------------------
// Batch score all leads in a dealership
// ---------------------------------------------------------------------------

export async function batchScoreLeads(
  dealershipId: string,
  limit = 5000
): Promise<{ scored: number; updated: number }> {
  const svc = createServiceClient();

  const { data: leads } = await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_leads" as never)
    .select("id,first_name,last_name,email,phone,address,vehicle_interest,source,score,status,credit_tier,in_market_signal,estimated_equity_usd,make_interest,model_interest,year_min,year_max,price_max_usd,data_provider,created_at" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .limit(limit) as unknown as { data: ConquestLead[] | null };

  // Load dealership makes for brand-match scoring
  const { data: dealer } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dealerships" as never)
    .select("settings" as never)
    .eq("id" as never, dealershipId as never)
    .single() as unknown as { data: { settings: Record<string, unknown> } | null };

  const makes = (dealer?.settings?.makes as string[] | undefined) ?? [];
  let updated = 0;

  for (const lead of leads ?? []) {
    const result = scoreConquestLead(lead, makes);
    if (result.score !== lead.score) {
      await (svc as ReturnType<typeof createServiceClient>)
        .from("conquest_leads" as never)
        .update({ score: result.score } as never)
        .eq("id" as never, lead.id as never);
      updated++;
    }
  }

  return { scored: (leads ?? []).length, updated };
}

// ---------------------------------------------------------------------------
// Credit tier enrichment (batch)
// FCRA NOTE: Only use for leads with proper permissible purpose (prescreened
// offers program). Stores tier only — never raw score or bureau data.
// ---------------------------------------------------------------------------

export async function enrichCreditTiers(
  dealershipId: string,
  limit = 200
): Promise<{ enriched: number; skipped: number }> {
  const svc = createServiceClient();

  // Load 700Credit connection
  const { data: conn } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .select("encrypted_tokens" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "seven_hundred_credit" as never)
    .eq("status" as never, "active" as never)
    .single() as unknown as { data: { encrypted_tokens: string } | null };

  if (!conn) return { enriched: 0, skipped: 0 };

  const tokens = await decryptTokens<{ apiKey: string }>(conn.encrypted_tokens);

  // Load un-enriched leads with minimum contact info
  const { data: leads } = await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_leads" as never)
    .select("id,first_name,last_name,email,phone,address" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .is("credit_tier" as never, null as never)
    .not("first_name" as never, "is" as never, null as never)
    .not("last_name" as never, "is" as never, null as never)
    .limit(limit) as unknown as {
      data: Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone: string | null;
        address: { street?: string; city?: string; state?: string; zip?: string } | null;
      }> | null;
    };

  if (!leads?.length) return { enriched: 0, skipped: 0 };

  // Build batch request
  const batchInputs: BatchCreditInput[] = leads.map((l) => ({
    externalId: l.id,
    consumer: {
      firstName: l.first_name ?? "",
      lastName:  l.last_name  ?? "",
      email:     l.email      ?? undefined,
      phone:     l.phone      ?? undefined,
      address:   l.address    ?? undefined,
    },
  }));

  const results = await fetchCreditTierBatch(batchInputs, tokens.apiKey);

  let enriched = 0;
  for (const r of results) {
    await (svc as ReturnType<typeof createServiceClient>)
      .from("conquest_leads" as never)
      .update({
        credit_tier:         r.tier,
        credit_enriched_at:  new Date().toISOString(),
        data_provider:       "seven_hundred_credit",
      } as never)
      .eq("id" as never, r.externalId as never);
    enriched++;
  }

  return { enriched, skipped: leads.length - enriched };
}

// ---------------------------------------------------------------------------
// Audience building
// ---------------------------------------------------------------------------

export async function buildAudience(
  dealershipId: string,
  audienceId: string
): Promise<AudienceBuildResult> {
  const svc = createServiceClient();

  // Load audience config
  const { data: audience } = await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_audiences" as never)
    .select("id,criteria" as never)
    .eq("id" as never, audienceId as never)
    .eq("dealership_id" as never, dealershipId as never)
    .single() as unknown as { data: { id: string; criteria: AudienceCriteria } | null };

  if (!audience) throw new Error(`Audience ${audienceId} not found`);

  const c = audience.criteria;

  // Mark as building
  await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_audiences" as never)
    .update({ status: "building" } as never)
    .eq("id" as never, audienceId as never);

  // Build query
  let query = (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_leads" as never)
    .select("id,email,phone,first_name,last_name,credit_tier,in_market_signal,score,status" as never)
    .eq("dealership_id" as never, dealershipId as never);

  if (c.min_score !== undefined) {
    query = query.gte("score" as never, c.min_score as never);
  }
  if (c.credit_tiers?.length) {
    query = query.in("credit_tier" as never, c.credit_tiers as never);
  }
  if (c.in_market !== undefined) {
    query = query.eq("in_market_signal" as never, c.in_market as never);
  }
  if (c.statuses?.length) {
    query = query.in("status" as never, c.statuses as never);
  }

  const { data: leads } = await (query
    .order("score" as never, { ascending: false })
    .limit(c.max_leads ?? 50000)) as unknown as { data: Array<{
      id: string;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      credit_tier: CreditTier | null;
      in_market_signal: boolean;
      score: number;
      status: string;
    }> | null };

  const allLeads = leads ?? [];

  // Optionally exclude existing CRM customers (by email/phone match)
  let finalLeads = allLeads;
  if (c.exclude_customers) {
    const emails = allLeads.map((l) => l.email).filter(Boolean) as string[];
    if (emails.length) {
      const { data: crmMatches } = await (svc as ReturnType<typeof createServiceClient>)
        .from("customers" as never)
        .select("email" as never)
        .eq("dealership_id" as never, dealershipId as never)
        .in("email" as never, emails as never) as unknown as { data: Array<{ email: string }> | null };

      const crmEmailSet = new Set((crmMatches ?? []).map((c) => c.email));
      finalLeads = allLeads.filter((l) => !l.email || !crmEmailSet.has(l.email));
    }
  }

  // Update audience membership
  const leadIds = finalLeads.map((l) => l.id);
  if (leadIds.length > 0) {
    await (svc as ReturnType<typeof createServiceClient>)
      .from("conquest_leads" as never)
      .update({
        audience_id:       audienceId,
        audience_synced_at: new Date().toISOString(),
      } as never)
      .in("id" as never, leadIds as never);
  }

  const enrichedCount  = finalLeads.filter((l) => l.credit_tier && l.credit_tier !== "unknown").length;
  const inMarketCount  = finalLeads.filter((l) => l.in_market_signal).length;

  // Update audience stats
  await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_audiences" as never)
    .update({
      lead_count:     finalLeads.length,
      enriched_count: enrichedCount,
      in_market_count: inMarketCount,
      status:         "ready",
      last_built_at:  new Date().toISOString(),
      build_error:    null,
    } as never)
    .eq("id" as never, audienceId as never);

  return {
    audienceId,
    leadCount:     finalLeads.length,
    enrichedCount,
    inMarketCount,
    leads: finalLeads.map((l) => ({
      id:         l.id,
      email:      l.email,
      phone:      l.phone,
      first_name: l.first_name,
      last_name:  l.last_name,
    })),
  };
}

// ---------------------------------------------------------------------------
// CRM-to-conquest matching
// Find CRM customers who haven't bought in >N months and may be in-market
// ---------------------------------------------------------------------------

export async function findCrmConquestTargets(
  dealershipId: string,
  inactiveDays = 180
): Promise<{ imported: number }> {
  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - inactiveDays * 86_400_000).toISOString();

  const { data: customers } = await (svc as ReturnType<typeof createServiceClient>)
    .from("customers" as never)
    .select("id,first_name,last_name,email,phone,address,lifecycle_stage,last_visit_date,metadata" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .in("lifecycle_stage" as never, ["lapsed","at_risk"] as never)
    .lt("last_visit_date" as never, cutoff as never)
    .limit(1000) as unknown as {
      data: Array<{
        id: string;
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
        address: Record<string, string> | null;
        lifecycle_stage: string;
        last_visit_date: string | null;
        metadata: Record<string, unknown>;
      }> | null;
    };

  // Load existing conquest lead emails/phones to avoid duplication
  const existingEmails = new Set<string>();
  const { data: existing } = await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_leads" as never)
    .select("email,phone" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .not("email" as never, "is" as never, null as never) as unknown as {
      data: Array<{ email: string; phone: string }> | null;
    };

  for (const e of existing ?? []) {
    if (e.email) existingEmails.add(e.email.toLowerCase());
  }

  let imported = 0;
  for (const c of customers ?? []) {
    if (c.email && existingEmails.has(c.email.toLowerCase())) continue;

    const inactiveDayCount = c.last_visit_date
      ? Math.floor((Date.now() - new Date(c.last_visit_date).getTime()) / 86_400_000)
      : 999;

    await (svc as ReturnType<typeof createServiceClient>)
      .from("conquest_leads" as never)
      .insert({
        dealership_id:   dealershipId,
        first_name:      c.first_name,
        last_name:       c.last_name,
        email:           c.email,
        phone:           c.phone,
        address:         c.address,
        vehicle_interest: (c.metadata?.last_vehicle_interest as string | undefined) ?? null,
        source:          "crm_lapsed",
        score:           c.lifecycle_stage === "at_risk" ? 45 : 30,
        status:          "new",
        in_market_signal: inactiveDayCount > 365,  // haven't visited in >1yr — likely shopping
        data_provider:   "crm",
      } as never);

    if (c.email) existingEmails.add(c.email.toLowerCase());
    imported++;
  }

  return { imported };
}

// ---------------------------------------------------------------------------
// AI-powered lead qualification (uses Claude Haiku for batch efficiency)
// Generates a 1-line outreach hook for the top leads in an audience
// ---------------------------------------------------------------------------

export async function generateOutreachHooks(
  dealershipId: string,
  audienceId: string,
  maxLeads = 20
): Promise<Array<{ leadId: string; hook: string }>> {
  const svc = createServiceClient();

  const { data: leads } = await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_leads" as never)
    .select("id,first_name,vehicle_interest,make_interest,credit_tier,in_market_signal,score" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("audience_id" as never, audienceId as never)
    .order("score" as never, { ascending: false })
    .limit(maxLeads) as unknown as {
      data: Array<{
        id: string;
        first_name: string | null;
        vehicle_interest: string | null;
        make_interest: string | null;
        credit_tier: CreditTier | null;
        in_market_signal: boolean;
        score: number;
      }> | null;
    };

  const { data: dealer } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dealerships" as never)
    .select("name,settings" as never)
    .eq("id" as never, dealershipId as never)
    .single() as unknown as { data: { name: string; settings: Record<string, unknown> } | null };

  if (!leads?.length) return [];

  const client = getAnthropicClient();
  const results: Array<{ leadId: string; hook: string }> = [];

  // Batch into groups of 10 for efficiency
  const chunks: typeof leads[] = [];
  for (let i = 0; i < leads.length; i += 10) chunks.push(leads.slice(i, i + 10));

  for (const chunk of chunks) {
    const prompt = `You are a conquest marketing specialist for ${dealer?.name ?? "a dealership"}.
Generate one personalised outreach hook (max 20 words) for each prospect below.
Focus on their vehicle interest and credit tier. Be warm, not pushy.
Output JSON array: [{"leadId":"...","hook":"..."}]

Prospects:
${chunk.map((l) => JSON.stringify({
  leadId: l.id,
  firstName: l.first_name ?? "there",
  interest: l.vehicle_interest ?? l.make_interest ?? "vehicle",
  creditTier: l.credit_tier ?? "unknown",
  inMarket: l.in_market_signal,
  score: l.score,
})).join("\n")}`;

    try {
      const resp = await client.messages.create({
        model:      MODELS.fast,
        max_tokens: 500,
        messages:   [{ role: "user", content: prompt }],
      });
      const text  = resp.content[0].type === "text" ? resp.content[0].text : "[]";
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Array<{ leadId: string; hook: string }>;
        results.push(...parsed);
      }
    } catch {
      // Non-fatal — continue
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Retargeting audience builder — aggregates pixel events
// ---------------------------------------------------------------------------

export interface RetargetingAudienceResult {
  sessionCount:   number;
  matchedCrm:     number;
  sessions:       string[];
}

export async function buildRetargetingAudience(
  dealershipId: string,
  audienceId: string
): Promise<RetargetingAudienceResult> {
  const svc = createServiceClient();

  const { data: audience } = await (svc as ReturnType<typeof createServiceClient>)
    .from("retargeting_audiences" as never)
    .select("rule_type,rule_config" as never)
    .eq("id" as never, audienceId as never)
    .eq("dealership_id" as never, dealershipId as never)
    .single() as unknown as {
      data: { rule_type: string; rule_config: Record<string, unknown> } | null;
    };

  if (!audience) throw new Error(`Retargeting audience ${audienceId} not found`);

  const rc   = audience.rule_config;
  const days = Number(rc.days ?? 30);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let eventsQuery = (svc as ReturnType<typeof createServiceClient>)
    .from("retargeting_events" as never)
    .select("session_id,customer_id" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .gte("created_at" as never, since as never);

  // Apply rule-specific filters
  switch (audience.rule_type) {
    case "vdp_viewers":
      eventsQuery = eventsQuery.eq("event_type" as never, "vdp_view" as never);
      break;
    case "srp_viewers":
      eventsQuery = eventsQuery.eq("event_type" as never, "srp_view" as never);
      break;
    case "lead_form_starters":
      eventsQuery = eventsQuery.in("event_type" as never, ["lead_form_start","lead_form_submit"] as never);
      break;
    case "high_intent": {
      const intentEvents = (rc.events as string[]) ?? ["lead_form_start","trade_tool","finance_tool"];
      eventsQuery = eventsQuery.in("event_type" as never, intentEvents as never);
      break;
    }
    case "specific_vin_viewers":
      if (rc.vin) eventsQuery = eventsQuery.eq("vin" as never, rc.vin as never);
      break;
    // all_visitors and price_range_viewers: no additional filter (price handled in JS)
  }

  const { data: events } = await (eventsQuery.limit(100000)) as unknown as {
    data: Array<{ session_id: string; customer_id: string | null }> | null;
  };

  const uniqueSessions = [...new Set((events ?? []).map((e) => e.session_id))];
  const matchedCustomers = new Set(
    (events ?? []).map((e) => e.customer_id).filter(Boolean)
  );

  // Update audience
  await (svc as ReturnType<typeof createServiceClient>)
    .from("retargeting_audiences" as never)
    .update({
      session_count:  uniqueSessions.length,
      matched_crm:    matchedCustomers.size,
      status:         "ready",
      last_built_at:  new Date().toISOString(),
    } as never)
    .eq("id" as never, audienceId as never);

  return {
    sessionCount: uniqueSessions.length,
    matchedCrm:   matchedCustomers.size,
    sessions:     uniqueSessions.slice(0, 1000), // cap for ad platform upload
  };
}
