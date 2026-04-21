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
        // ── shadcn/ui semantic tokens ─────────────────────────────
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

        // ── Brand — deep indigo ───────────────────────────────────
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },

        // ── Navy — sidebar & dark sections ────────────────────────
        navy: {
          950: "#060D18",
          900: "#0B1526",
          850: "#0F1D34",
          800: "#152238",
          700: "#1E3048",
          600: "#2A4060",
          // legacy aliases
          "700-old": "#334155",
          "800-old": "#1e293b",
        },

        // ── Surface — layered page backgrounds ───────────────────
        surface: {
          0: "#FFFFFF",
          1: "#F8FAFC",
          2: "#F1F5F9",
          3: "#E8EEF4",
        },

        // ── Success — emerald ─────────────────────────────────────
        success: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          900: "#064e3b",
        },

        // ── Warning — amber ───────────────────────────────────────
        warning: {
          50:  "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
      },

      borderRadius: {
        lg:    "var(--radius)",
        md:    "calc(var(--radius) - 2px)",
        sm:    "calc(var(--radius) - 4px)",
        xl:    "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },

      fontFamily: {
        sans:        ["var(--font-sans)", "Inter", ...fontFamily.sans],
        handwriting: ["'Caveat'", "cursive"],
      },

      boxShadow: {
        // ── Base elevation scale ──────────────────────────────────
        card:         "0 1px 3px 0 rgb(15 23 42 / 0.05), 0 1px 2px -1px rgb(15 23 42 / 0.04)",
        "card-md":    "0 4px 10px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)",
        "card-lg":    "0 10px 24px -6px rgb(15 23 42 / 0.10), 0 4px 8px -4px rgb(15 23 42 / 0.05)",
        "card-hover": "0 18px 40px -8px rgb(15 23 42 / 0.13), 0 6px 14px -4px rgb(15 23 42 / 0.07)",
        "card-float": "0 24px 48px -10px rgb(15 23 42 / 0.16), 0 8px 18px -6px rgb(15 23 42 / 0.08)",
        modal:        "0 28px 56px -10px rgb(15 23 42 / 0.22), 0 10px 20px -8px rgb(15 23 42 / 0.10)",
        panel:        "0 1px 3px 0 rgb(15 23 42 / 0.04), inset 0 1px 0 rgb(255 255 255 / 0.80)",
        // ── Colored glows ─────────────────────────────────────────
        indigo:        "0 6px 20px -4px rgb(79 70 229 / 0.38)",
        emerald:       "0 6px 20px -4px rgb(16 185 129 / 0.32)",
        "glow-indigo": "0 0 0 1.5px rgb(99 102 241 / 0.20), 0 8px 24px -4px rgb(79 70 229 / 0.22)",
        "glow-emerald":"0 0 0 1.5px rgb(16 185 129 / 0.20), 0 8px 24px -4px rgb(5 150 105 / 0.20)",
        "glow-sky":    "0 0 0 1.5px rgb(14 165 233 / 0.20), 0 8px 24px -4px rgb(2 132 199 / 0.18)",
        "glow-amber":  "0 0 0 1.5px rgb(245 158 11 / 0.20), 0 8px 24px -4px rgb(217 119 6 / 0.18)",
        "glow-violet": "0 0 0 1.5px rgb(139 92 246 / 0.20), 0 8px 24px -4px rgb(124 58 237 / 0.18)",
        "glow-rose":   "0 0 0 1.5px rgb(244 63 94 / 0.20), 0 8px 24px -4px rgb(225 29 72 / 0.18)",
      },

      fontSize: {
        "2xl": ["1.5rem",   { lineHeight: "2rem",    letterSpacing: "-0.015em" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.020em" }],
        "4xl": ["2.25rem",  { lineHeight: "2.5rem",  letterSpacing: "-0.025em" }],
        "5xl": ["3rem",     { lineHeight: "1",        letterSpacing: "-0.030em" }],
        "6xl": ["3.75rem",  { lineHeight: "1",        letterSpacing: "-0.040em" }],
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
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up-sm": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-6px)" },
        },
        "ping-slow": {
          "75%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "bar-grow": {
          from: { width: "0%" },
          to:   { width: "var(--bar-w, 100%)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(6px) scale(0.97)" },
          to:   { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "pulse-slow":     "pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":        "fade-in 0.2s ease-out both",
        "fade-up":        "fade-up 0.4s ease-out both",
        "fade-up-sm":     "fade-up-sm 0.25s ease-out both",
        "float":          "float 4s ease-in-out infinite",
        "ping-slow":      "ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        "shimmer":        "shimmer 2.5s linear infinite",
        "bar-grow":       "bar-grow 0.7s ease-out forwards",
        "count-up":       "count-up 0.4s ease-out both",
      },

      transitionDuration: {
        "150": "150ms",
        "200": "200ms",
        "250": "250ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
