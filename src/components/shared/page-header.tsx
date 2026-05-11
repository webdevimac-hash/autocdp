"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: ReactNode;
  /** Tailwind background classes for the icon tile, e.g. "bg-emerald-500" */
  iconBg?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned action area (buttons, filters, etc.) */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  icon,
  iconBg = "bg-emerald-500",
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm",
            iconBg,
          )}
        >
          {icon}
        </div>
        <div className="leading-tight">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
