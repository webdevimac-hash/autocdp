"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Megaphone, Bot, BarChart3,
  CreditCard, Settings, Car, LogOut, ChevronRight, Mail,
  Upload, Package, Phone, Target, Plug, ChevronDown,
  Activity, Building2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const hasMultiple = allDealerships.length > 1;

  // Listen for the hamburger trigger dispatched by <Header>
  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener("open-mobile-nav", handler);
    return () => window.removeEventListener("open-mobile-nav", handler);
  }, []);

  // Close drawer on route change (navigation completed)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleSwitch(dealershipId: string) {
    if (dealershipId === activeDealershipId) { setSwitcherOpen(false); return; }
    window.location.href = `/api/switch-dealership?id=${dealershipId}`;
  }

  const sidebarContent = (
    <aside
      className={cn(
        "sidebar-gradient flex h-full w-64 flex-col",
      )}
    >
      {/* Mobile close button */}
      <div className="md:hidden absolute top-3 right-3">
        <button
          onClick={() => setMobileOpen(false)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

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
                "flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg text-sm font-medium transition-all group",
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
      <div className="p-3 border-t border-white/8 pb-safe-sm">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg text-sm text-slate-400 hover:bg-white/8 hover:text-slate-100 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:block fixed left-0 top-0 h-screen w-64 z-40">
        {sidebarContent}
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="mobile-nav-overlay fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full w-72 z-50 md:hidden transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-modal="true"
        role="dialog"
      >
        <div className="relative h-full">
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
