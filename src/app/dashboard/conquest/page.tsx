/**
 * /dashboard/conquest — Full Conquest & Retargeting Engine
 *
 * Server component — loads all data in parallel, passes to ConquestClient.
 * Replaces the basic CSV-uploader placeholder.
 */

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConquestClient } from "./conquest-client";

export const dynamic  = "force-dynamic";
export const metadata = { title: "Conquest · AutoCDP" };

export default async function ConquestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id, dealerships(id,name,address,settings)")
    .eq("user_id", user.id)
    .maybeSingle() as {
      data: {
        dealership_id: string;
        dealerships: {
          id: string;
          name: string;
          address: { city?: string; state?: string } | null;
          settings: Record<string, unknown> | null;
        } | null;
      } | null;
    };

  if (!ud?.dealership_id) redirect("/login");
  const dealershipId   = ud.dealership_id;
  const dealershipName = ud.dealerships?.name ?? "Your Dealership";

  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.autocdp.com";
  const pixelSnippet = `<script src="${appBase}/api/conquest/retargeting/pixel?did=${dealershipId}" async></script>`;

  const svc = createServiceClient();

  // Parallel data load
  const [leadsRes, audiencesRes, retargetingRes, statsRes] = await Promise.all([
    // Top 200 leads ordered by score
    (svc as ReturnType<typeof createServiceClient>)
      .from("conquest_leads" as never)
      .select("id,first_name,last_name,email,phone,score,status,source,credit_tier,in_market_signal,make_interest,model_interest,retargeted_google,retargeted_meta,created_at,audience_id" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("score" as never, { ascending: false })
      .order("created_at" as never, { ascending: false })
      .limit(200) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,

    // All audiences
    (svc as ReturnType<typeof createServiceClient>)
      .from("conquest_audiences" as never)
      .select("id,name,description,criteria,lead_count,enriched_count,in_market_count,google_audience_id,meta_audience_id,google_synced_at,meta_synced_at,status,last_built_at,build_error,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("updated_at" as never, { ascending: false })
      .limit(30) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,

    // Retargeting audiences
    (svc as ReturnType<typeof createServiceClient>)
      .from("retargeting_audiences" as never)
      .select("id,name,rule_type,rule_config,session_count,matched_crm,google_audience_id,meta_audience_id,status,last_built_at,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("created_at" as never, { ascending: false })
      .limit(20) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,

    // Aggregate stats from retargeting_events
    (svc as ReturnType<typeof createServiceClient>)
      .from("retargeting_events" as never)
      .select("event_type,session_id" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .gte("created_at" as never, new Date(Date.now() - 30 * 86400_000).toISOString() as never)
      .limit(10000) as unknown as Promise<{ data: Array<{ event_type: string; session_id: string }> | null }>,
  ]);

  const leads            = leadsRes.data      ?? [];
  const audiences        = audiencesRes.data  ?? [];
  const retargeting      = retargetingRes.data ?? [];
  const recentEvents     = statsRes.data       ?? [];

  // Compute pixel stats
  const uniqueSessions   = new Set(recentEvents.map((e) => e.session_id)).size;
  const vdpViews         = recentEvents.filter((e) => e.event_type === "vdp_view").length;
  const leadForms        = recentEvents.filter((e) =>
    e.event_type === "lead_form_start" || e.event_type === "lead_form_submit"
  ).length;

  // Lead stats
  const totalLeads   = leads.length;
  const highScore    = leads.filter((l) => (l.score as number ?? 0) >= 70).length;
  const inMarket     = leads.filter((l) => l.in_market_signal).length;
  const enriched     = leads.filter((l) => l.credit_tier && l.credit_tier !== "unknown").length;

  return (
    <ConquestClient
      dealershipId={dealershipId}
      dealershipName={dealershipName}
      pixelSnippet={pixelSnippet}
      leads={leads}
      audiences={audiences}
      retargetingAudiences={retargeting}
      stats={{
        totalLeads,
        highScore,
        inMarket,
        enriched,
        uniqueSessions,
        vdpViews,
        leadForms,
        audienceCount: audiences.length,
      }}
      userEmail={user.email ?? ""}
    />
  );
}
