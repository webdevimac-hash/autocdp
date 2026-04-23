/**
 * Aged Inventory Campaign utilities
 *
 * Matches customers to specific aging vehicles using service history,
 * make/model signals from visits, and color mentions in service notes.
 * Used by the orchestrator when campaignType === "aged_inventory".
 */

import type { Customer, Visit, InventoryVehicle, AgedInventoryMatch, CustomerVehicleInterest } from "@/types";

const COLOR_KEYWORDS = [
  "white", "black", "silver", "gray", "grey", "red", "blue", "green",
  "brown", "beige", "gold", "orange", "yellow", "purple", "maroon",
  "navy", "pearl", "champagne", "charcoal", "platinum",
];

/** Extract vehicle interests from a customer's full visit history. */
export function extractCustomerInterests(
  customerId: string,
  visits: Visit[]
): CustomerVehicleInterest {
  const customerVisits = visits
    .filter((v) => v.customer_id === customerId)
    .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());

  const makes = [...new Set(customerVisits.map((v) => v.make).filter(Boolean) as string[])];
  const models = [...new Set(customerVisits.map((v) => v.model).filter(Boolean) as string[])];

  const colors: string[] = [];
  for (const visit of customerVisits) {
    if (!visit.service_notes) continue;
    const notes = visit.service_notes.toLowerCase();
    for (const color of COLOR_KEYWORDS) {
      if (notes.includes(color) && !colors.includes(color)) {
        colors.push(color);
      }
    }
  }

  return {
    customerId,
    makes,
    models,
    colors,
    primaryMake: makes[0] ?? null,
    primaryModel: models[0] ?? null,
  };
}

/** Score how well a specific vehicle matches a customer's interest profile. */
function vehicleMatchScore(
  interest: CustomerVehicleInterest,
  vehicle: InventoryVehicle
): { score: number; strength: AgedInventoryMatch["matchStrength"]; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (vehicle.make) {
    const makeMatch = interest.makes.some(
      (m) => m.toLowerCase() === vehicle.make!.toLowerCase()
    );
    if (makeMatch) {
      score += 50;
      reasons.push(`same make: ${vehicle.make}`);
    }
  }

  if (vehicle.model) {
    const modelMatch = interest.models.some(
      (m) => m.toLowerCase() === vehicle.model!.toLowerCase()
    );
    if (modelMatch) {
      score += 30;
      reasons.push(`same model: ${vehicle.model}`);
    }
  }

  if (vehicle.color) {
    const vColor = vehicle.color.toLowerCase();
    const colorMatch = interest.colors.some((c) => vColor.includes(c) || c.includes(vColor));
    if (colorMatch) {
      score += 20;
      reasons.push(`color interest: ${vehicle.color}`);
    }
  }

  const strength: AgedInventoryMatch["matchStrength"] =
    score >= 80 ? "perfect" :
    score >= 50 ? "strong" :
    "partial";

  return { score, strength, reasons };
}

/**
 * Match each customer to the best-fit aged vehicle.
 * Returns a map of customerId → AgedInventoryMatch.
 * Only customers with at least a make-level match (score ≥ 50) are included.
 */
export function matchCustomersToVehicles(
  customers: Customer[],
  visits: Visit[],
  agedVehicles: InventoryVehicle[],
  minDaysOnLot = 45
): Map<string, AgedInventoryMatch> {
  const bestMatches = new Map<string, AgedInventoryMatch>();
  const eligibleVehicles = agedVehicles.filter(
    (v) => v.days_on_lot >= minDaysOnLot && v.status === "available"
  );

  if (!eligibleVehicles.length) return bestMatches;

  for (const customer of customers) {
    const interest = extractCustomerInterests(customer.id, visits);
    let bestScore = -1;
    let bestMatch: AgedInventoryMatch | null = null;

    for (const vehicle of eligibleVehicles) {
      const { score, strength, reasons } = vehicleMatchScore(interest, vehicle);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { vehicle, customerId: customer.id, matchStrength: strength, matchReasons: reasons };
      }
    }

    // Only assign if at least a make-level match exists
    if (bestMatch && bestScore >= 50) {
      bestMatches.set(customer.id, bestMatch);
    }
  }

  return bestMatches;
}

/** Format a vehicle assignment as a terse inventory section for prompt injection. */
export function formatAssignedVehicleForPrompt(match: AgedInventoryMatch): string {
  const v = match.vehicle;
  const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  const price = v.price ? `$${Number(v.price).toLocaleString()}` : "call for price";
  const color = v.color ? ` | Color: ${v.color}` : "";
  const mileage = v.mileage ? ` | ${v.mileage.toLocaleString()} miles` : "";
  const condition = v.condition ? ` | ${v.condition.toUpperCase()}` : "";

  return (
    `ASSIGNED AGED VEHICLE — MUST reference this specific vehicle in your copy:\n` +
    `  ${name}${condition}${color}${mileage}\n` +
    `  Price: ${price} | Days on lot: ${v.days_on_lot} (motivated to move)\n` +
    `  Match reasons: ${match.matchReasons.join(", ")} (why this vehicle fits this customer)\n` +
    `  Write copy that references the exact vehicle year/make/model and its ${v.days_on_lot}-day lot tenure.\n` +
    `  Example opener: "We have a ${v.year} ${v.make} ${v.model} that I thought of when your name came up..."`
  );
}
