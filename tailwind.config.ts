import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // ── shadcn/ui semantic tokens (mapped from CSS variables) ──────
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── AutoCDP brand — deep indigo (primary actions) ──────────────
        // Replaces previous bright blue. Pairs with the dark navy sidebar.
        brand: {
          50:  "#eef2ff",  // indigo-50
          100: "#e0e7ff",  // indigo-100
          200: "#c7d2fe",  // indigo-200
          300: "#a5b4fc",  // indigo-300
          400: "#818cf8",  // indigo-400
          500: "#6366f1",  // indigo-500
          600: "#4f46e5",  // indigo-600  ← primary CTA
          700: "#4338ca",  // indigo-700
          800: "#3730a3",  // indigo-800
          900: "#312e81",  // indigo-900
        },

        // ── Navy — structural dark elements (sidebar, deep headings) ───
        navy: {
          700: "#334155",  // slate-700
          800: "#1e293b",  // slate-800
          900: "#0f172a",  // slate-900  ← sidebar base
        },

        // ── Success — emerald (positive KPIs, scan rates, connected) ──
        success: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          400: "#34d399",
          500: "#10b981",  // emerald-500  ← primary success
          600: "#059669",
          700: "#047857",
          900: "#064e3b",
        },

        // ── Warning — amber (kept for existing warning badges) ─────────
        warning: {
          50:  "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      fontFamily: {
        sans:        ["var(--font-sans)", ...fontFamily.sans],
        handwriting: ["'Caveat'", "cursive"],
      },

      boxShadow: {
        // Institutional card shadow — very subtle depth, no bloom
        card:  "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)",
        "card-md": "0 4px 6px -1px rgb(15 23 42 / 0.07), 0 2px 4px -2px rgb(15 23 42 / 0.05)",
        "card-lg": "0 10px 15px -3px rgb(15 23 42 / 0.08), 0 4px 6px -4px rgb(15 23 42 / 0.05)",
        // For modals / popovers
        modal: "0 20px 25px -5px rgb(15 23 42 / 0.10), 0 8px 10px -6px rgb(15 23 42 / 0.08)",
      },

      fontSize: {
        // Tighter tracking at larger sizes for institutional headings
        "2xl": ["1.5rem",   { lineHeight: "2rem",   letterSpacing: "-0.015em" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em" }],
        "4xl": ["2.25rem",  { lineHeight: "2.5rem",  letterSpacing: "-0.025em" }],
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "pulse-slow":     "pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":        "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
