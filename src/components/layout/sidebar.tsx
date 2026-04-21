"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Megaphone, Bot, BarChart3,
  CreditCard, Settings, Car, LogOut, ChevronRight, Mail,
  Upload, Package, Phone, Target, Plug, ChevronDown,
  Activity, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dealership } from "@/types";
import type { DealershipMembership } from "@/lib/dealership";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home",         href: "/dashboard",              icon: LayoutDashboard },
  { label: "Customers",    href: "/dashboard/customers",    icon: Users },
  { label: "Campaigns",    href: "/dashboard/campaigns",    icon: Megaphone },
  { label: "Direct Mail",  href: "/dashboard/direct-mail",  icon: Mail },
  { label: "Agents",       href: "/dashboard/agents",       icon: Bot },
  { label: "Analytics",    href: "/dashboard/analytics",    icon: BarChart3 },
  { label: "Inventory",    href: "/dashboard/inventory",    icon: Package },
  { label: "Conquest",     href: "/dashboard/conquest",     icon: Target },
  { label: "Voice",        href: "/dashboard/voice",        icon: Phone },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
  { label: "Import",       href: "/dashboard/onboard",      icon: Upload },
  { label: "Health",       href: "/dashboard/health",       icon: Activity },
  { label: "Billing",      href: "/dashboard/billing",      icon: CreditCard },
  { label: "Settings",     href: "/dashboard/settings",     icon: Settings },
];

interface SidebarProps {
  dealership: Dealership | null;
  allDealerships?: DealershipMembership[];
  activeDealershipId?: string;
}

export function Sidebar({ dealership, allDealerships = [], activeDealershipId }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const hasMultiple = allDealerships.length > 1;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleSwitch(dealershipId: string) {
    if (dealershipId === activeDealershipId) { setSwitcherOpen(false); return; }
    // Full navigation so the layout server component re-runs with the new cookie
    window.location.href = `/api/switch-dealership?id=${dealershipId}`;
  }

  return (
    <aside className="sidebar-gradient flex h-screen w-60 flex-col fixed left-0 top-0 z-40">
      {/* Logo + dealership name */}
      <div className="border-b border-white/8">
        <div
          className={cn(
            "flex items-center gap-3 px-5 py-5",
            hasMultiple && "cursor-pointer hover:bg-white/5 transition-colors"
          )}
          onClick={() => hasMultiple && setSwitcherOpen((o) => !o)}
        >
          <div className="flex items-center justify-center w-9 h-9 bg-white/10 rounded-lg ring-1 ring-white/15 shrink-0">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm leading-tight truncate">AutoCDP</p>
            <p className="text-slate-400 text-xs truncate">{dealership?.name ?? "Loading…"}</p>
          </div>
          {hasMultiple && (
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform",
                switcherOpen && "rotate-180"
              )}
            />
          )}
        </div>

        {/* Dealership switcher dropdown */}
        {hasMultiple && switcherOpen && (
          <div className="mx-3 mb-3 rounded-lg overflow-hidden border border-white/10">
            {allDealerships.map((d) => (
              <button
                key={d.dealership_id}
                onClick={() => handleSwitch(d.dealership_id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors",
                  d.dealership_id === activeDealershipId
                    ? "bg-white/15 text-white font-semibold"
                    : "text-slate-300 hover:bg-white/8"
                )}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate flex-1">{d.dealership_name}</span>
                {d.dealership_id === activeDealershipId && (
                  <span className="text-[9px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-white/12 text-white"
                  : "text-slate-400 hover:bg-white/8 hover:text-slate-100"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-brand-500 text-white rounded-full">
                  {item.badge}
                </span>
              )}
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-white/40 ml-auto shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-white/8">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/8 hover:text-slate-100 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
