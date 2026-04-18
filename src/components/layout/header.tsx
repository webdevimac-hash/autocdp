import { Bell, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  subtitle?: string;
  userEmail?: string;
}

export function Header({ title, subtitle, userEmail }: HeaderProps) {
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "?";

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-base font-semibold text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
          <Search className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-brand-600 rounded-full" />
        </Button>
        <Avatar className="h-7 w-7 ml-1 cursor-pointer">
          <AvatarFallback className="bg-brand-50 text-brand-700 text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
