/**
 * GET /api/integrations/cdk/callback
 *
 * Handles the OAuth 2.0 authorization code callback from CDK Fortellis.
 * Exchanges the code for tokens, encrypts and stores them, then kicks off
 * the initial full sync in the background.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/dms/cdk-fortellis";
import { encryptTokens } from "@/lib/dms/encrypt";
import { runSync } from "@/lib/dms/sync-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=missing_params`
    );
  }

  const supabase = createServiceClient();

  // Find the pending connection by state.
  // Use ->> (text extraction) not -> (JSON extraction) so the equality
  // comparison works against a plain string, not a JSON-quoted string.
  const { data: conn } = await supabase
    .from("dms_connections")
    .select("id, dealership_id, metadata")
    .eq("provider", "cdk_fortellis")
    .eq("status", "pending")
    .filter("metadata->>oauth_state", "eq", state)
    .maybeSingle();

  if (!conn) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=invalid_state`
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const encrypted = await encryptTokens(tokens as unknown as Record<string, unknown>);

    // Clear the oauth_state nonce now that it has been consumed
    const updatedMeta = { ...(conn.metadata as Record<string, unknown>), oauth_state: null };

    await supabase.from("dms_connections").update({
      status: "active",
      encrypted_tokens: encrypted,
      metadata: updatedMeta,
      updated_at: new Date().toISOString(),
    }).eq("id", conn.id);

    // Kick off initial full sync — fire and forget so redirect is fast
    void runSync({
      dealershipId: conn.dealership_id as string,
      connectionId: conn.id as string,
      provider: "cdk_fortellis",
      jobType: "full",
    }).catch((e) => console.error("[cdk/callback] Initial sync failed:", e));

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?success=cdk_connected`
    );
  } catch (err) {
    console.error("[cdk/callback]", err);
    await supabase.from("dms_connections").update({
      status: "error",
      last_error: err instanceof Error ? err.message : "Token exchange failed",
    }).eq("id", conn.id);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=token_exchange_failed`
    );
  }
}
