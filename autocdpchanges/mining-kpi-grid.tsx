"use client";

import { Car, Users, Zap, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

// ----- Types ----------------------------------------------------------------

export interface MiningKPI {
  id: string;
  label: string;
  count: number;
  /** "Shared" pill above the count for cross-tenant / global mines. */
  shared?: boolean;
  /** Whether the underlying entity is vehicles or customers. */
  entity: "vehicle" | "customer";
}

interface MiningKPIGridProps {
  storeName: string;
  /** Pre-formatted timestamp like "05/11/26 at 12:26 AM". */
  lastUpdated: string;
  kpis: MiningKPI[];
  onMineDeals?: () => void;
  onMineCustomers?: () => void;
}

// ----- Component ------------------------------------------------------------

export function MiningKPIGrid({
  storeName,
  lastUpdated,
  kpis,
  onMineDeals,
  onMineCustomers,
}: MiningKPIGridProps) {
  return (
    <div className="flex h-full flex-col bg-slate-50">
      <PageHeader
        icon={<Zap className="h-5 w-5" />}
        iconBg="bg-amber-500"
        title="Mining"
        subtitle={storeName}
        actions={
          <>
            <div className="hidden text-xs text-slate-500 sm:block">
              Updated {lastUpdated}
            </div>
            <button
              onClick={onMineDeals}
              className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Mine Deals
            </button>
            <button
              onClick={onMineCustomers}
              className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Mine Customers
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
          {kpis.map((k) => (
            <KPICard key={k.id} kpi={k} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- KPI Card -------------------------------------------------------------

function KPICard({ kpi }: { kpi: MiningKPI }) {
  const Icon = kpi.entity === "vehicle" ? Car : Users;
  return (
    <button
      className={cn(
        "group flex flex-col items-start gap-1 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <Icon className="h-4 w-4 text-slate-400" />
        {kpi.shared && (
          <Badge
            variant="outline"
            className="rounded-full border-slate-200 px-2 py-0 text-[9px] font-medium text-slate-500"
          >
            Shared
          </Badge>
        )}
      </div>
      <div className="text-3xl font-bold tabular-nums text-emerald-600 group-hover:text-emerald-700">
        {kpi.count.toLocaleString()}
      </div>
      <div className="text-xs font-medium leading-tight text-slate-600">
        {kpi.label}
      </div>
    </button>
  );
}
