/**
 * Loads the top N baseline mail examples for a dealership.
 * Used by all orchestrators to inject style context into the Creative Agent.
 * Supports both text-paste and uploaded image/PDF examples (with vision analysis).
 */

import { createServiceClient } from "@/lib/supabase/server";

export type BaselineExample = {
  example_text: string;
  mail_type: string | null;
  notes: string | null;
  /** Supabase Storage public URL — present for image/pdf uploads */
  file_url: string | null;
  /** AI-generated visual layout description produced at upload time */
  visual_description: string | null;
  /** How this example was added: "text" (paste) | "image" | "pdf" */
  source_type: "text" | "image" | "pdf";
};

export async function loadBaselineExamples(
  dealershipId: string,
  limit = 8
): Promise<BaselineExample[]> {
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("baseline_mail_examples")
      .select("example_text, mail_type, notes, file_url, visual_description, source_type")
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false })
      .limit(limit) as unknown as { data: BaselineExample[] | null };
    return (data ?? []).map((ex) => ({
      ...ex,
      source_type: (ex.source_type ?? "text") as "text" | "image" | "pdf",
    }));
  } catch {
    return [];
  }
}
