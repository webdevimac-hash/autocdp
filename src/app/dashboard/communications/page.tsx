import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { CommunicationsClient } from "@/components/communications/communications-client";

export const metadata = { title: "Communications" };

const LIMIT = 50;

export default async function CommunicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) redirect("/onboarding");

  const svc   = createServiceClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Initial load: last 30 days, no filters, first 50 rows
  const { data: commsRaw, count } = await (svc
    .from("communications")
    .select(
      "id, channel, status, subject, content, ai_generated, provider_id, " +
      "sent_at, delivered_at, opened_at, clicked_at, created_at, " +
      "customer_id, campaign_id, customers(first_name, last_name)",
      { count: "exact" }
    )
    .eq("dealership_id", dealershipId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .range(0, LIMIT - 1)) as unknown as {
      data: Record<string, unknown>[] | null;
      count: number | null;
    };

  // Stats for last 30 days
  const { data: statsRaw } = await (svc
    .from("communications")
    .select("channel, status, opened_at, clicked_at")
    .eq("dealership_id", dealershipId)
    .gte("created_at", since)) as unknown as {
      data: { channel: string; status: string; opened_at: string | null; clicked_at: string | null }[] | null;
    };

  const all      = statsRaw ?? [];
  const SENT_SET = new Set(["sent", "delivered", "opened", "clicked", "converted"]);
  const emailAll    = all.filter((c) => c.channel === "email");
  const smsAll      = all.filter((c) => c.channel === "sms");
  const mailAll     = all.filter((c) => c.channel === "direct_mail");
  const emailSent   = emailAll.filter((c) => SENT_SET.has(c.status));
  const emailOpened = emailAll.filter((c) => c.opened_at);
  const smsClicked  = smsAll.filter((c) => c.clicked_at);
  const failed      = all.filter((c) => c.status === "bounced" || c.status === "failed");

  const initialStats = {
    total:         all.length,
    emailSent:     emailSent.length,
    emailOpened:   emailOpened.length,
    emailOpenRate: emailSent.length > 0 ? Math.round((emailOpened.length / emailSent.length) * 100) : 0,
    smsSent:       smsAll.length,
    smsClicked:    smsClicked.length,
    smsClickRate:  smsAll.length > 0 ? Math.round((smsClicked.length / smsAll.length) * 100) : 0,
    mailSent:      mailAll.length,
    failed:        failed.length,
    bounceRate:    all.length > 0 ? Math.round((failed.length / all.length) * 100) : 0,
  };

  const total     = count ?? 0;
  const hasMore   = total > LIMIT;

  return (
    <>
      <Header
        title="Communications"
        subtitle={`Full history across mail, SMS, and email · ${total.toLocaleString()} total`}
        userEmail={user.email}
      />
      <main className="flex-1 p-4 sm:p-6 max-w-[1400px]">
        <CommunicationsClient
          initialComms={(commsRaw ?? []) as Parameters<typeof CommunicationsClient>[0]["initialComms"]}
          initialStats={initialStats}
          initialTotal={total}
          initialHasMore={hasMore}
        />
      </main>
    </>
  );
}
