"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Megaphone, Bot, BarChart3,
  CreditCard, Settings, Car, LogOut, Mail,
  Upload, Package, Phone, Target, Plug,
  Activity, Building2, X, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { Dealership } from "@/types";
import type { DealershipMembership } from "@/lib/dealership";

// ── Navigation groups ──────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: "Core",
    items: [
      { label: "Dashboard",  href: "/dashboard",           icon: LayoutDashboard, exact: true },
      { label: "Customers",  href: "/dashboard/customers",  icon: Users },
      { label: "Campaigns",  href: "/dashboard/campaigns",  icon: Megaphone },
    ],
  },
  {
    label: "Channels",
    items: [
      { label: "Direct Mail", href: "/dashboard/direct-mail", icon: Mail },
      { label: "Analytics",   href: "/dashboard/analytics",   icon: BarChart3 },
      { label: "Conquest",    href: "/dashboard/conquest",     icon: Target },
      { label: "Voice",       href: "/dashboard/voice",        icon: Phone },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "AI Agents",    href: "/dashboard/agents",       icon: Bot },
      { label: "Inventory",    href: "/dashboard/inventory",    icon: Package },
      { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
      { label: "Import",       href: "/dashboard/onboard",      icon: Upload },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Billing",   href: "/dashboard/billing",  icon: CreditCard },
      { label: "Settings",  href: "/dashboard/settings", icon: Settings },
      { label: "Health",    href: "/dashboard/health",   icon: Activity },
    ],
  },
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

  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener("open-mobile-nav", handler);
    return () => window.removeEventListener("open-mobile-nav", handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.classList.add("scroll-locked");
    } else {
      document.body.classList.remove("scroll-locked");
    }
    return () => document.body.classList.remove("scroll-locked");
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    let startX = 0;
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches[0].clientX - startX < -60) setMobileOpen(false);
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [mobileOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleSwitch(dealershipId: string) {
    if (dealershipId === activeDealershipId) { setSwitcherOpen(false); return; }
    window.location.href = `/api/switch-dealership?id=${dealershipId}`;
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <aside className="sidebar-gradient flex h-full w-full flex-col" style={{ background: "#0B1526" }}>

      {/* Mobile close button */}
      <div className="md:hidden absolute top-3 right-3 z-10">
        <button
          onClick={() => setMobileOpen(false)}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-white/8 text-white/50 hover:bg-white/14 hover:text-white/80 active:bg-white/20 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Logo + dealership */}
      <div className="shrink-0 border-b border-white/8">
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-4",
            hasMultiple && "cursor-pointer hover:bg-white/5 transition-colors"
          )}
          onClick={() => hasMultiple && setSwitcherOpen((o) => !o)}
        >
          <div className="flex items-center justify-center w-8 h-8 bg-white/10 rounded-lg ring-1 ring-white/12 shrink-0">
            <Car className="w-4 h-4 text-white/80" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold text-sm leading-tight tracking-tight">AutoCDP</p>
            <p className="text-white/38 text-[11px] truncate mt-0.5">{dealership?.name ?? "Loading…"}</p>
          </div>
          {hasMultiple && (
            <ChevronDown className={cn("w-3.5 h-3.5 text-white/30 shrink-0 transition-transform", switcherOpen && "rotate-180")} />
          )}
        </div>

        {hasMultiple && switcherOpen && (
          <div className="mx-3 mb-3 rounded-lg overflow-hidden border border-white/10">
            {allDealerships.map((d) => (
              <button
                key={d.dealership_id}
                onClick={() => handleSwitch(d.dealership_id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors",
                  d.dealership_id === activeDealershipId
                    ? "bg-white/14 text-white font-semibold"
                    : "text-white/50 hover:bg-white/8 hover:text-white/80"
                )}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0 text-white/30" />
                <span className="truncate flex-1">{d.dealership_name}</span>
                {d.dealership_id === activeDealershipId && (
                  <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2.5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label}>
            <span className="nav-group-label" style={{ marginTop: gi === 0 ? 10 : undefined }}>
              {group.label}
            </span>
            {group.items.map((item) => {
              const active = isActive(item.href, (item as { exact?: boolean }).exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("nav-link", active && "active")}
                >
                  <item.icon className="nav-icon w-[15px] h-[15px]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/8 p-2.5 pb-safe-sm">
        <button
          onClick={handleSignOut}
          className="nav-link w-full"
        >
          <LogOut className="nav-icon w-[15px] h-[15px]" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-screen w-64 z-40">
        {sidebarContent}
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="mobile-nav-overlay fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-[2px]"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full z-50 md:hidden transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          width: "min(18rem, 85vw)",
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        aria-modal="true"
        role="dialog"
      >
        <div className="relative h-full">{sidebarContent}</div>
      </div>
    </>
  );
}
