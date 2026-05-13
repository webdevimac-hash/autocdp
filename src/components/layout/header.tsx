"use client";

import { Bell, Search, Menu, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  userEmail?: string;
  actions?: ReactNode;
}

export function Header({ title, subtitle, userEmail, actions }: HeaderProps) {
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "—";
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K shortcut opens the search (cosmetic for now — wires to the
  // global command palette when that ships).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openMobileNav() {
    window.dispatchEvent(new Event("open-mobile-nav"));
  }

  return (
    <header
      className="h-[58px] flex items-center justify-between px-4 md:px-6 sticky top-0 z-30"
      style={{
        background: "rgba(247, 249, 252, 0.95)",
        backdropFilter: "blur(14px) saturate(200%)",
        WebkitBackdropFilter: "blur(14px) saturate(200%)",
        borderBottom: "1px solid rgba(15, 23, 42, 0.07)",
        boxShadow: "0 1px 3px 0 rgba(15, 23, 42, 0.05)",
      }}
    >
      {/* Left: menu + title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={openMobileNav}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
          aria-label="Open navigation"
        >
          <Menu className="w-4.5 h-4.5" />
        </button>

        <div className="min-w-0">
          <h1
            className="text-[15px] font-bold leading-tight tracking-tight truncate"
            style={{ color: "#0B1526" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-[11px] mt-0.5 truncate hidden sm:block"
              style={{ color: "#94A3B8" }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: actions + search + notifications + avatar */}
      <div className="flex items-center gap-1.5 shrink-0">
        {actions}

        {/* Search — desktop */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 h-9 pl-3 pr-2 rounded-xl text-xs font-medium transition-all"
          style={{
            background: "#F8FAFC",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            color: "#94A3B8",
            minWidth: "260px",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9";
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "rgba(15,23,42,0.14)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "rgba(15,23,42,0.08)";
          }}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Search customers, VINs, campaigns…</span>
          <kbd
            className="ml-1.5 font-mono text-[10px] rounded px-1.5 py-0.5 leading-none"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(15,23,42,0.10)",
              color: "#64748B",
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* AI Agents quick-pulse — premium emerald hint */}
        <button
          className="hidden lg:flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.12em] transition-all"
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.25)",
            color: "#059669",
          }}
          onClick={() => (window.location.href = "/dashboard/agents")}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <Sparkles className="h-3 w-3" />
          Swarm live
        </button>

        {/* Lightweight search "modal" — cosmetic for now; opens on ⌘K */}
        {searchOpen && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-start justify-center pt-[15vh]"
            onClick={() => setSearchOpen(false)}
          >
            <div
              className="w-full max-w-xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  placeholder="Search customers, VINs, campaigns…"
                  className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                <kbd
                  className="font-mono text-[10px] rounded px-1.5 py-0.5 leading-none bg-slate-100 text-slate-500"
                >
                  ESC
                </kbd>
              </div>
              <div className="px-5 py-4 text-xs text-slate-500">
                Type to search across customers, inventory VINs, and campaigns.
                <br />
                <span className="text-slate-400">
                  Global command palette is coming soon — wire it to /api/search.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        <button
          className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ color: "#64748B" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <Bell className="w-4 h-4" />
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ring-[1.5px] ring-white"
            style={{ background: "#6366F1" }}
          />
        </button>

        {/* Avatar — plain div, no radix-ui dependency */}
        <div
          className="h-8 w-8 ml-0.5 cursor-pointer rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all select-none"
          style={{
            background: "linear-gradient(135deg, #ECFDF5 0%, #A7F3D0 100%)",
            color: "#065F46",
            boxShadow: "0 0 0 2px transparent",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px #E0E7FF"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px transparent"; }}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
