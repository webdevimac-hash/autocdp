"use client";

import { useMemo, useState } from "react";
import {
  Search,
  LayoutGrid,
  List,
  ChevronDown,
  ArrowUpDown,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VehicleCard, type VehicleCardData } from "./vehicle-card";

// ─── Types ────────────────────────────────────────────────────────────────

export interface InventoryGridClientProps {
  vehicles: VehicleCardData[];
}

type ViewMode = "grid" | "list";
type SortKey =
  | "recent"
  | "price_asc"
  | "price_desc"
  | "mileage_asc"
  | "days_asc"
  | "days_desc";

const SORT_LABEL: Record<SortKey, string> = {
  recent:       "Recently added",
  price_asc:    "Price: low → high",
  price_desc:   "Price: high → low",
  mileage_asc:  "Mileage: low → high",
  days_asc:     "Days on lot: ascending",
  days_desc:    "Days on lot: descending",
};

// ─── Component ────────────────────────────────────────────────────────────

export function InventoryGridClient({ vehicles }: InventoryGridClientProps) {
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortKey>("recent");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [condition, setCondition] = useState<string>("all");
  const [make, setMake] = useState<string>("all");
  const [year, setYear] = useState<string>("all");
  const [color, setColor] = useState<string>("all");

  // Build dropdown option lists from the data so they're always relevant.
  const options = useMemo(() => {
    const makes = new Set<string>();
    const years = new Set<number>();
    const colors = new Set<string>();
    for (const v of vehicles) {
      if (v.make) makes.add(v.make);
      if (v.year) years.add(v.year);
      if (v.color) colors.add(v.color);
    }
    return {
      makes: Array.from(makes).sort(),
      years: Array.from(years).sort((a, b) => b - a),
      colors: Array.from(colors).sort(),
    };
  }, [vehicles]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = vehicles.filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (condition !== "all" && v.condition !== condition) return false;
      if (make !== "all" && v.make !== make) return false;
      if (year !== "all" && String(v.year) !== year) return false;
      if (color !== "all" && v.color !== color) return false;
      if (!needle) return true;
      const hay = [v.year, v.make, v.model, v.trim, v.color, v.vin]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });

    switch (sort) {
      case "price_asc":
        out = out.slice().sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        break;
      case "price_desc":
        out = out.slice().sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case "mileage_asc":
        out = out
          .slice()
          .sort((a, b) => (a.mileage ?? Infinity) - (b.mileage ?? Infinity));
        break;
      case "days_asc":
        out = out
          .slice()
          .sort((a, b) => (a.days_on_lot ?? 0) - (b.days_on_lot ?? 0));
        break;
      case "days_desc":
        out = out
          .slice()
          .sort((a, b) => (b.days_on_lot ?? 0) - (a.days_on_lot ?? 0));
        break;
      case "recent":
      default:
        // Source order — assumed to be most-recent-first from the server.
        break;
    }
    return out;
  }, [vehicles, q, status, condition, make, year, color, sort]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 p-3.5">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by VIN, make, model, color…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Filter selects */}
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              ["all", "All status"],
              ["available", "Available"],
              ["reserved", "Reserved"],
              ["pending", "Pending"],
              ["sold", "Sold"],
            ]}
          />
          <FilterSelect
            label="Condition"
            value={condition}
            onChange={setCondition}
            options={[
              ["all", "All conditions"],
              ["new", "New"],
              ["used", "Used"],
              ["certified", "Certified"],
            ]}
          />
          <FilterSelect
            label="Make"
            value={make}
            onChange={setMake}
            options={[
              ["all", "All makes"],
              ...options.makes.map<[string, string]>((m) => [m, m]),
            ]}
          />
          <FilterSelect
            label="Year"
            value={year}
            onChange={setYear}
            options={[
              ["all", "All years"],
              ...options.years.map<[string, string]>((y) => [String(y), String(y)]),
            ]}
          />
          <FilterSelect
            label="Color"
            value={color}
            onChange={setColor}
            options={[
              ["all", "All colors"],
              ...options.colors.map<[string, string]>((c) => [c, c]),
            ]}
          />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Sort */}
          <SortMenu sort={sort} onChange={setSort} />

          {/* View toggle */}
          <div
            className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
            role="tablist"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "flex h-9 w-9 items-center justify-center transition-colors",
                view === "grid"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex h-9 w-9 items-center justify-center transition-colors",
                view === "list"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
              aria-label="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Result summary strip */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs">
          <span className="font-semibold tabular-nums text-slate-700">
            {filtered.length.toLocaleString()}{" "}
            <span className="font-normal text-slate-500">
              of {vehicles.length.toLocaleString()} vehicles
            </span>
          </span>
          <span className="text-slate-400">{SORT_LABEL[sort]}</span>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((v) => (
            <VehicleCard key={v.id} v={v} />
          ))}
        </div>
      ) : (
        <ListView vehicles={filtered} />
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-9 rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 cursor-pointer"
      >
        {options.map(([v, lbl]) => (
          <option key={v} value={v}>
            {lbl}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-slate-400" />
    </label>
  );
}

function SortMenu({
  sort,
  onChange,
}: {
  sort: SortKey;
  onChange: (s: SortKey) => void;
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Sort</span>
      <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3 w-3 text-slate-400" />
      <select
        value={sort}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="appearance-none h-9 rounded-lg border border-slate-200 bg-white pl-7 pr-8 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 cursor-pointer"
      >
        {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
          <option key={k} value={k}>
            {SORT_LABEL[k]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-slate-400" />
    </label>
  );
}

function ListView({ vehicles }: { vehicles: VehicleCardData[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Vehicle</th>
              <th className="px-3 py-3 text-left font-medium">VIN</th>
              <th className="px-3 py-3 text-left font-medium">Condition</th>
              <th className="px-3 py-3 text-right font-medium">Mileage</th>
              <th className="px-3 py-3 text-right font-medium">Price</th>
              <th className="px-3 py-3 text-right font-medium">Days</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vehicles.map((v) => {
              const title =
                [v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown";
              const aged = (v.days_on_lot ?? 0) >= 60;
              return (
                <tr
                  key={v.id}
                  className="cursor-pointer transition-colors hover:bg-emerald-50/40"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={v.photo_url}
                          alt={title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {title}
                        </p>
                        {v.trim && (
                          <p className="truncate text-[11px] text-slate-500">
                            {v.trim}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-slate-500">
                    {v.vin ? v.vin.slice(0, 10) + "…" : "—"}
                  </td>
                  <td className="px-3 py-3 capitalize text-slate-600">
                    {v.condition ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                    {v.mileage ? v.mileage.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {v.price ? `$${Number(v.price).toLocaleString()}` : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 text-right tabular-nums",
                      aged ? "font-semibold text-rose-600" : "text-slate-700",
                    )}
                  >
                    {v.days_on_lot ?? 0}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill value={v.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ value }: { value: VehicleCardData["status"] }) {
  const map: Record<string, string> = {
    available: "bg-emerald-100 text-emerald-700",
    reserved: "bg-amber-100 text-amber-700",
    pending: "bg-orange-100 text-orange-700",
    sold: "bg-slate-200 text-slate-600",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        map[value ?? "available"],
      )}
    >
      {value ?? "—"}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        <Plus className="h-5 w-5 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-800">
        No matches for these filters
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Try clearing a filter or searching by VIN.
      </p>
    </div>
  );
}
