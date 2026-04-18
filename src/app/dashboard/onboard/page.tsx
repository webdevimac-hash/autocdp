import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CsvUploader } from "@/components/onboard/csv-uploader";
import { Users, Clock, ArrowRight, FileSpreadsheet } from "lucide-react";

export const metadata = { title: "Onboard" };

export default async function OnboardPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id")
    .eq("user_id", user.id)
    .single();

  const dealershipId = ud?.dealership_id ?? "";

  const [customersRes, visitsRes] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("dealership_id", dealershipId),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("dealership_id", dealershipId),
  ]);

  const customerCount = customersRes.count ?? 0;
  const visitCount = visitsRes.count ?? 0;

  return (
    <>
      <Header
        title="Import & Onboard"
        subtitle="Import your DMS data to activate the AI agents"
        userEmail={user.email}
      />

      <main className="flex-1 p-6 space-y-6">

        {/* Current counts */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customers</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{customerCount.toLocaleString()}</p>
              </div>
              <div className="p-2.5 rounded-lg text-blue-600 bg-blue-50">
                <Users className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Service Visits</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{visitCount.toLocaleString()}</p>
              </div>
              <div className="p-2.5 rounded-lg text-green-600 bg-green-50">
                <Clock className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How to import your DMS data</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {[
                { step: "1", text: "Export customers from your DMS (CDK, Reynolds, Dealertrack) as a CSV.", icon: FileSpreadsheet },
                { step: "2", text: "Import customers below. Duplicates (matched by email or phone) are skipped automatically.", icon: Users },
                { step: "3", text: "Export repair orders / service history as a second CSV and import visits.", icon: Clock },
                { step: "4", text: "Run the AI agents — the Data Agent segments your customers immediately.", icon: ArrowRight },
              ].map((item) => (
                <li key={item.step} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <p className="text-sm text-gray-700">{item.text}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Customer import */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Import Customers
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                One row per customer. Duplicates matched on email or phone are skipped.
              </p>
            </CardHeader>
            <CardContent>
              <CsvUploader
                type="customers"
                uploadUrl="/api/onboard/upload"
                label="Drop customer CSV here"
                requiredColumns={["first_name", "last_name", "email", "phone", "address", "city", "state", "zip"]}
              />
            </CardContent>
          </Card>

          {/* Visit import */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-500" />
                Import Service Visits
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Repair orders / service history. Customers must be imported first.
              </p>
            </CardHeader>
            <CardContent>
              <CsvUploader
                type="visits"
                uploadUrl="/api/onboard/upload"
                label="Drop service history CSV here"
                requiredColumns={["customer_id or email", "visit_date", "vin", "make", "model", "year", "mileage", "service_type", "total"]}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm bg-blue-50 border-blue-100">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-blue-800 mb-1">DMS integration coming soon</p>
            <p className="text-xs text-blue-700">
              Native connectors for CDK Global, Reynolds &amp; Reynolds, and Dealertrack are on the roadmap.
              For now, export a CSV from your DMS and import it here — the schema is flexible and handles most column names automatically.
            </p>
          </CardContent>
        </Card>

      </main>
    </>
  );
}
