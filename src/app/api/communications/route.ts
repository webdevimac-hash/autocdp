import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";

const VALID_CHANNELS = ["sms", "email", "direct_mail"] as const;
const VALID_STATUSES = [
  "pending", "queued", "sent", "delivered",
  "opened", "clicked", "converted", "bounced", "failed",
] as const;
type ValidChannel = (typeof VALID_CHANNELS)[number];
type ValidStatus  = (typeof VALID_STATUSES)[number];

function isChannel(v: string): v is ValidChannel { return (VALID_CHANNELS as readonly string[]).includes(v); }
function isStatus(v: string):  v is ValidStatus  { return (VALID_STATUSES  as readonly string[]).includes(v); }

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) return NextResponse.json({ error: "No dealership" }, { status: 400 });

  const sp      = req.nextUrl.searchParams;
  const channel = sp.get("channel") ?? "";
  const status  = sp.get("status")  ?? "";
  const search  = (sp.get("search") ?? "").trim().slice(0, 100);
  const days    = Math.max(0, parseInt(sp.get("days") ?? "30", 10));
  const page    = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const LIMIT   = 50;
  const offset  = (page - 1) * LIMIT;

  const svc   = createServiceClient();
  const since = days > 0
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Resolve customer name search → matching IDs
  let customerIds: string[] = [];
  if (search) {
    const { data: matched } = await svc
      .from("customers")
      .select("id")
      .eq("dealership_id", dealershipId)
      .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
      .limit(200);
    customerIds = (matched ?? []).map((c) => c.id);
  }

  // Main paginated query
  let q = svc
    .from("communications")
    .select(
      "id, channel, status, subject, content, ai_generated, provider_id, " +
      "sent_at, delivered_at, opened_at, clicked_at, created_at, " +
      "customer_id, campaign_id, customers(first_name, last_name)",
      { count: "exact" }
    )
    .eq("dealership_id", dealershipId)
    .order("created_at", { ascending: false })
    .range(offset, offset + LIMIT - 1);

  if (isChannel(channel)) q = q.eq("channel", channel);
  if (isStatus(status))   q = q.eq("status",  status);
  if (since)              q = q.gte("created_at", since);

  if (search) {
    if (customerIds.length > 0) {
      q = q.or(`customer_id.in.(${customerIds.join(",")}),subject.ilike.%${search}%`);
    } else {
      q = q.or(`subject.ilike.%${search}%`);
    }
  }

  const { data, error, count } = await q as unknown as {
    data: Record<string, unknown>[] | null;
    error: unknown;
    count: number | null;
  };

  if (error) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  // Stats (period totals, no channel/status filter — always reflects current date window)
  const statsQ = svc
    .from("communications")
    .select("channel, status, opened_at, clicked_at")
    .eq("dealership_id", dealershipId);

  const { data: statsRaw } = await (since ? statsQ.gte("created_at", since) : statsQ) as unknown as {
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

  const stats = {
    total:          all.length,
    emailSent:      emailSent.length,
    emailOpened:    emailOpened.length,
    emailOpenRate:  emailSent.length > 0 ? Math.round((emailOpened.length / emailSent.length) * 100) : 0,
    smsSent:        smsAll.length,
    smsClicked:     smsClicked.length,
    smsClickRate:   smsAll.length > 0 ? Math.round((smsClicked.length / smsAll.length) * 100) : 0,
    mailSent:       mailAll.length,
    failed:         failed.length,
    bounceRate:     all.length > 0 ? Math.round((failed.length / all.length) * 100) : 0,
  };

  return NextResponse.json({
    communications: data ?? [],
    total: count ?? 0,
    stats,
    page,
    hasMore: (count ?? 0) > offset + LIMIT,
  });
}
