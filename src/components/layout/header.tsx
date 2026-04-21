"use client";

import { Bell, Search, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ReactNode } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  userEmail?: string;
  actions?: ReactNode;
}

export function Header({ title, subtitle, userEmail, actions }: HeaderProps) {
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "—";

  function openMobileNav() {
    window.dispatchEvent(new Event("open-mobile-nav"));
  }

  return (
    <header
      className="h-14 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30"
      style={{
        background: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(12px) saturate(180%)",
        WebkitBackdropFilter: "blur(12px) saturate(180%)",
        borderBottom: "1px solid rgba(15, 23, 42, 0.07)",
        boxShadow: "0 1px 0 0 rgba(15, 23, 42, 0.04)",
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
            className="text-[15px] font-semibold leading-tight tracking-tight truncate"
            style={{ color: "#0F172A" }}
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
          className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: "#F8FAFC",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            color: "#94A3B8",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(15,23,42,0.12)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(15,23,42,0.08)";
          }}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search…</span>
          <kbd
            className="ml-1.5 font-mono text-[10px] rounded px-1.5 leading-5"
            style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.10)", color: "#64748B" }}
          >
            ⌘K
          </kbd>
        </button>

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

        {/* Avatar */}
        <Avatar
          className="h-8 w-8 ml-0.5 cursor-pointer transition-all"
          style={{ boxShadow: "0 0 0 2px transparent" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px #E0E7FF"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px transparent"; }}
        >
          <AvatarFallback
            className="text-[11px] font-bold"
            style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", color: "#4338CA" }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
