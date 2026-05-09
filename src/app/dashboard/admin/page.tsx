import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { Header } from "@/components/layout/header";
import { Building2, PlusCircle, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Admin Panel" };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isSuperAdmin(user.email)) redirect("/dashboard");

  // Load dealerships created via admin (all of them for now)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allDealerships } = await (supabase
    .from("dealerships")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false })
    .limit(50) as any) as { data: { id: string; name: string; slug: string; created_at: string | null }[] | null };

  return (
    <>
      <Header
        title="Admin Panel"
        subtitle="AutoCDP team tools — internal use only"
        userEmail={user.email}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-[1200px]">

        {/* Banner */}
        <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">AutoCDP Internal Admin</p>
            <p className="text-xs text-amber-700">
              Tools for provisioning dealerships on behalf of clients. Actions here affect live accounts.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/dashboard/admin/provision"
            className="inst-panel p-5 flex items-start gap-4 group hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">Add Dealership for Client</p>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Create the dealership profile, set up their account, and upload their customer data —
                so they log in to a fully working system.
              </p>
            </div>
          </Link>
        </div>

        {/* Dealership list */}
        <div className="inst-panel">
          <div className="inst-panel-header">
            <div>
              <div className="inst-panel-title">All Dealerships</div>
              <div className="inst-panel-subtitle">{allDealerships?.length ?? 0} accounts in system</div>
            </div>
          </div>
          {(!allDealerships || allDealerships.length === 0) ? (
            <div className="p-8 text-center text-slate-400 text-sm">No dealerships yet.</div>
          ) : (
            <table className="inst-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {allDealerships.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium text-slate-900">{d.name}</td>
                    <td className="text-slate-500 text-xs font-mono">{d.slug}</td>
                    <td className="text-slate-400 text-xs">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </>
  );
}
