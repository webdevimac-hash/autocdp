import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CsvUploader } from "@/components/onboard/csv-uploader";
import {
  Car,
  Package,
  TrendingDown,
  DollarSign,
  Upload,
} from "lucide-react";
import { InventoryGridClient } from "@/components/inventory/inventory-grid-client";
import type { VehicleCardData } from "@/components/inventory/vehicle-card";
import { resolveVehiclePhoto, placeholderPhotoFor } from "@/lib/inventory-photos";
import { isDemoMode } from "@/lib/demo";

export const metadata = { title: "Inventory" };

// ─── Demo fallback ────────────────────────────────────────────────────────

const DEMO_VEHICLES: VehicleCardData[] = [
  { id: "demo-1",  year: 2024, make: "BMW",      model: "X5",        trim: "xDrive40i",        color: "Alpine White",      mileage: 1240,   condition: "new",       price: 78500, days_on_lot: 12, status: "available", vin: "5UXCR6C0XL0E11111", photo_url: placeholderPhotoFor("demo-1") },
  { id: "demo-2",  year: 2023, make: "Toyota",   model: "Tacoma",    trim: "TRD Off-Road",     color: "Cement Grey",       mileage: 14200,  condition: "used",      price: 38995, days_on_lot: 27, status: "available", vin: "3TMCZ5AN9PM55555", photo_url: placeholderPhotoFor("demo-2") },
  { id: "demo-3",  year: 2025, make: "Tesla",    model: "Model 3",   trim: "Long Range AWD",   color: "Pearl White",       mileage: 8,      condition: "new",       price: 47990, days_on_lot: 5,  status: "reserved",  vin: "5YJ3E1EA0PF99999", photo_url: placeholderPhotoFor("demo-3") },
  { id: "demo-4",  year: 2022, make: "Ford",     model: "F-150",     trim: "Lariat 5.0L",      color: "Antimatter Blue",   mileage: 31450,  condition: "used",      price: 49800, days_on_lot: 64, status: "available", vin: "1FTFW1E5XNFB12345", photo_url: placeholderPhotoFor("demo-4") },
  { id: "demo-5",  year: 2024, make: "Porsche",  model: "Macan",     trim: "S",                 color: "Carmine Red",       mileage: 4120,   condition: "certified", price: 84500, days_on_lot: 19, status: "available", vin: "WP1AB2A56RLB23456", photo_url: placeholderPhotoFor("demo-5") },
  { id: "demo-6",  year: 2021, make: "Jeep",     model: "Wrangler",  trim: "Sahara 4xe",       color: "Hydro Blue",        mileage: 28900,  condition: "used",      price: 41250, days_on_lot: 73, status: "available", vin: "1C4HJXEN5MW87654", photo_url: placeholderPhotoFor("demo-6") },
  { id: "demo-7",  year: 2024, make: "Mercedes-Benz", model: "GLE",  trim: "350 4MATIC",       color: "Obsidian Black",    mileage: 6210,   condition: "certified", price: 71400, days_on_lot: 8,  status: "available", vin: "4JGFB4KB0RB54321", photo_url: placeholderPhotoFor("demo-7") },
  { id: "demo-8",  year: 2023, make: "Honda",    model: "Civic",     trim: "Si Sedan",          color: "Sonic Grey Pearl",  mileage: 11800,  condition: "used",      price: 28490, days_on_lot: 33, status: "pending",   vin: "19XFC2F75PE65432", photo_url: placeholderPhotoFor("demo-8") },
  { id: "demo-9",  year: 2024, make: "Ford",     model: "Mustang",   trim: "GT Premium",        color: "Race Red",          mileage: 220,    condition: "new",       price: 56200, days_on_lot: 3,  status: "available", vin: "1FA6P8CF0RA98765", photo_url: placeholderPhotoFor("demo-9") },
  { id: "demo-10", year: 2020, make: "Audi",     model: "Q5",        trim: "Premium Plus",      color: "Mythos Black",      mileage: 42300,  condition: "used",      price: 32990, days_on_lot: 81, status: "available", vin: "WA1BNAFY1L2076543", photo_url: placeholderPhotoFor("demo-10") },
  { id: "demo-11", year: 2025, make: "Lexus",    model: "RX 350",    trim: "F Sport",           color: "Atomic Silver",     mileage: 0,      condition: "new",       price: 64800, days_on_lot: 1,  status: "available", vin: "2T2BAMCA0RC34567", photo_url: placeholderPhotoFor("demo-11") },
  { id: "demo-12", year: 2022, make: "BMW",      model: "M3",        trim: "Competition",       color: "Isle of Man Green", mileage: 9450,   condition: "certified", price: 79900, days_on_lot: 41, status: "available", vin: "WBS43AY01NCF12399", photo_url: placeholderPhotoFor("demo-12") },
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const demoMode = await isDemoMode();

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
    .order("created_at", { ascending: false })
    .limit(120);

  // Hydrate photo_url for every vehicle — DB metadata.photo_url wins, otherwise
  // fall back to a deterministic Unsplash placeholder keyed off the id.
  const real: VehicleCardData[] = (inventory ?? []).map((v: any) => ({
    id: v.id,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    color: v.color,
    mileage: v.mileage,
    condition: v.condition,
    price: v.price ? Number(v.price) : null,
    days_on_lot: v.days_on_lot,
    status: v.status,
    vin: v.vin,
    photo_url: resolveVehiclePhoto(v.id, v.metadata),
  }));

  // Use demo data when there's nothing in the DB (or when demo mode is on) so
  // the page never looks broken for new tenants.
  const vehicles = real.length > 0 && !demoMode ? real : DEMO_VEHICLES;

  // ─── Aggregated KPIs ──────────────────────────────────────────────────
  const available = vehicles.filter((v) => v.status === "available");
  const aged = available.filter((v) => (v.days_on_lot ?? 0) >= 60);
  const totalValue = available.reduce((s, v) => s + (v.price ?? 0), 0);
  const avgDays = available.length
    ? Math.round(
        available.reduce((s, v) => s + (v.days_on_lot ?? 0), 0) /
          available.length,
      )
    : 0;

  const stats = [
    { title: "Available Units", value: available.length.toLocaleString(), icon: Car,           accent: "stat-card-indigo",  iconBg: "bg-indigo-50",  iconColor: "text-indigo-600" },
    { title: "Aged 60+ Days",   value: aged.length.toLocaleString(),       icon: TrendingDown,  accent: "stat-card-rose",    iconBg: "bg-rose-50",    iconColor: "text-rose-600" },
    { title: "Avg. Days on Lot", value: `${avgDays}`,                       icon: Package,       accent: "stat-card-amber",   iconBg: "bg-amber-50",   iconColor: "text-amber-600" },
    { title: "Available Value",  value: `$${(totalValue / 1000).toFixed(0)}K`, icon: DollarSign,  accent: "stat-card-emerald", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  ];

  return (
    <>
      <Header
        title="Inventory"
        subtitle={`${available.length.toLocaleString()} available · ${vehicles.length.toLocaleString()} total`}
        userEmail={user.email}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-[1500px]">
        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.title} className={`stat-card ${s.accent}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                  <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                </div>
              </div>
              <div className="metric-value">{s.value}</div>
              <div className="metric-label">{s.title}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        <InventoryGridClient vehicles={vehicles} />

        {/* Import — kept at the bottom so existing CSV pipeline keeps working */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-slate-400" />
                Import inventory
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a CSV from your DMS or vAuto / DriveCentric export — existing VINs and stock numbers are updated, new ones are added.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <CsvUploader
              type="customers"
              uploadUrl="/api/inventory/upload"
              label="Drop inventory CSV here"
              description="DriveCentric, vAuto, CDK, or any DMS — drop the raw export"
              requiredColumns={[
                "Vehicle (or year+make+model)",
                "Stock Number (or vin)",
                "Pricing (or price)",
                "Mileage",
                "Trim",
                "Age (or days_on_lot)",
                "Sold",
              ]}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
