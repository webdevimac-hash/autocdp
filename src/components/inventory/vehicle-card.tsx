"use client";

import Image from "next/image";
import {
  Gauge,
  Palette,
  Calendar,
  Hash,
  Heart,
  Eye,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---- Types ---------------------------------------------------------------

export interface VehicleCardData {
  id: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  color?: string | null;
  mileage?: number | null;
  condition?: "new" | "used" | "certified" | null;
  price?: number | null;
  days_on_lot?: number | null;
  status?: "available" | "sold" | "reserved" | "pending" | null;
  vin?: string | null;
  /** Resolved photo URL — see resolveVehiclePhoto(). */
  photo_url: string;
}

// ---- Component -----------------------------------------------------------

const STATUS_STYLE: Record<NonNullable<VehicleCardData["status"]>, string> = {
  available: "bg-emerald-500/95 text-white shadow-emerald-500/40",
  reserved:  "bg-amber-500/95 text-white shadow-amber-500/40",
  pending:   "bg-orange-500/95 text-white shadow-orange-500/40",
  sold:      "bg-slate-600/95 text-white shadow-slate-600/30",
};

const CONDITION_STYLE: Record<NonNullable<VehicleCardData["condition"]>, string> = {
  new:       "bg-indigo-50 text-indigo-700 ring-indigo-200",
  used:      "bg-slate-100 text-slate-700 ring-slate-200",
  certified: "bg-sky-50 text-sky-700 ring-sky-200",
};

interface VehicleCardProps {
  v: VehicleCardData;
  onOpen?: (id: string) => void;
  className?: string;
}

export function VehicleCard({ v, onOpen, className }: VehicleCardProps) {
  const title = [v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle";
  const aged = (v.days_on_lot ?? 0) >= 60;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(v.id)}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-300",
        className,
      )}
    >
      {/* Photo */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        <Image
          src={v.photo_url}
          alt={title}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          unoptimized
        />
        {/* Gradient overlay for badge legibility */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        {/* Top-left: status pill */}
        {v.status && (
          <span
            className={cn(
              "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] shadow-md",
              STATUS_STYLE[v.status],
            )}
          >
            <span className="h-1 w-1 rounded-full bg-white/90" />
            {v.status}
          </span>
        )}

        {/* Top-right: actions */}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <IconBtn label="Favorite">
            <Heart className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Quick view">
            <Eye className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Share">
            <Share2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>

        {/* Bottom-left: aged pill if applicable */}
        {aged && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-rose-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
            {v.days_on_lot}d on lot
          </span>
        )}

        {/* Bottom-right: condition pill */}
        {v.condition && (
          <span
            className={cn(
              "absolute bottom-3 right-3 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
              CONDITION_STYLE[v.condition],
            )}
          >
            {v.condition}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-slate-900">
              {title}
            </h3>
            {v.trim && (
              <p className="mt-0.5 truncate text-[12px] text-slate-500">
                {v.trim}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[18px] font-black tabular-nums tracking-tight text-slate-900 leading-none">
              {v.price ? `$${Number(v.price).toLocaleString()}` : "—"}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Asking price
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-[12px]">
          <Spec icon={Gauge}    label={v.mileage ? `${v.mileage.toLocaleString()} mi` : "—"} />
          <Spec icon={Palette}  label={v.color ?? "—"} />
          <Spec icon={Calendar} label={`${v.days_on_lot ?? 0} days on lot`} aged={aged} />
          <Spec icon={Hash}     label={v.vin ? `${v.vin.slice(0, 8)}…` : "No VIN"} mono />
        </div>
      </div>
    </button>
  );
}

// ---- Helpers --------------------------------------------------------------

function Spec({
  icon: Icon,
  label,
  mono,
  aged,
}: {
  icon: typeof Gauge;
  label: string;
  mono?: boolean;
  aged?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 text-slate-600", aged && "text-rose-600 font-semibold")}>
      <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      <span className={cn("truncate", mono && "font-mono text-[11px]")}>{label}</span>
    </div>
  );
}

function IconBtn({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm ring-1 ring-black/5 transition hover:bg-white hover:scale-110"
    >
      {children}
    </button>
  );
}
