import { createServiceClient } from "@/lib/supabase/server";

export type MemoryCategory = "tone" | "offers" | "avoid" | "style" | "general" | "compliance";
export type MemoryStrength = "soft" | "hard";

export interface DealershipMemory {
  id: string;
  dealership_id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  strength: MemoryStrength;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemoryAuditContext {
  total: number;
  hardCount: number;
  softCount: number;
  memories: Array<{ id: string; title: string; category: MemoryCategory; strength: MemoryStrength }>;
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
      .order("strength", { ascending: false }) // hard first
      .order("category")
      .order("created_at", { ascending: false }) as unknown as { data: DealershipMemory[] | null };
    return data ?? [];
  } catch {
    return [];
  }
}

/** Returns a compact summary suitable for audit_log metadata. */
export function buildMemoryAuditContext(memories: DealershipMemory[]): MemoryAuditContext {
  return {
    total: memories.length,
    hardCount: memories.filter((m) => m.strength === "hard").length,
    softCount: memories.filter((m) => m.strength === "soft").length,
    memories: memories.map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      strength: m.strength,
    })),
  };
}

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  compliance: "COMPLIANCE RULES",
  tone:       "TONE & VOICE",
  offers:     "OFFERS TO HIGHLIGHT",
  avoid:      "THINGS TO AVOID",
  style:      "STYLE PREFERENCES",
  general:    "GENERAL GUIDANCE",
};

/**
 * Formats memories into a prompt section.
 *
 * Hard constraints come first, framed as non-negotiable rules.
 * Soft constraints follow, framed as strong guidance.
 * Compliance rules are always treated as hard regardless of strength field.
 */
export function formatMemoriesForPrompt(memories: DealershipMemory[]): string {
  if (!memories.length) return "";

  const hard = memories.filter((m) => m.strength === "hard" || m.category === "compliance");
  const soft = memories.filter((m) => m.strength === "soft" && m.category !== "compliance");

  const sections: string[] = [];

  // ── Hard constraints (must follow) ────────────────────────────
  if (hard.length > 0) {
    const byCategory = new Map<MemoryCategory, DealershipMemory[]>();
    for (const m of hard) {
      const list = byCategory.get(m.category) ?? [];
      list.push(m);
      byCategory.set(m.category, list);
    }

    const hardLines: string[] = [];
    for (const [cat, items] of byCategory) {
      const label = CATEGORY_LABELS[cat] ?? cat.toUpperCase();
      hardLines.push(`${label}:`);
      hardLines.push(...items.map((m) => `  • [REQUIRED] ${m.title}: ${m.content}`));
    }

    sections.push(
      `⚠ GM DIRECTIVES — HARD CONSTRAINTS (MUST FOLLOW — do not override regardless of data):\n` +
      hardLines.join("\n")
    );
  }

  // ── Soft guidance (strong suggestions) ────────────────────────
  if (soft.length > 0) {
    const byCategory = new Map<MemoryCategory, DealershipMemory[]>();
    for (const m of soft) {
      const list = byCategory.get(m.category) ?? [];
      list.push(m);
      byCategory.set(m.category, list);
    }

    const softSections: string[] = [];
    for (const [cat, items] of byCategory) {
      const label = CATEGORY_LABELS[cat] ?? cat.toUpperCase();
      const lines = items.map((m) => `  • ${m.title}: ${m.content}`).join("\n");
      softSections.push(`${label}:\n${lines}`);
    }

    sections.push(
      `DEALER GUIDANCE — soft suggestions from your team.\n` +
      `Consider these carefully; you may deviate when customer data strongly supports a different approach:\n` +
      softSections.join("\n\n")
    );
  }

  return `\n${sections.join("\n\n")}\n`;
}
