/**
 * /dashboard/campaigns/digital — Digital Marketing Command Center
 *
 * Shows the AI-generated Digital Marketing Playbook, campaign performance
 * across Google Ads / Meta Ads / TikTok, pending spend approvals, and
 * the learning pattern library. Allows triggering Agent #6 runs.
 */
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DigitalCommandCenter } from "./digital-command-center";
import { getAdsPerfSummary } from "@/lib/ads/ads-sync";

export const dynamic  = "force-dynamic";
export const metadata = { title: "Digital Marketing · AutoCDP" };

export default async function DigitalMarketingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: ud } = await svc
    .from("user_dealerships")
    .select("dealership_id, dealerships(id,name)")
    .eq("user_id", user.id)
    .maybeSingle() as {
      data: { dealership_id: string; dealerships: { id: string; name: string } | null } | null
    };

  if (!ud?.dealership_id) redirect("/login");
  const dealershipId = ud.dealership_id;

  const [
    playbookRes,
    approvalsRes,
    campaignsRes,
    patternsRes,
    runsRes,
    perfSummary,
    connectionsRes,
  ] = await Promise.all([
    svc
      .from("dm_playbook" as never)
      .select("id,version,content,updated_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("is_current" as never, true as never)
      .maybeSingle() as unknown as Promise<{ data: {
        id: string; version: number;
        content: Record<string, unknown>;
        updated_at: string;
      } | null }>,

    svc
      .from("dm_approvals" as never)
      .select("id,approval_type,title,description,recommended_spend_usd,predicted_roi,status,expires_at,created_at,agent_reasoning" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .in("status" as never, ["pending"] as never)
      .order("created_at" as never, { ascending: false })
      .limit(10) as unknown as Promise<{ data: Array<{
        id: string; approval_type: string; title: string;
        description: string; recommended_spend_usd: number;
        predicted_roi: string | null; status: string;
        expires_at: string; created_at: string;
        agent_reasoning: string | null;
      }> | null }>,

    svc
      .from("dm_campaigns" as never)
      .select("id,platform,name,objective,status,budget_daily_usd,agent_rationale,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("created_at" as never, { ascending: false })
      .limit(20) as unknown as Promise<{ data: Array<{
        id: string; platform: string; name: string;
        objective: string; status: string;
        budget_daily_usd: number | null;
        agent_rationale: string | null;
        created_at: string;
      }> | null }>,

    svc
      .from("dm_learning_patterns" as never)
      .select("id,pattern_type,title,description,confidence,platforms,applied_count,win_rate,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("is_active" as never, true as never)
      .order("confidence" as never, { ascending: false })
      .limit(20) as unknown as Promise<{ data: Array<{
        id: string; pattern_type: string; title: string;
        description: string; confidence: number;
        platforms: string[]; applied_count: number;
        win_rate: number | null; created_at: string;
      }> | null }>,

    svc
      .from("agent_runs" as never)
      .select("id,status,input_summary,output_summary,created_at,duration_ms" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .eq("agent_type" as never, "digital_marketing" as never)
      .order("created_at" as never, { ascending: false })
      .limit(5) as unknown as Promise<{ data: Array<{
        id: string; status: string;
        input_summary: string; output_summary: string | null;
        created_at: string; duration_ms: number | null;
      }> | null }>,

    getAdsPerfSummary(dealershipId).catch(() => []),

    svc
      .from("dms_connections" as never)
      .select("provider,status,last_sync_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .in("provider" as never, ["google_ads", "meta_ads", "tiktok_ads"] as never) as unknown as Promise<{
        data: Array<{ provider: string; status: string; last_sync_at: string | null }> | null
      }>,
  ]);

  return (
    <DigitalCommandCenter
      dealershipId={dealershipId}
      dealershipName={ud.dealerships?.name ?? "Your Dealership"}
      playbook={playbookRes.data}
      pendingApprovals={approvalsRes.data ?? []}
      campaigns={campaignsRes.data ?? []}
      patterns={patternsRes.data ?? []}
      recentRuns={runsRes.data ?? []}
      perfSummary={perfSummary}
      connections={connectionsRes.data ?? []}
    />
  );
}
