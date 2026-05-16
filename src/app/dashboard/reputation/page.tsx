/**
 * /dashboard/reputation — Google Business Profile Reputation Hub
 *
 * Pulls live data from the local DB cache (gbp_reviews, gbp_posts, gbp_qanda).
 * If GBP is not connected, shows a connect prompt.
 * Server component — passes structured props to the client.
 */

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReputationClient } from "./reputation-client";

export const dynamic  = "force-dynamic";
export const metadata = { title: "Reputation · AutoCDP" };

export default async function ReputationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();

  // Resolve dealership
  const { data: ud } = await svc
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

  // Check GBP connection
  const { data: conn } = await (svc as ReturnType<typeof createServiceClient>)
    .from("dms_connections" as never)
    .select("status,metadata" as never)
    .eq("dealership_id" as never, dealershipId as never)
    .eq("provider" as never, "google_business_profile" as never)
    .maybeSingle() as unknown as {
      data: { status: string; metadata: Record<string, unknown> } | null;
    };

  const isConnected = conn?.status === "active";

  if (!isConnected) {
    return (
      <ReputationClient
        dealershipId={dealershipId}
        dealershipName={dealershipName}
        isConnected={false}
        connectionMeta={null}
        reviews={[]}
        posts={[]}
        questions={[]}
        stats={{ total: 0, avgRating: 0, pending: 0, unanswered: 0, postsLive: 0 }}
      />
    );
  }

  // Load data in parallel (all from local cache — fast)
  const [reviewsRes, postsRes, qaRes] = await Promise.all([
    (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_reviews" as never)
      .select("id,gbp_review_id,reviewer_name,rating,rating_int,comment,create_time,update_time,reply_comment,reply_update_time,reply_is_ai,reply_status" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("create_time" as never, { ascending: false })
      .limit(100) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,

    (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_posts" as never)
      .select("id,gbp_post_id,topic_type,summary,call_to_action_type,call_to_action_url,state,is_ai_generated,create_time,created_at" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("created_at" as never, { ascending: false })
      .limit(30) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,

    (svc as ReturnType<typeof createServiceClient>)
      .from("gbp_qanda" as never)
      .select("id,gbp_question_id,question_text,author_name,question_time,upvote_count,answer_text,answer_author,answer_time,answer_is_ai,answer_status" as never)
      .eq("dealership_id" as never, dealershipId as never)
      .order("question_time" as never, { ascending: false })
      .limit(50) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,
  ]);

  const reviews   = reviewsRes.data   ?? [];
  const posts     = postsRes.data     ?? [];
  const questions = qaRes.data        ?? [];

  // Aggregate stats
  const total     = reviews.length;
  const sumRating = reviews.reduce((s, r) => s + (Number((r as { rating_int: number }).rating_int) || 0), 0);
  const avgRating = total > 0 ? +(sumRating / total).toFixed(1) : 0;
  const pending   = reviews.filter((r) => (r as { reply_status: string }).reply_status === "none").length;
  const unanswered = questions.filter((q) => (q as { answer_status: string }).answer_status === "unanswered").length;
  const postsLive  = posts.filter((p) => (p as { state: string }).state === "live").length;

  return (
    <ReputationClient
      dealershipId={dealershipId}
      dealershipName={dealershipName}
      isConnected={true}
      connectionMeta={conn?.metadata ?? null}
      reviews={reviews}
      posts={posts}
      questions={questions}
      stats={{ total, avgRating, pending, unanswered, postsLive }}
    />
  );
}
