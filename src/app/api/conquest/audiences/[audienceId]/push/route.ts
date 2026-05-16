/**
 * POST /api/conquest/audiences/[audienceId]/push
 *
 * Pushes a built conquest audience to Google Customer Match and/or Meta Custom Audiences.
 * Fetches leads for the audience from DB, then calls pushAudienceToAllPlatforms().
 *
 * Body: { platforms?: ["google","meta"] }  — defaults to both
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { pushAudienceToAllPlatforms } from "@/lib/conquest/audience-push";

export const dynamic    = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ audienceId: string }> }
) {
  const { audienceId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as unknown as { data: { dealership_id: string } | null };
  const dealershipId = ud?.dealership_id;
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 403 });

  let body: { platforms?: Array<"google" | "meta"> } = {};
  try { body = await req.json(); } catch { /* no body — use defaults */ }
  const platforms = body.platforms ?? ["google", "meta"];

  const svc = createServiceClient();

  // Verify audience belongs to this dealership
  const { data: audience } = await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_audiences" as never)
    .select("id,name,status" as never)
    .eq("id" as never, audienceId as never)
    .eq("dealership_id" as never, dealershipId as never)
    .single() as unknown as { data: { id: string; name: string; status: string } | null };

  if (!audience) return NextResponse.json({ error: "Audience not found" }, { status: 404 });
  if (audience.status === "building") return NextResponse.json({ error: "Audience is still building" }, { status: 409 });

  // Load leads assigned to this audience
  const { data: leads } = await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_leads" as never)
    .select("id,email,phone,first_name,last_name" as never)
    .eq("audience_id" as never, audienceId as never)
    .eq("dealership_id" as never, dealershipId as never)
    .limit(50000) as unknown as {
      data: Array<{
        id: string;
        email: string | null;
        phone: string | null;
        first_name: string | null;
        last_name: string | null;
      }> | null;
    };

  if (!leads?.length) {
    return NextResponse.json({ error: "No leads in audience — build it first" }, { status: 422 });
  }

  // Mark syncing
  await (svc as ReturnType<typeof createServiceClient>)
    .from("conquest_audiences" as never)
    .update({ status: "syncing" } as never)
    .eq("id" as never, audienceId as never);

  const result = await pushAudienceToAllPlatforms(
    dealershipId,
    audienceId,
    audience.name,
    leads,
    platforms
  );

  return NextResponse.json({ audienceId, leads: leads.length, ...result });
}
