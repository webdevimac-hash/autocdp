import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CsvUploader } from "@/components/onboard/csv-uploader";
import { Target, Users, TrendingUp, CheckCircle } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";

export const metadata = { title: "Conquest" };

const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  converted: "bg-green-100 text-green-700",
  disqualified: "bg-gray-100 text-gray-500",
};

export default async function ConquestPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  const dealershipId = ud?.dealership_id ?? "";

  const { data: leads } = await supabase
    .from("conquest_leads")
    .select("*")
    .eq("dealership_id", dealershipId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const allLeads = leads ?? [];
  const totalLeads = allLeads.length;
  const newLeads = allLeads.filter((l) => l.status === "new").length;
  const converted = allLeads.filter((l) => l.status === "converted").length;
  const highScore = allLeads.filter((l) => (l.score ?? 0) >= 70).length;

  const stats = [
    { title: "Total Leads", value: totalLeads, icon: Users, color: "text-blue-600 bg-blue-50" },
    { title: "New (Uncontacted)", value: newLeads, icon: Target, color: "text-purple-600 bg-purple-50" },
    { title: "High Score (70+)", value: highScore, icon: TrendingUp, color: "text-amber-600 bg-amber-50" },
    { title: "Converted", value: converted, icon: CheckCircle, color: "text-green-600 bg-green-50" },
  ];

  return (
    <>
      <Header
        title="Conquest"
        subtitle="Prospect leads from external data feeds"
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
            <CardTitle className="text-base">Import Conquest Leads</CardTitle>
            <p className="text-xs text-muted-foreground">
              Import prospect lists from third-party data providers (LotLogix, Experian, etc.)
            </p>
          </CardHeader>
          <CardContent>
            <CsvUploader
              type="customers"
              uploadUrl="/api/conquest/upload"
              label="Drop conquest CSV here"
              description="One row per prospect"
              requiredColumns={["first_name", "last_name", "email", "phone", "address", "vehicle_interest", "score"]}
            />
          </CardContent>
        </Card>

        {/* Leads table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conquest Leads</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {allLeads.length === 0 ? (
              <div className="py-16 text-center">
                <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No conquest leads yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Import a CSV to start targeting prospects.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50/50">
                      {["Name", "Contact", "Vehicle Interest", "Score", "Status", "Source", "Added"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {lead.email && <p>{lead.email}</p>}
                          {lead.phone && <p>{lead.phone}</p>}
                          {!lead.email && !lead.phone && "—"}
                        </td>
                        <td className="px-5 py-3 text-sm">
                          {lead.vehicle_interest ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-12 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${(lead.score ?? 0) >= 70 ? "bg-green-500" : (lead.score ?? 0) >= 40 ? "bg-amber-400" : "bg-slate-300"}`}
                                style={{ width: `${lead.score ?? 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">{lead.score ?? 0}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[lead.status] ?? ""}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {lead.source ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {formatRelativeDate(lead.created_at)}
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
