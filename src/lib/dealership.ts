/**
 * Multi-rooftop dealership helpers.
 *
 * Provides a single source of truth for "which dealership is the current user acting as."
 * Reads the `active_dealership_id` cookie when a user belongs to multiple dealerships.
 * Falls back to the first membership for single-rooftop users (no cookie required).
 */

import { cookies } from "next/headers";
import { createClient } from "./supabase/server";

export interface DealershipMembership {
  dealership_id: string;
  dealership_name: string;
  role: string;
}

/**
 * Return the currently active dealership ID for this user.
 * Respects the `active_dealership_id` cookie for multi-rooftop users.
 */
export async function getActiveDealershipId(userId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", userId) as { data: { dealership_id: string }[] | null };

  if (!memberships?.length) return null;
  if (memberships.length === 1) return memberships[0].dealership_id;

  // Multi-rooftop: honour the cookie
  try {
    const cookieStore = await cookies();
    const cookieId = cookieStore.get("active_dealership_id")?.value;
    if (cookieId && memberships.some((m) => m.dealership_id === cookieId)) {
      return cookieId;
    }
  } catch {
    // cookies() unavailable in some edge contexts — fall through
  }

  return memberships[0].dealership_id;
}

/**
 * Return all dealerships the user belongs to (for the sidebar switcher).
 */
export async function getAllUserDealerships(
  userId: string
): Promise<DealershipMembership[]> {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("user_dealerships")
    .select("dealership_id, role")
    .eq("user_id", userId) as {
      data: { dealership_id: string; role: string }[] | null;
    };

  if (!memberships?.length) return [];

  const ids = memberships.map((m) => m.dealership_id);
  const { data: dealerships } = await supabase
    .from("dealerships")
    .select("id, name")
    .in("id", ids) as { data: { id: string; name: string }[] | null };

  return memberships.map((m) => ({
    dealership_id: m.dealership_id,
    dealership_name:
      dealerships?.find((d) => d.id === m.dealership_id)?.name ?? "Unknown Dealership",
    role: m.role,
  }));
}
