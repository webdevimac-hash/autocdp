import { createServiceClient } from "@/lib/supabase/server";

export type MemoryCategory = "tone" | "offers" | "avoid" | "style" | "general";

export interface DealershipMemory {
  id: string;
  dealership_id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function loadDealershipMemories(
  dealershipId: string
): Promise<DealershipMemory[]> {
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("dealership_memories")
      .select("*")
      .eq("dealership_id", dealershipId)
      .eq("is_active", true)
      .order("category")
      .order("created_at", { ascending: false }) as unknown as { data: DealershipMemory[] | null };
    return data ?? [];
  } catch {
    return [];
  }
}

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  tone:    "TONE & VOICE",
  offers:  "OFFERS TO HIGHLIGHT",
  avoid:   "THINGS TO AVOID",
  style:   "STYLE PREFERENCES",
  general: "GENERAL GUIDANCE",
};

export function formatMemoriesForPrompt(memories: DealershipMemory[]): string {
  if (!memories.length) return "";

  const byCategory = new Map<MemoryCategory, DealershipMemory[]>();
  for (const m of memories) {
    const list = byCategory.get(m.category) ?? [];
    list.push(m);
    byCategory.set(m.category, list);
  }

  const sections: string[] = [];
  for (const [cat, items] of byCategory) {
    const label = CATEGORY_LABELS[cat] ?? cat.toUpperCase();
    const lines = items.map((m) => `  • ${m.title}: ${m.content}`).join("\n");
    sections.push(`${label}:\n${lines}`);
  }

  return (
    `\nDEALER GUIDANCE & MEMORIES — soft suggestions from your team. Consider these carefully but use good judgment:\n` +
    sections.join("\n\n") +
    `\n`
  );
}
