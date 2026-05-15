/**
 * Trigger Watcher — Autonomous Micro-Campaign Opportunity Scanner
 *
 * Scans customer/inventory/visit data for high-potential campaign triggers.
 * Rule-based (no LLM call) — deterministic, fast, and cheap to run.
 *
 * Returns TriggerOpportunity[] that the dealer can approve or dismiss
 * with one click from the campaign builder or dashboard.
 *
 * Trigger types:
 *   lapsed_customers     — 180+ days inactive, lifecycle active/at_risk/lapsed
 *   aged_inventory       — vehicles 60+ days on lot, match to likely buyers
 *   service_due          — 90–365 day window, active/VIP customers
 *   vip_appreciation     — VIP customers; premium loyalty mailer
 *   at_risk_retention    — at_risk customers approaching lapse threshold
 */
import { createServiceClient } from "@/lib/supabase/server";
import type { AgentContext } from "@/types";

// ── Types ─────────────────────────────────────────────────────

export type TriggerType =
  | "lapsed_customers"
  | "aged_inventory"
  | "service_due"
  | "vip_appreciation"
  | "at_risk_retention";

export type TriggerUrgency = "high" | "medium" | "low";

export interface TriggerOpportunity {
  id: string;
  type: TriggerType;
  urgency: TriggerUrgency;
  title: string;
  description: string;
  customerCount: number;
  /** Pre-filled campaignGoal text for the builder */
  suggestedGoal: string;
  suggestedChannel: "direct_mail" | "sms" | "email";
  suggestedTemplate?: "postcard_6x9" | "letter_6x9" | "letter_8.5x11";
  estimatedROI: string;
  /** ISO timestamp when the watcher detected this */
  detectedAt: string;
  /** Customer IDs to pre-populate the audience (max 200) */
  customerIds: string[];
}

export interface TriggerWatcherOutput {
  opportunities: TriggerOpportunity[];
  scannedAt: string;
  dealershipId: string;
}

// ── Watcher ───────────────────────────────────────────────────

export async function runTriggerWatcher(
  context: AgentContext,
  options?: { maxOpportunities?: number }
): Promise<TriggerWatcherOutput> {
  const supabase = createServiceClient();
  const now = new Date();
  const opportunities: TriggerOpportunity[] = [];
  const max = options?.maxOpportunities ?? 5;

  // ── 1. Lapsed customers (180+ days, active/at_risk/lapsed) ───
  try {
    const lapsedCutoff = new Date(
      now.getTime() - 180 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: lapsed } = await (supabase
      .from("customers")
      .select("id")
      .eq("dealership_id", context.dealershipId)
      .in("lifecycle_stage", ["active", "at_risk", "lapsed"])
      .lt("last_visit_date", lapsedCutoff)
      .not("last_visit_date", "is", null)
      .order("last_visit_date", { ascending: true })
      .limit(200) as unknown as Promise<{ data: { id: string }[] | null }>);

    if ((lapsed?.length ?? 0) >= 5) {
      const count = lapsed!.length;
      opportunities.push({
        id: `lapsed_${now.toISOString().slice(0, 10)}`,
        type: "lapsed_customers",
        urgency: count > 30 ? "high" : "medium",
        title: `${count} Lapsed Customers Need Re-Engagement`,
        description: `${count} customers haven't visited in 180+ days. A personalized mailer now can recover 8–15% before competitors do.`,
        customerCount: count,
        suggestedGoal:
          "Win back lapsed customers with a personalized service offer and a concrete reason to return this month",
        suggestedChannel: "direct_mail",
        suggestedTemplate: "postcard_6x9",
        estimatedROI: `$${Math.round(count * 0.10 * 280).toLocaleString()}–$${Math.round(count * 0.15 * 280).toLocaleString()} in recovered service revenue`,
        detectedAt: now.toISOString(),
        customerIds: lapsed!.map((c) => c.id),
      });
    }
  } catch { /* non-fatal */ }

  // ── 2. Aged inventory (60+ days on lot) ──────────────────────
  try {
    const { data: aged } = await (supabase
      .from("inventory")
      .select("id, make, model, year, days_on_lot")
      .eq("dealership_id", context.dealershipId)
      .eq("status", "available")
      .gte("days_on_lot", 60)
      .order("days_on_lot", { ascending: false })
      .limit(20) as unknown as Promise<{
        data: {
          id: string;
          make: string | null;
          model: string | null;
          year: number | null;
          days_on_lot: number;
        }[] | null
      }>);

    if ((aged?.length ?? 0) >= 1) {
      const count = aged!.length;
      const top = aged![0];
      const topLabel =
        [top.year, top.make, top.model].filter(Boolean).join(" ") ||
        "inventory";
      const hasCritical = aged!.some((v) => v.days_on_lot >= 90);

      opportunities.push({
        id: `aged_inventory_${now.toISOString().slice(0, 10)}`,
        type: "aged_inventory",
        urgency: hasCritical ? "high" : "medium",
        title: `${count} Vehicle${count > 1 ? "s" : ""} Aging on Lot — Match to Interested Buyers`,
        description: `${count} unit${count > 1 ? "s have" : " has"} been on the lot 60+ days. The AI will match each to customers who serviced that make/model.`,
        customerCount: 0, // resolved at launch time by matching engine
        suggestedGoal: `Move aged inventory — focus on the ${topLabel} that ${hasCritical ? "has been sitting 90+ days" : "needs to move"}`,
        suggestedChannel: "direct_mail",
        suggestedTemplate: "postcard_6x9",
        estimatedROI: `$${(count * 800).toLocaleString()}–$${(count * 2_400).toLocaleString()} gross profit if ${Math.max(1, Math.round(count * 0.25))} unit${count > 4 ? "s" : ""} sold`,
        detectedAt: now.toISOString(),
        customerIds: [], // matching engine fills at send time
      });
    }
  } catch { /* non-fatal */ }

  // ── 3. Service due window (90–365 days since last visit) ──────
  try {
    const low = new Date(
      now.getTime() - 365 * 24 * 60 * 60 * 1000
    ).toISOString();
    const high = new Date(
      now.getTime() - 90 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: due } = await (supabase
      .from("customers")
      .select("id")
      .eq("dealership_id", context.dealershipId)
      .in("lifecycle_stage", ["active", "vip"])
      .gte("last_visit_date", low)
      .lt("last_visit_date", high)
      .order("last_visit_date", { ascending: true })
      .limit(200) as unknown as Promise<{ data: { id: string }[] | null }>);

    if ((due?.length ?? 0) >= 10) {
      const count = due!.length;
      opportunities.push({
        id: `service_due_${now.toISOString().slice(0, 10)}`,
        type: "service_due",
        urgency: "medium",
        title: `${count} Active Customers Are Due for Service`,
        description: `${count} active customers are in the 3–12 month routine service window — prime time for a specific reminder before they go elsewhere.`,
        customerCount: count,
        suggestedGoal:
          "Remind active customers their vehicle is due for routine service — reference their specific vehicle and include an offer to bring them in",
        suggestedChannel: "sms",
        estimatedROI: `$${Math.round(count * 0.22 * 185).toLocaleString()}–$${Math.round(count * 0.30 * 185).toLocaleString()} in service revenue`,
        detectedAt: now.toISOString(),
        customerIds: due!.map((c) => c.id),
      });
    }
  } catch { /* non-fatal */ }

  // ── 4. VIP appreciation ───────────────────────────────────────
  try {
    const { data: vips } = await (supabase
      .from("customers")
      .select("id")
      .eq("dealership_id", context.dealershipId)
      .eq("lifecycle_stage", "vip")
      .limit(100) as unknown as Promise<{ data: { id: string }[] | null }>);

    if ((vips?.length ?? 0) >= 3) {
      const count = vips!.length;
      opportunities.push({
        id: `vip_appreciation_${now.toISOString().slice(0, 10)}`,
        type: "vip_appreciation",
        urgency: "low",
        title: `Appreciate ${count} VIP Customer${count > 1 ? "s" : ""} with a Premium Mailer`,
        description: `Your ${count} VIP customers drive outsized revenue. A handwritten-style letter builds loyalty and triples referral probability.`,
        customerCount: count,
        suggestedGoal:
          "Appreciate VIP customers with a personal thank-you note and an exclusive offer — no hard sell, genuine relationship",
        suggestedChannel: "direct_mail",
        suggestedTemplate: "letter_6x9",
        estimatedROI: `Referral + retention value: $${(count * 120).toLocaleString()}–$${(count * 350).toLocaleString()}`,
        detectedAt: now.toISOString(),
        customerIds: vips!.map((c) => c.id),
      });
    }
  } catch { /* non-fatal */ }

  // ── 5. At-risk retention ──────────────────────────────────────
  try {
    const { data: atRisk } = await (supabase
      .from("customers")
      .select("id")
      .eq("dealership_id", context.dealershipId)
      .eq("lifecycle_stage", "at_risk")
      .limit(100) as unknown as Promise<{ data: { id: string }[] | null }>);

    if ((atRisk?.length ?? 0) >= 5) {
      const count = atRisk!.length;
      opportunities.push({
        id: `at_risk_${now.toISOString().slice(0, 10)}`,
        type: "at_risk_retention",
        urgency: "high",
        title: `${count} At-Risk Customers — Act Before They Lapse`,
        description: `${count} customers are classified at-risk. A targeted retention mailer now costs ~$${(count * 1.2).toFixed(0)} vs. $${(count * 280 * 0.10).toFixed(0)} to re-acquire them later.`,
        customerCount: count,
        suggestedGoal:
          "Retain at-risk customers with a low-pressure reminder of the relationship — reference their specific vehicle history and offer something exclusive to bring them back",
        suggestedChannel: "direct_mail",
        suggestedTemplate: "postcard_6x9",
        estimatedROI: `Retention value: $${Math.round(count * 0.35 * 280).toLocaleString()}–$${Math.round(count * 0.50 * 280).toLocaleString()}`,
        detectedAt: now.toISOString(),
        customerIds: atRisk!.map((c) => c.id),
      });
    }
  } catch { /* non-fatal */ }

  // Sort: high → medium → low
  const urgencyRank: Record<TriggerUrgency, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  opportunities.sort(
    (a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]
  );

  return {
    opportunities: opportunities.slice(0, max),
    scannedAt: now.toISOString(),
    dealershipId: context.dealershipId,
  };
}
