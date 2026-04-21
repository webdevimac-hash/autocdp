"use client";

import { Bell, Search, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  subtitle?: string;
  userEmail?: string;
}

export function Header({ title, subtitle, userEmail }: HeaderProps) {
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "?";

  function openMobileNav() {
    window.dispatchEvent(new Event("open-mobile-nav"));
  }

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={openMobileNav}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900 leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 hidden sm:flex">
          <Search className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-brand-600 rounded-full" />
        </Button>
        <Avatar className="h-8 w-8 ml-1 cursor-pointer">
          <AvatarFallback className="bg-brand-50 text-brand-700 text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
