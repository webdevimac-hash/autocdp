/**
 * POST /api/integrations/meta-ads/connect
 *
 * Accepts either:
 *   A) After OAuth callback — dealer supplies their adAccountId:
 *      Body: { adAccountId: string; businessId?: string }
 *
 *   B) Full manual entry (System User token):
 *      Body: { accessToken: string; adAccountId: string; businessId?: string }
 *
 * Validates credentials, updates/creates the connection.
 *
 * DELETE — Disconnect Meta Ads.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptTokens, encryptTokens } from "@/lib/dms/encrypt";
import {
  MetaAdsTokens,
  validateMetaToken,
  fetchMetaAdAccountInfo,
} from "@/lib/ads/meta-ads";
import { syncMetaAds } from "@/lib/ads/ads-sync";

export const dynamic = "force-dynamic";

async function resolveUser(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single() as { data: { dealership_id: string } | null };

  return ud?.dealership_id ? { user, dealershipId: ud.dealership_id, svc } : null;
}

export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    accessToken?: string;
    adAccountId?: string;
    businessId?:  string;
  };

  const adAccountId = body.adAccountId?.trim().replace(/^(?!act_)/, "act_") ?? "";
  if (!adAccountId || adAccountId === "act_") {
    return NextResponse.json({ error: "adAccountId is required (e.g. act_123456)" }, { status: 400 });
  }

  const { dealershipId, svc } = auth;

  // Check for existing pending OAuth token in DB
  const { data: existing } = await svc
    .from("dms_connections" as never)
    .select("encrypted_tokens, metadata" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "meta_ads" as never)
    .maybeSingle() as unknown as {
      data: { encrypted_tokens: string; metadata: Record<string, unknown> } | null;
    };

  let accessToken: string;
  if (body.accessToken) {
    accessToken = body.accessToken.trim();
  } else if (existing?.encrypted_tokens) {
    const prev = await decryptTokens<MetaAdsTokens>(existing.encrypted_tokens);
    accessToken = prev.accessToken;
  } else {
    return NextResponse.json(
      { error: "accessToken is required (no pending OAuth session found)" },
      { status: 400 }
    );
  }

  const tokens: MetaAdsTokens = {
    accessToken,
    adAccountId,
    businessId: body.businessId?.trim(),
  };

  // Validate
  const valid = await validateMetaToken(tokens);
  if (!valid) {
    return NextResponse.json(
      { error: "Meta Ads credentials are invalid — check your access token and ad account ID" },
      { status: 400 }
    );
  }

  // Fetch account metadata
  const accountInfo = await fetchMetaAdAccountInfo(tokens).catch(() => ({
    name: adAccountId,
    currency: "USD",
  }));

  const encrypted = await encryptTokens(tokens as unknown as Record<string, unknown>);

  const { data: conn, error: upsertErr } = await svc
    .from("dms_connections" as never)
    .upsert(
      {
        dealership_id:    dealershipId,
        provider:         "meta_ads",
        status:           "active",
        encrypted_tokens: encrypted,
        metadata: {
          ...(existing?.metadata ?? {}),
          ad_account_id:   adAccountId,
          account_name:    accountInfo.name,
          currency:        accountInfo.currency,
          business_id:     body.businessId ?? null,
        },
      } as never,
      { onConflict: "dealership_id,provider" }
    )
    .select("id" as never)
    .single() as unknown as { data: { id: string } | null; error: { message: string } | null };

  if (upsertErr || !conn) {
    return NextResponse.json({ error: "Failed to save connection" }, { status: 500 });
  }

  // Kick off initial sync (non-blocking)
  void syncMetaAds(dealershipId, conn.id).catch((e) =>
    console.error("[meta-ads/connect] Initial sync failed:", e)
  );

  return NextResponse.json({
    ok:          true,
    connectionId: conn.id,
    accountName: accountInfo.name,
    currency:    accountInfo.currency,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await auth.svc
    .from("dms_connections" as never)
    .delete()
    .eq("dealership_id" as never, auth.dealershipId as never)
    .eq("provider" as never, "meta_ads" as never);

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
