import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { UserPlus, Download, Search, Users } from "lucide-react";
import { formatRelativeDate, getInitials } from "@/lib/utils";
import type { LifecycleStage } from "@/types";

export const metadata = { title: "Customers" };

const STAGE_STYLES: Record<LifecycleStage, { badge: string; dot: string }> = {
  vip:      { badge: "bg-amber-100 text-amber-800",   dot: "bg-amber-500" },
  active:   { badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  at_risk:  { badge: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  lapsed:   { badge: "bg-red-100 text-red-700",       dot: "bg-red-400" },
  prospect: { badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-400" },
};

const STAGE_FILTERS = [
  { key: "all", label: "All" },
  { key: "vip", label: "VIP" },
  { key: "active", label: "Active" },
  { key: "at_risk", label: "At Risk" },
  { key: "lapsed", label: "Lapsed" },
] as const;

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user!.id)
    .single();

  const { data: customers, count } = await supabase
    .from("customers")
    .select("*", { count: "exact" })
    .eq("dealership_id", ud?.dealership_id ?? "")
    .order("last_visit_date", { ascending: false })
    .limit(50);

  return (
    <>
      <Header title="Customers" subtitle={`${count ?? 0} total records`} userEmail={user?.email} />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {STAGE_FILTERS.map((f, i) => (
              <button
                key={f.key}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  i === 0
                    ? "bg-white border border-slate-200 text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white hover:border-slate-200 border border-transparent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
              <UserPlus className="w-3.5 h-3.5" /> Add Customer
            </button>
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          {/* Card header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Customer List</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors placeholder:text-slate-400"
                placeholder="Search customers…"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {["Customer", "Stage", "Visits", "Total Spend", "Last Visit", "Tags", ""].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(customers ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                        <Users className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">No customers yet</p>
                      <p className="text-xs text-slate-400">Import your DMS data or add customers manually.</p>
                    </td>
                  </tr>
                ) : (
                  (customers ?? []).map((customer) => {
                    const stage = customer.lifecycle_stage as LifecycleStage;
                    const styleConfig = STAGE_STYLES[stage] ?? STAGE_STYLES.prospect;
                    const initials = getInitials(customer.first_name, customer.last_name);

                    return (
                      <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-semibold text-indigo-700 shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{customer.first_name} {customer.last_name}</p>
                              <p className="text-xs text-slate-400 truncate">{customer.email ?? customer.phone ?? "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${styleConfig.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${styleConfig.dot}`} />
                            {customer.lifecycle_stage?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-slate-500 text-xs tabular-nums">{customer.total_visits}</td>
                        <td className="px-6 py-3.5 font-semibold text-slate-900 tabular-nums">${(customer.total_spend ?? 0).toLocaleString()}</td>
                        <td className="px-6 py-3.5 text-slate-400 text-xs">{formatRelativeDate(customer.last_visit_date)}</td>
                        <td className="px-6 py-3.5">
                          <div className="flex gap-1 flex-wrap">
                            {(customer.tags ?? []).slice(0, 2).map((tag: string) => (
                              <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                            View →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
