import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CsvUploader } from "@/components/onboard/csv-uploader";
import { Car, Package, TrendingDown, DollarSign } from "lucide-react";

export const metadata = { title: "Inventory" };

const CONDITION_COLOR: Record<string, string> = {
  new: "bg-green-100 text-green-700",
  used: "bg-slate-100 text-slate-700",
  certified: "bg-blue-100 text-blue-700",
};

const STATUS_COLOR: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700",
  sold: "bg-gray-100 text-gray-500",
  reserved: "bg-amber-100 text-amber-700",
  pending: "bg-orange-100 text-orange-700",
};

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  const dealershipId = ud?.dealership_id ?? "";

  const { data: inventory } = await supabase
    .from("inventory")
    .select("*")
    .eq("dealership_id", dealershipId)
    .order("days_on_lot", { ascending: false })
    .limit(100);

  const vehicles = inventory ?? [];
  const available = vehicles.filter((v) => v.status === "available");
  const aged = available.filter((v) => (v.days_on_lot ?? 0) >= 60);
  const totalValue = available.reduce((s, v) => s + (v.price ?? 0), 0);
  const avgDays = available.length
    ? Math.round(available.reduce((s, v) => s + (v.days_on_lot ?? 0), 0) / available.length)
    : 0;

  const stats = [
    { title: "Available Units", value: available.length, icon: Car, color: "text-blue-600 bg-blue-50" },
    { title: "Aged 60+ Days", value: aged.length, icon: TrendingDown, color: "text-red-600 bg-red-50" },
    { title: "Avg. Days on Lot", value: avgDays, icon: Package, color: "text-amber-600 bg-amber-50" },
    { title: "Total Value", value: `$${(totalValue / 1000).toFixed(0)}K`, icon: DollarSign, color: "text-green-600 bg-green-50" },
  ];

  return (
    <>
      <Header
        title="Inventory"
        subtitle={`${available.length} vehicles available`}
        userEmail={user.email}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.title} className="border-0 shadow-sm">
              <CardContent className="p-5 flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Import */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Import Inventory</CardTitle>
            <p className="text-xs text-muted-foreground">
              Upload a CSV from your DMS or inventory management system. Existing VINs are updated, new ones are added.
            </p>
          </CardHeader>
          <CardContent>
            <CsvUploader
              type="customers"
              uploadUrl="/api/inventory/upload"
              label="Drop inventory CSV here"
              description="Accepts most DMS export formats"
              requiredColumns={["vin", "year", "make", "model", "trim", "color", "mileage", "price", "condition", "days_on_lot"]}
            />
          </CardContent>
        </Card>

        {/* Inventory list */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current Inventory</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {vehicles.length === 0 ? (
              <div className="py-16 text-center">
                <Car className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No inventory yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Import a CSV to populate your inventory.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50/50">
                      {["Vehicle", "VIN", "Condition", "Mileage", "Price", "Days on Lot", "Status"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vehicles.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">
                            {[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ")}
                          </p>
                          {v.color && <p className="text-xs text-muted-foreground">{v.color}</p>}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                          {v.vin ? v.vin.slice(0, 10) + "…" : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CONDITION_COLOR[v.condition ?? "used"] ?? ""}`}>
                            {v.condition ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm">
                          {v.mileage ? v.mileage.toLocaleString() : "—"}
                        </td>
                        <td className="px-5 py-3 font-medium">
                          {v.price ? `$${Number(v.price).toLocaleString()}` : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-sm font-medium ${(v.days_on_lot ?? 0) >= 60 ? "text-red-600" : "text-gray-700"}`}>
                            {v.days_on_lot ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[v.status] ?? ""}`}>
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
