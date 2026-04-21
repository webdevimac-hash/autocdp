import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { UserPlus, Download, Search, Users, ArrowUpRight } from "lucide-react";
import { formatRelativeDate, getInitials } from "@/lib/utils";
import type { LifecycleStage } from "@/types";

export const metadata = { title: "Customers" };

const STAGE_STYLES: Record<LifecycleStage, { chip: string; dot: string }> = {
  vip:      { chip: "chip chip-amber",   dot: "bg-amber-500" },
  active:   { chip: "chip chip-emerald", dot: "bg-emerald-500" },
  at_risk:  { chip: "chip chip-amber",   dot: "bg-orange-500" },
  lapsed:   { chip: "chip chip-red",     dot: "bg-red-400" },
  prospect: { chip: "chip chip-slate",   dot: "bg-slate-400" },
};

const STAGE_FILTERS = [
  { key: "all",     label: "All" },
  { key: "vip",     label: "VIP" },
  { key: "active",  label: "Active" },
  { key: "at_risk", label: "At Risk" },
  { key: "lapsed",  label: "Lapsed" },
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
      <Header
        title="Customers"
        subtitle={`${count?.toLocaleString() ?? 0} total records`}
        userEmail={user?.email}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-4 max-w-[1400px]">

        {/* ── Toolbar ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {STAGE_FILTERS.map((f, i) => (
              <button
                key={f.key}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
                  i === 0
                    ? "bg-white border border-slate-200 text-slate-900 shadow-card"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white hover:border-slate-200 border border-transparent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-card">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-[0_1px_2px_0_rgb(79_70_229/0.22)] active:scale-[0.98]">
              <UserPlus className="w-3.5 h-3.5" /> Add Customer
            </button>
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────── */}
        <div className="inst-panel">
          {/* Table header row */}
          <div className="inst-panel-header">
            <div className="inst-panel-title">Customer List</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-400"
                placeholder="Search customers…"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="inst-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Segment</th>
                  <th className="text-right">Visits</th>
                  <th className="text-right">Lifetime Value</th>
                  <th>Last Visit</th>
                  <th>Tags</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(customers ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                        <Users className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">No customers yet</p>
                      <p className="text-xs text-slate-400">Import your DMS data or add customers manually.</p>
                    </td>
                  </tr>
                ) : (
                  (customers ?? []).map((customer) => {
                    const stage = customer.lifecycle_stage as LifecycleStage;
                    const style = STAGE_STYLES[stage] ?? STAGE_STYLES.prospect;
                    const initials = getInitials(customer.first_name, customer.last_name);
                    const ltv = customer.total_spend ?? 0;

                    return (
                      <tr key={customer.id} className="cursor-pointer">
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-[11px] font-bold text-indigo-700 shrink-0 ring-1 ring-indigo-100">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 text-[13px] truncate">
                                {customer.first_name} {customer.last_name}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {customer.email ?? customer.phone ?? "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={style.chip}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot} inline-block`} />
                            {customer.lifecycle_stage?.replace("_", " ") ?? "—"}
                          </span>
                        </td>
                        <td className="text-right tabular-nums text-slate-500 font-medium text-[13px]">
                          {customer.total_visits ?? 0}
                        </td>
                        <td className="text-right">
                          <span className={`font-bold text-[13px] tabular-nums ${ltv >= 10000 ? "text-emerald-700" : "text-slate-900"}`}>
                            ${ltv.toLocaleString()}
                          </span>
                        </td>
                        <td className="text-slate-400 text-[12px]">
                          {formatRelativeDate(customer.last_visit_date)}
                        </td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {(customer.tags ?? []).slice(0, 2).map((tag: string) => (
                              <span key={tag} className="chip chip-slate">{tag}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <button className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors opacity-0 group-hover:opacity-100">
                            View <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {(customers ?? []).length === 50 && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <p className="text-xs text-slate-400">Showing 50 of {count?.toLocaleString()} customers</p>
              <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                Load more →
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
