/**
 * GET /api/integrations/cdk/connect
 *
 * Initiates the CDK Fortellis OAuth 2.0 authorization flow.
 * Redirects the dealer's browser to the Fortellis identity server.
 * A `state` param ties the callback back to the authenticated session.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCdkAuthUrl } from "@/lib/dms/cdk-fortellis";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve dealership via user_dealerships (dealerships table has no owner_id column)
  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  if (!ud?.dealership_id) {
    return NextResponse.json({ error: "Dealership not found" }, { status: 404 });
  }

  // Store state → dealership_id mapping so callback can verify it
  const state = crypto.randomUUID();
  await svc.from("dms_connections").upsert(
    {
      dealership_id: ud.dealership_id,
      provider: "cdk_fortellis",
      status: "pending",
      metadata: { oauth_state: state },
    },
    { onConflict: "dealership_id,provider" }
  );

  return NextResponse.redirect(getCdkAuthUrl(state));
}
