import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import Link from "next/link";
import { Newspaper, PlusCircle, Send, Clock, ArrowUpRight, Users } from "lucide-react";
import type { Newsletter } from "@/lib/newsletter/types";

export const metadata = { title: "Newsletter" };

export default async function NewsletterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: ud } = await svc.from("user_dealerships").select("dealership_id").eq("user_id", user.id).single();
  if (!ud?.dealership_id) redirect("/onboarding");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newsletters } = await (svc as any)
    .from("newsletters")
    .select("id, subject, preview_text, status, sent_at, recipient_count, created_at")
    .eq("dealership_id", ud.dealership_id)
    .order("created_at", { ascending: false })
    .limit(24) as { data: Newsletter[] | null };

  const nl = newsletters ?? [];
  const sentCount  = nl.filter((n) => n.status === "sent").length;
  const draftCount = nl.filter((n) => n.status === "draft").length;

  return (
    <>
      <Header
        title="Newsletter"
        subtitle="Monthly updates to keep customers in the loop"
        userEmail={user.email}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-[1200px]">

        {/* Stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="stat-card stat-card-indigo">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
              <Send className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="metric-value">{sentCount}</div>
            <div className="metric-label">Newsletters Sent</div>
          </div>
          <div className="stat-card stat-card-amber">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="metric-value">{draftCount}</div>
            <div className="metric-label">Drafts</div>
          </div>
          <div className="stat-card stat-card-emerald sm:col-span-1 col-span-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-3">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="metric-value">
              {nl.filter((n) => n.status === "sent").reduce((s, n) => s + (n.recipient_count ?? 0), 0).toLocaleString()}
            </div>
            <div className="metric-label">Total Delivered</div>
          </div>
        </div>

        {/* Action + list panel */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div>
              <div className="inst-panel-title">All Newsletters</div>
              <div className="inst-panel-subtitle">One per month, sent to all customers with email addresses</div>
            </div>
            <Link
              href="/dashboard/newsletter/compose"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Write Newsletter
            </Link>
          </div>

          {nl.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                <Newspaper className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">No newsletters yet</p>
              <p className="text-xs text-slate-400 mb-6 max-w-xs leading-relaxed">
                Write your first monthly newsletter — new arrivals, service tips, events, and special offers in one friendly email.
              </p>
              <Link
                href="/dashboard/newsletter/compose"
                className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Write First Newsletter
              </Link>
            </div>
          ) : (
            <table className="inst-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Recipients</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {nl.map((n) => (
                  <tr key={n.id}>
                    <td className="font-medium text-slate-900 max-w-[280px] truncate">{n.subject}</td>
                    <td>
                      <span className={
                        n.status === "sent" ? "chip chip-emerald" :
                        n.status === "sending" ? "chip chip-amber" :
                        "chip chip-slate"
                      }>
                        {n.status}
                      </span>
                    </td>
                    <td className="text-slate-400 text-xs">
                      {n.sent_at ? new Date(n.sent_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="text-slate-600 text-sm tabular-nums">
                      {n.status === "sent" ? (n.recipient_count ?? 0).toLocaleString() : "—"}
                    </td>
                    <td>
                      {n.status === "draft" && (
                        <Link
                          href={`/dashboard/newsletter/compose?id=${n.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          Edit <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* How it works callout */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-5 py-4 flex items-start gap-3">
          <Newspaper className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
          <div className="text-[13px] text-sky-800 leading-relaxed">
            <strong>How newsletters work:</strong> each issue is sent once to every customer who has an email address. Customers can RSVP to events directly from the email. Open rates and clicks are tracked on the Analytics page.
          </div>
        </div>

      </main>
    </>
  );
}
