import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { toApiError } from "@/lib/errors";
import type { MemoryCategory } from "@/lib/memories";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const svc = createServiceClient();
    const { data, error } = await svc
      .from("dealership_memories")
      .select("id, category, title, content, is_active, created_at, updated_at")
      .eq("dealership_id", dealershipId)
      .order("category")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ memories: data ?? [] });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dealershipId = await getActiveDealershipId(user.id);
    if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

    const body = await req.json();
    const { category, title, content } = body as {
      category?: MemoryCategory;
      title?: string;
      content?: string;
    };

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "title and content are required" }, { status: 400 });
    }

    const validCategories: MemoryCategory[] = ["tone", "offers", "avoid", "style", "general"];
    const cat: MemoryCategory = validCategories.includes(category as MemoryCategory)
      ? (category as MemoryCategory)
      : "general";

    const svc = createServiceClient();
    const { data, error } = await svc
      .from("dealership_memories")
      .insert({
        dealership_id: dealershipId,
        category: cat,
        title: title.trim(),
        content: content.trim(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ memory: data }, { status: 201 });
  } catch (error) {
    const { error: msg, code, statusCode } = toApiError(error);
    return NextResponse.json({ error: msg, code }, { status: statusCode });
  }
}
