import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, Download, Search } from "lucide-react";
import { formatRelativeDate, getInitials } from "@/lib/utils";
import type { LifecycleStage } from "@/types";

export const metadata = { title: "Customers" };

const STAGE_STYLES: Record<LifecycleStage, string> = {
  vip: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  at_risk: "bg-orange-100 text-orange-800",
  lapsed: "bg-red-100 text-red-800",
  prospect: "bg-gray-100 text-gray-700",
};

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

      <main className="flex-1 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(["all", "vip", "active", "at_risk", "lapsed"] as const).map((f) => (
              <Button key={f} variant="outline" size="sm" className="capitalize text-xs h-8">
                {f === "all" ? "All" : f.replace("_", " ")}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export
            </Button>
            <Button size="sm" className="h-8 text-xs">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Customer
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Customer List</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                className="pl-8 pr-3 py-1.5 text-xs border rounded-md bg-background w-48 focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search customers..."
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/50">
                    {["Customer", "Stage", "Visits", "Total Spend", "Last Visit", "Tags", ""].map((h) => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(customers ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground text-sm">
                        No customers yet. Import your DMS data or add customers manually.
                      </td>
                    </tr>
                  ) : (
                    (customers ?? []).map((customer) => (
                      <tr key={customer.id} className="hover:bg-slate-50/60 transition-colors cursor-pointer">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-brand-100 text-brand-700">
                                {getInitials(customer.first_name, customer.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">{customer.first_name} {customer.last_name}</p>
                              <p className="text-xs text-muted-foreground">{customer.email ?? customer.phone ?? "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STAGE_STYLES[customer.lifecycle_stage as LifecycleStage] ?? "bg-gray-100"}`}>
                            {customer.lifecycle_stage?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">{customer.total_visits}</td>
                        <td className="px-6 py-3 font-medium">${(customer.total_spend ?? 0).toFixed(0)}</td>
                        <td className="px-6 py-3 text-muted-foreground text-xs">{formatRelativeDate(customer.last_visit_date)}</td>
                        <td className="px-6 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {(customer.tags ?? []).slice(0, 2).map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5">{tag}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <Button variant="ghost" size="sm" className="h-7 text-xs">View</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
