/**
 * Deterministic customer scoring — fast pre-filter for high-volume campaigns.
 *
 * Scores each customer 0–100 using observable signals only (no LLM calls).
 * Customers below SCORE_THRESHOLD are skipped before the agent swarm runs,
 * saving tokens and API latency on genuinely cold contacts.
 *
 * Score breakdown (total: 100):
 *   Recency   (0–40) — days since last visit, linear decay 30d → 365d
 *   Frequency (0–25) — total visits, logarithmic up to 20 visits
 *   Spend     (0–20) — lifetime spend, linear up to $10,000
 *   Lifecycle (0–15) — enum bonus: VIP=15, active=12, at_risk=8, lapsed=4, prospect=1
 */

import type { Customer } from "@/types";

/** Customers scoring below this are skipped before agent swarm. */
export const SCORE_THRESHOLD = 15;

export interface CustomerScore {
  customerId: string;
  score: number;
  recencyScore: number;
  frequencyScore: number;
  spendScore: number;
  lifecycleScore: number;
  meetsThreshold: boolean;
}

const LIFECYCLE_BONUS: Record<string, number> = {
  vip:      15,
  active:   12,
  at_risk:   8,
  lapsed:    4,
  prospect:  1,
};

function calcRecency(lastVisitDate: string | null): number {
  if (!lastVisitDate) return 0;
  const daysSince = Math.floor(
    (Date.now() - new Date(lastVisitDate).getTime()) / 86_400_000
  );
  if (daysSince <= 30) return 40;
  if (daysSince >= 365) return 0;
  return Math.round(40 * (1 - (daysSince - 30) / (365 - 30)));
}

function calcFrequency(totalVisits: number): number {
  if (totalVisits <= 0) return 0;
  return Math.min(25, Math.round((Math.log(totalVisits) / Math.log(20)) * 25));
}

function calcSpend(totalSpend: number): number {
  if (totalSpend <= 0) return 0;
  return Math.min(20, Math.round((totalSpend / 10_000) * 20));
}

/** Score a single customer deterministically. O(1), no I/O. */
export function scoreCustomer(customer: Customer): CustomerScore {
  const recencyScore   = calcRecency(customer.last_visit_date);
  const frequencyScore = calcFrequency(customer.total_visits);
  const spendScore     = calcSpend(customer.total_spend);
  const lifecycleScore = LIFECYCLE_BONUS[customer.lifecycle_stage] ?? 1;
  const score = recencyScore + frequencyScore + spendScore + lifecycleScore;

  return {
    customerId: customer.id,
    score,
    recencyScore,
    frequencyScore,
    spendScore,
    lifecycleScore,
    meetsThreshold: score >= SCORE_THRESHOLD,
  };
}

// ── Aged inventory scoring ────────────────────────────────────

export interface AgedInventoryScore extends CustomerScore {
  inventoryMatchStrength: "perfect" | "strong" | "partial" | "none";
  inventoryMatchBonus: number;
  totalWithInventory: number;
}

/**
 * Score a customer for an aged inventory campaign.
 * Adds a match-strength bonus on top of the base RFM score.
 */
export function scoreCustomerForAgedInventory(
  customer: Customer,
  matchStrength: "perfect" | "strong" | "partial" | "none"
): AgedInventoryScore {
  const base = scoreCustomer(customer);
  const bonus =
    matchStrength === "perfect" ? 25 :
    matchStrength === "strong"  ? 15 :
    matchStrength === "partial" ?  5 : 0;

  return {
    ...base,
    inventoryMatchStrength: matchStrength,
    inventoryMatchBonus: bonus,
    totalWithInventory: base.score + bonus,
  };
}

/**
 * Filter and rank a customer list before running the agent swarm.
 *
 * Returns the passing customers sorted by score descending (highest-value
 * customers get their copy generated first), plus a count of how many were
 * filtered out so the caller can log/report it.
 *
 * @param respectThreshold  When false, skips the score cut-off and ranks all
 *   customers by score. Use this for prospect/lead campaigns where the scoring
 *   model has no signal yet (total_visits=0, lifecycle_stage="prospect").
 *   Default: true (normal production behaviour).
 */
export function filterAndRankCustomers(
  customers: Customer[],
  threshold = SCORE_THRESHOLD,
  respectThreshold = true
): { customers: Customer[]; scores: CustomerScore[]; filtered: number } {
  const scoreMap = new Map<string, CustomerScore>();
  for (const c of customers) {
    scoreMap.set(c.id, scoreCustomer(c));
  }

  const passing = customers
    .filter((c) => !respectThreshold || (scoreMap.get(c.id)?.score ?? 0) >= threshold)
    .sort((a, b) => (scoreMap.get(b.id)?.score ?? 0) - (scoreMap.get(a.id)?.score ?? 0));

  return {
    customers: passing,
    scores: passing.map((c) => scoreMap.get(c.id)!),
    filtered: customers.length - passing.length,
  };
}
