import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/onboarding/provision
// Creates the dealership record and user_dealerships membership.
// Called immediately after successful Supabase Auth signUp.
// Uses service-role client to bypass RLS (user doesn't have a dealership_id yet).
export async function POST(req: NextRequest) {
  const { userId, dealershipName, dealershipSlug } = await req.json();

  if (!userId || !dealershipName || !dealershipSlug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Check if slug is already taken
  const { data: existing } = await supabase
    .from("dealerships")
    .select("id")
    .eq("slug", dealershipSlug)
    .single();

  const slug = existing
    ? `${dealershipSlug}-${Math.random().toString(36).slice(2, 6)}`
    : dealershipSlug;

  // Create dealership
  const { data: dealership, error: dealershipError } = await supabase
    .from("dealerships")
    .insert({ name: dealershipName, slug })
    .select()
    .single();

  if (dealershipError) {
    console.error("[provision] dealership create error:", dealershipError);
    return NextResponse.json({ error: "Failed to create dealership" }, { status: 500 });
  }

  // Link user as owner
  const { error: membershipError } = await supabase.from("user_dealerships").insert({
    user_id: userId,
    dealership_id: dealership.id,
    role: "owner",
  });

  if (membershipError) {
    console.error("[provision] membership create error:", membershipError);
    // Clean up dealership to avoid orphans
    await supabase.from("dealerships").delete().eq("id", dealership.id);
    return NextResponse.json({ error: "Failed to link user to dealership" }, { status: 500 });
  }

  return NextResponse.json({ dealershipId: dealership.id, slug }, { status: 201 });
}
