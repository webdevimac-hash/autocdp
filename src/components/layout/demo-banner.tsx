"use client";

import { Sparkles } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-2 bg-violet-600 text-white text-xs font-semibold">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span>Demo Mode — showing sample data. No real customers or sends.</span>
      </div>
      <form action="/api/demo/toggle" method="POST">
        <button
          type="submit"
          className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors whitespace-nowrap"
        >
          Exit Demo
        </button>
      </form>
    </div>
  );
}
