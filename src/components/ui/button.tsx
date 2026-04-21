import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius)] text-sm font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-[0_1px_2px_0_rgb(79_70_229/0.25),inset_0_1px_0_rgb(255_255_255/0.10)]",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 shadow-[0_1px_2px_0_rgb(220_38_38/0.25)]",
        outline:
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] active:bg-slate-100",
        secondary:
          "bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 border border-slate-200/60",
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
        link:
          "text-indigo-600 underline-offset-4 hover:underline p-0 h-auto shadow-none",
        emerald:
          "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-[0_1px_2px_0_rgb(5_150_105/0.25),inset_0_1px_0_rgb(255_255_255/0.08)]",
        navy:
          "bg-[#0B1526] text-white hover:bg-[#0F1E35] active:bg-[#060D18] shadow-[0_1px_2px_0_rgb(11_21_38/0.30),inset_0_1px_0_rgb(255_255_255/0.06)]",
        gradient:
          "text-white shadow-[0_1px_2px_0_rgb(79_70_229/0.28),inset_0_1px_0_rgb(255_255_255/0.10)] hover:opacity-90 active:opacity-100",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 rounded-md px-3 text-xs",
        lg:      "h-11 rounded-lg px-6 text-[15px]",
        xl:      "h-12 rounded-lg px-8 text-base",
        icon:    "h-9 w-9",
        "icon-sm": "h-7 w-7 rounded-md",
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
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const gradientStyle =
      variant === "gradient"
        ? { background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)", ...style }
        : style;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={gradientStyle}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
