import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-[0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-brand-600 text-white",
        secondary:   "border-transparent bg-slate-100 text-slate-600",
        destructive: "border-transparent bg-red-100 text-red-700",
        outline:     "border-slate-200 text-slate-600 bg-white",
        success:     "border-transparent bg-emerald-100 text-emerald-700",
        warning:     "border-transparent bg-amber-100 text-amber-700",
        info:        "border-transparent bg-sky-100 text-sky-700",
        violet:      "border-transparent bg-violet-100 text-violet-700",
        // Status variants
        active:      "border-transparent bg-emerald-100 text-emerald-700",
        draft:       "border-transparent bg-slate-100 text-slate-600",
        scheduled:   "border-transparent bg-sky-100 text-sky-700",
        paused:      "border-transparent bg-amber-100 text-amber-700",
        completed:   "border-slate-200 bg-white text-slate-500",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
