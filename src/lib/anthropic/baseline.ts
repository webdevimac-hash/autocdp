/**
 * Loads the top N baseline mail examples for a dealership.
 * Used by all orchestrators to inject style context into the Creative Agent.
 */

import { createServiceClient } from "@/lib/supabase/server";

export type BaselineExample = {
  example_text: string;
  mail_type: string | null;
  notes: string | null;
};

export async function loadBaselineExamples(
  dealershipId: string,
  limit = 8
): Promise<BaselineExample[]> {
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("baseline_mail_examples")
      .select("example_text, mail_type, notes")
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false })
      .limit(limit) as unknown as { data: BaselineExample[] | null };
    return data ?? [];
  } catch {
    return [];
  }
}
