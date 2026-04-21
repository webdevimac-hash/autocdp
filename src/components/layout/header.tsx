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
    <header className="h-14 border-b border-slate-200/80 bg-white/96 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={openMobileNav}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-slate-900 leading-tight tracking-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5 truncate hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {actions}

        {/* Search bar — desktop */}
        <button className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg bg-slate-100 text-slate-400 text-xs hover:bg-slate-200 transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span className="text-slate-400 font-medium">Search…</span>
          <kbd className="ml-2 font-mono text-[10px] bg-white border border-slate-200 rounded px-1 text-slate-500 leading-5">⌘K</kbd>
        </button>

        <button className="relative flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-brand-600 rounded-full ring-[1.5px] ring-white" />
        </button>

        <Avatar className="h-8 w-8 ml-0.5 cursor-pointer ring-2 ring-transparent hover:ring-slate-200 transition-all">
          <AvatarFallback className="bg-indigo-50 text-indigo-700 text-[11px] font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
