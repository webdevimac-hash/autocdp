import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius)] text-sm font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_1px_2px_0_rgb(79_70_229/0.22),inset_0_1px_0_rgb(255_255_255/0.08)]",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 shadow-sm",
        outline:
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]",
        secondary:
          "bg-slate-100 text-slate-700 hover:bg-slate-200",
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        link:
          "text-brand-600 underline-offset-4 hover:underline p-0 h-auto shadow-none",
        emerald:
          "bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_1px_2px_0_rgb(5_150_105/0.22)]",
        navy:
          "bg-navy-900 text-white hover:bg-navy-800 shadow-[0_1px_2px_0_rgb(11_21_38/0.28)]",
      },
      size: {
        default:  "h-9 px-4 py-2",
        sm:       "h-8 rounded-md px-3 text-xs",
        lg:       "h-11 rounded-lg px-6 text-[15px]",
        xl:       "h-12 rounded-lg px-8 text-base",
        icon:     "h-9 w-9",
        "icon-sm":"h-7 w-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
