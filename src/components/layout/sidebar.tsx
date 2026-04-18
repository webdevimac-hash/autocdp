"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Megaphone, Bot, BarChart3,
  CreditCard, Settings, Car, LogOut, ChevronRight, Mail,
  Upload, Package, Phone, Target, Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Dealership } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home",         href: "/dashboard",               icon: LayoutDashboard },
  { label: "Customers",    href: "/dashboard/customers",     icon: Users },
  { label: "Campaigns",    href: "/dashboard/campaigns",     icon: Megaphone },
  { label: "Direct Mail",  href: "/dashboard/direct-mail",   icon: Mail },
  { label: "Agents",       href: "/dashboard/agents",        icon: Bot },
  { label: "Analytics",    href: "/dashboard/analytics",     icon: BarChart3 },
  { label: "Inventory",    href: "/dashboard/inventory",     icon: Package },
  { label: "Conquest",     href: "/dashboard/conquest",      icon: Target },
  { label: "Voice",        href: "/dashboard/voice",         icon: Phone },
  { label: "Integrations", href: "/dashboard/integrations",  icon: Plug },
  { label: "Import",       href: "/dashboard/onboard",       icon: Upload },
  { label: "Billing",      href: "/dashboard/billing",       icon: CreditCard },
  { label: "Settings",     href: "/dashboard/settings",      icon: Settings },
];

interface SidebarProps {
  dealership: Dealership | null;
}

export function Sidebar({ dealership }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar-gradient flex h-screen w-60 flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/8">
        <div className="flex items-center justify-center w-9 h-9 bg-white/10 rounded-lg ring-1 ring-white/15">
          <Car className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">AutoCDP</p>
          <p className="text-slate-400 text-xs truncate">{dealership?.name ?? "Loading..."}</p>
        </div>
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
