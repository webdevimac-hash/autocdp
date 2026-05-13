"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Bot,
  BarChart3,
  CreditCard,
  Settings,
  Car,
  LogOut,
  Mail,
  Upload,
  Package,
  Phone,
  Target,
  Plug,
  Activity,
  Building2,
  X,
  Check,
  ChevronDown,
  Shield,
  Sparkles,
  Newspaper,
  FileText,
  Inbox,
  ChevronsRight,
  ListTodo,
  Send,
  Calendar,
  Zap,
  Star,
  ClipboardList,
  HeartPulse,
  Sparkle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { Dealership } from "@/types";
import type { DealershipMembership } from "@/lib/dealership";

// ── Types ──────────────────────────────────────────────────────

export interface SidebarCounts {
  customers: number;
  campaigns: number;
  inventory: number;
  communications: number;
  agents: number;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  /** Pull this number from SidebarCounts at render time. */
  countKey?: keyof SidebarCounts;
  /** Optional tone for the count chip. Defaults to slate. */
  countTone?: "emerald" | "amber" | "rose" | "slate" | "indigo";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── Navigation groups ──────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Core",
    items: [
      { label: "Dashboard",        href: "/dashboard",                  icon: LayoutDashboard, exact: true },
      { label: "Live Dashboard",   href: "/dashboard/live-dashboard",   icon: Activity },
      { label: "Health Dashboard", href: "/dashboard/health-dashboard", icon: HeartPulse },
      { label: "Desk Log",         href: "/dashboard/desk-log",         icon: ClipboardList },
      { label: "Data Hygiene",     href: "/dashboard/data-hygiene",     icon: Sparkle },
      { label: "Sales Hub",        href: "/dashboard/pipeline",         icon: ChevronsRight },
      { label: "Workplan",         href: "/dashboard/workplan",         icon: ListTodo },
      { label: "Customers",        href: "/dashboard/customers",        icon: Users,    countKey: "customers" },
      { label: "Campaigns",        href: "/dashboard/campaigns",        icon: Megaphone, countKey: "campaigns", countTone: "emerald" },
    ],
  },
  {
    label: "Channels",
    items: [
      { label: "Direct Mail",    href: "/dashboard/direct-mail",    icon: Mail },
      { label: "Email Blast",    href: "/dashboard/email-blast",    icon: Send },
      { label: "Communications", href: "/dashboard/communications", icon: Inbox,   countKey: "communications", countTone: "indigo" },
      { label: "Newsletter",     href: "/dashboard/newsletter",     icon: Newspaper },
      { label: "Templates",      href: "/dashboard/templates",      icon: FileText },
      { label: "Analytics",      href: "/dashboard/analytics",      icon: BarChart3 },
      { label: "Conquest",       href: "/dashboard/conquest",       icon: Target },
      { label: "Voice",          href: "/dashboard/voice",          icon: Phone },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "AI Agents",    href: "/dashboard/agents",       icon: Bot,    countKey: "agents", countTone: "emerald" },
      { label: "Inventory",    href: "/dashboard/inventory",    icon: Package, countKey: "inventory" },
      { label: "Appointments", href: "/dashboard/appointments", icon: Calendar },
      { label: "Mining",       href: "/dashboard/mining",       icon: Zap },
      { label: "Reputation",   href: "/dashboard/reputation",   icon: Star },
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
      { label: "Audit Log", href: "/dashboard/audit",    icon: Shield },
    ],
  },
];

// ── Props ──────────────────────────────────────────────────────

interface SidebarProps {
  dealership: Dealership | null;
  allDealerships?: DealershipMembership[];
  activeDealershipId?: string;
  demoMode?: boolean;
  isSuperAdmin?: boolean;
  counts?: SidebarCounts;
}

// ── Component ──────────────────────────────────────────────────

export function Sidebar({
  dealership,
  allDealerships = [],
  activeDealershipId,
  demoMode = false,
  isSuperAdmin = false,
  counts,
}: SidebarProps) {
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

  useEffect(() => {
    setMobileOpen(false);
    setSwitcherOpen(false);
  }, [pathname]);

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
    document.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend",   onTouchEnd);
    };
  }, [mobileOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleSwitch(dealershipId: string) {
    if (dealershipId === activeDealershipId) {
      setSwitcherOpen(false);
      return;
    }
    window.location.href = `/api/switch-dealership?id=${dealershipId}`;
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  // ─── Sidebar markup ────────────────────────────────────────────

  const sidebarContent = (
    <aside className="flex h-full w-full flex-col" style={{ background: "#0B1526" }}>
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

      {/* Rooftop switcher — premium DriveCentric style */}
      <RooftopSwitcher
        dealership={dealership}
        allDealerships={allDealerships}
        activeDealershipId={activeDealershipId}
        hasMultiple={hasMultiple}
        open={switcherOpen}
        onToggle={() => setSwitcherOpen((o) => !o)}
        onSwitch={handleSwitch}
      />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1 px-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className="mb-1">
            <div className="nav-group-label">
              <span>{group.label}</span>
            </div>
            {group.items.map((item) => {
              const active = isActive(item.href, item.exact);
              const Icon = item.icon;
              const count = item.countKey ? counts?.[item.countKey] : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("nav-link group", active && "active")}
                >
                  <Icon className="nav-icon w-[15px] h-[15px]" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {count !== undefined && count > 0 && (
                    <CountChip n={count} tone={item.countTone ?? "slate"} active={active} />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Super-admin section */}
      {isSuperAdmin && (
        <div
          className="shrink-0 px-2 pt-1.5 pb-1"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="nav-group-label">AutoCDP Team</div>
          <Link
            href="/dashboard/admin"
            className={cn("nav-link", isActive("/dashboard/admin") && "active")}
          >
            <Shield className="nav-icon w-[15px] h-[15px]" />
            <span>Admin Panel</span>
          </Link>
        </div>
      )}

      {/* User footer */}
      <div
        className="shrink-0 p-2 pb-safe-sm space-y-0.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Demo Mode toggle */}
        <form action="/api/demo/toggle" method="POST">
          <button
            type="submit"
            className={cn(
              "nav-link w-full",
              demoMode && "bg-violet-500/20 text-violet-200",
            )}
          >
            <Sparkles className="nav-icon w-[15px] h-[15px]" />
            <span className="flex-1 text-left">Demo Mode</span>
            {demoMode && (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-violet-500/30 text-violet-200 px-1.5 py-0.5 rounded-full">
                On
              </span>
            )}
          </button>
        </form>

        <button onClick={handleSignOut} className="nav-link w-full">
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
          mobileOpen ? "translate-x-0" : "-translate-x-full",
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

// ─── Rooftop switcher ─────────────────────────────────────────────────────

function RooftopSwitcher({
  dealership,
  allDealerships,
  activeDealershipId,
  hasMultiple,
  open,
  onToggle,
  onSwitch,
}: {
  dealership: Dealership | null;
  allDealerships: DealershipMembership[];
  activeDealershipId?: string;
  hasMultiple: boolean;
  open: boolean;
  onToggle: () => void;
  onSwitch: (id: string) => void;
}) {
  return (
    <div
      className="shrink-0 px-3 pt-3 pb-2"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 px-1 mb-1.5">
        Rooftop
      </div>
      <button
        type="button"
        onClick={hasMultiple ? onToggle : undefined}
        disabled={!hasMultiple}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
          hasMultiple
            ? "hover:bg-white/[0.06] cursor-pointer"
            : "cursor-default",
        )}
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            background:
              "linear-gradient(135deg, rgba(16,185,129,0.35) 0%, rgba(8,145,178,0.18) 100%)",
            border: "1px solid rgba(16,185,129,0.45)",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.04) inset, 0 4px 12px -2px rgba(16,185,129,0.35)",
          }}
        >
          <Car className="h-4 w-4 text-white" />
          {/* Permanent emerald active dot */}
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
            style={{
              background: "#10B981",
              boxShadow:
                "0 0 0 2px #0B1526, 0 0 8px rgba(16,185,129,0.7)",
            }}
          />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-bold text-white tracking-tight">
            AutoCDP
          </p>
          <p className="truncate text-[11px] text-white/45 mt-0.5">
            {dealership?.name ?? "Loading…"}
          </p>
        </div>
        {hasMultiple && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform text-white/45",
              open && "rotate-180",
            )}
          />
        )}
      </button>

      {hasMultiple && open && (
        <div
          className="mt-2 overflow-hidden rounded-xl"
          style={{
            background: "rgba(0,0,0,0.30)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="max-h-72 overflow-y-auto py-1">
            {allDealerships.map((d) => {
              const isActive = d.dealership_id === activeDealershipId;
              return (
                <button
                  key={d.dealership_id}
                  onClick={() => onSwitch(d.dealership_id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors",
                    isActive
                      ? "bg-emerald-500/12 text-white"
                      : "text-white/55 hover:bg-white/[0.06] hover:text-white/85",
                  )}
                >
                  <Building2
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive ? "text-emerald-300" : "text-white/30",
                    )}
                  />
                  <span className="flex-1 truncate font-medium">
                    {d.dealership_name}
                  </span>
                  {isActive && (
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                      <Check className="h-3 w-3" />
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Count chip ───────────────────────────────────────────────────────────

const TONE_BG: Record<NonNullable<NavItem["countTone"]>, string> = {
  emerald: "bg-emerald-500/20 text-emerald-300",
  amber:   "bg-amber-500/20 text-amber-300",
  rose:    "bg-rose-500/20 text-rose-300",
  slate:   "bg-white/8 text-white/55",
  indigo:  "bg-indigo-500/20 text-indigo-300",
};

function CountChip({
  n,
  tone,
  active,
}: {
  n: number;
  tone: NonNullable<NavItem["countTone"]>;
  active: boolean;
}) {
  const formatted =
    n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : n.toLocaleString();
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center justify-center rounded-md px-1.5 py-px text-[10px] font-bold tabular-nums leading-none min-w-[20px]",
        active ? "bg-white/14 text-white" : TONE_BG[tone],
      )}
    >
      {formatted}
    </span>
  );
}
