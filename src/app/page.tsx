"use client";

import Link from "next/link";
import {
  Car, BarChart3, Mail, Bot, Shield, Zap, TrendingUp,
  CheckCircle, ArrowRight, Star, Cpu, Target, Database,
  Sparkles, Users, ArrowUpRight, Activity, CheckCircle2,
  Megaphone, ScanLine, MessageSquare,
} from "lucide-react";

export const metadata = {
  title: "AutoCDP — AI Marketing That Runs Itself",
  description: "5 AI agents that autonomously run your dealership marketing. Personalized direct mail, QR tracking, and optimization — all from one DMS-connected platform.",
};

// ── Data ──────────────────────────────────────────────────────

const features = [
  {
    icon: Bot,
    title: "5-Agent AI Swarm",
    desc: "Orchestrator, Data, Targeting, Creative, and Optimization agents work in sequence — no prompts, no babysitting, no vendor wrangling.",
    iconBg: "bg-indigo-50", iconColor: "text-indigo-600", glowClass: "feature-card-indigo",
    topColor: "#6366F1",
    stat: "5 agents", statLabel: "always running",
  },
  {
    icon: Mail,
    title: "Native Direct Mail",
    desc: "PostGrid-powered postcards and letters with QR tracking. Personalized per customer, printed, and fulfilled automatically.",
    iconBg: "bg-sky-50", iconColor: "text-sky-600", glowClass: "feature-card-sky",
    topColor: "#0EA5E9",
    stat: "< $1.60", statLabel: "per piece",
  },
  {
    icon: TrendingUp,
    title: "Self-Learning Optimization",
    desc: "Every campaign result trains the next one. Response patterns improve across your entire customer base over time.",
    iconBg: "bg-amber-50", iconColor: "text-amber-600", glowClass: "feature-card-amber",
    topColor: "#F59E0B",
    stat: "3×", statLabel: "response rate",
  },
  {
    icon: Database,
    title: "Last-Visit Memory",
    desc: "Knows exactly what each customer drove in for, what they spent, and when they're likely to return — updated every sync.",
    iconBg: "bg-emerald-50", iconColor: "text-emerald-600", glowClass: "feature-card-emerald",
    topColor: "#10B981",
    stat: "360°", statLabel: "customer view",
  },
  {
    icon: Zap,
    title: "DMS Integration",
    desc: "CDK Fortellis and Reynolds & Reynolds sync automatically. Customer, RO, and inventory data — always current, zero exports.",
    iconBg: "bg-violet-50", iconColor: "text-violet-600", glowClass: "feature-card-violet",
    topColor: "#8B5CF6",
    stat: "30 min", statLabel: "sync interval",
  },
  {
    icon: Shield,
    title: "Hybrid Pricing",
    desc: "Pay for what you send. No per-seat licenses, no long-term contracts. Scale up during conquest, scale down in slow months.",
    iconBg: "bg-rose-50", iconColor: "text-rose-600", glowClass: "feature-card-rose",
    topColor: "#F43F5E",
    stat: "$0", statLabel: "setup fee",
  },
];

const steps = [
  {
    step: "01", icon: Database,
    title: "Connect your DMS",
    desc: "OAuth or API key. CDK Fortellis and Reynolds sync every 30–60 minutes. No CSV exports, no manual uploads.",
    time: "~15 min setup",
  },
  {
    step: "02", icon: Target,
    title: "Set a campaign goal",
    desc: "\"Win back service customers lapsed 6–12 months.\" Plain language — the AI handles audience selection, copy, and fulfillment.",
    time: "60 seconds",
  },
  {
    step: "03", icon: Cpu,
    title: "Agents do the work",
    desc: "Data → Targeting → Creative → Print → Mail. Personalized per customer, QR-tracked, optimized after every campaign.",
    time: "< 48h to mailbox",
  },
];

const differentiators = [
  "Direct mail fulfilled, tracked, and optimized — no vendor wrangling",
  "AI agents re-run after every DMS sync, not on a monthly schedule",
  "Global learnings shared across the platform improve every dealer",
  "RLS-enforced data isolation — your data never crosses dealership lines",
];

const testimonials = [
  {
    quote: "We replaced three separate vendors — mail house, CRM, and reporting — with AutoCDP. Our service lane retention is up 18% in 90 days.",
    name: "Bryant M.", title: "Fixed Ops Director, Multi-Rooftop Group",
    initials: "BM", stat: "+18%", statLabel: "retention lift",
    statColor: "#059669", statBg: "rgba(16,185,129,0.07)", statBorder: "rgba(16,185,129,0.18)",
  },
  {
    quote: "The AI writes better win-back copy than our ad agency did. And it sends automatically the moment a customer goes lapsed. Set it and forget it.",
    name: "Jake R.", title: "General Manager, Franchise Dealership",
    initials: "JR", stat: "3×", statLabel: "mail response rate",
    statColor: "#4338CA", statBg: "rgba(99,102,241,0.07)", statBorder: "rgba(99,102,241,0.18)",
  },
];

const stats = [
  { value: "18%",  label: "Avg. retention lift",       color: "#059669" },
  { value: "3×",   label: "Response vs. generic mail",  color: "#4338CA" },
  { value: "< 2h", label: "Time to first campaign",     color: "#B45309" },
  { value: "0",    label: "Manual steps per send",      color: "#5B21B6" },
];

const mockAgents = [
  { name: "Orchestrator", state: "done",    model: "opus-4.7",   dot: "bg-emerald-500" },
  { name: "Data Agent",   state: "done",    model: "sonnet-4.6", dot: "bg-emerald-500" },
  { name: "Targeting",    state: "running", model: "sonnet-4.6", dot: "bg-indigo-400 animate-pulse" },
  { name: "Creative",     state: "running", model: "sonnet-4.6", dot: "bg-indigo-400 animate-pulse" },
  { name: "Optimization", state: "idle",    model: "sonnet-4.6", dot: "bg-slate-600" },
];

const mockStats = [
  { label: "Sent (30d)", value: "2,847", leftBorder: "#6366F1", color: "#4338CA" },
  { label: "Scan Rate",  value: "18.3%", leftBorder: "#10B981", color: "#065F46" },
  { label: "Conv.",      value: "127",   leftBorder: "#8B5CF6", color: "#5B21B6" },
  { label: "Revenue",    value: "$84k",  leftBorder: "#F59E0B", color: "#92400E" },
];

const mockCampaigns = [
  { name: "VIP Win-back Q2",      pct: 84, sent: "1,243", dotColor: "#10B981" },
  { name: "Service Due — May",    pct: 61, sent: "892",   dotColor: "#6366F1" },
  { name: "Conquest — 48304",     pct: 37, sent: "504",   dotColor: "#0EA5E9" },
];

const integrations = [
  { name: "CDK Fortellis",       abbr: "CDK" },
  { name: "Reynolds & Reynolds", abbr: "R&R" },
  { name: "PostGrid",            abbr: "PG"  },
  { name: "Anthropic Claude",    abbr: "AI"  },
  { name: "Twilio",              abbr: "SMS" },
  { name: "Resend",              abbr: "✉"   },
  { name: "USPS",                abbr: "USPS"},
  { name: "Stripe",              abbr: "Pay" },
];

// ── Page ──────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Announcement bar ──────────────────────────────── */}
      <div className="relative py-2.5 px-4 text-center" style={{ background: "#060D18" }}>
        <div className="flex items-center justify-center gap-2.5 text-xs font-medium">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-white/50">Now live:</span>
          <span className="text-white/80">CDK Fortellis &amp; Reynolds native integration</span>
          <Link href="/signup" className="hidden sm:inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors ml-0.5">
            Get access <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(14px) saturate(180%)",
          WebkitBackdropFilter: "blur(14px) saturate(180%)",
          borderBottom: "1px solid rgba(15,23,42,0.07)",
          boxShadow: "0 1px 0 0 rgba(15,23,42,0.04)",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #0F1E35 0%, #0B1526 100%)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[17px] tracking-tight" style={{ color: "#0F172A" }}>AutoCDP</span>
          </div>

          <div className="hidden md:flex items-center gap-0.5">
            {["Features", "How it works", "Results"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all"
                style={{ color: "#64748B" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = "#0F172A";
                  (e.currentTarget as HTMLAnchorElement).style.background = "#F8FAFC";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = "#64748B";
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                }}
              >
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:block text-[13px] font-semibold px-3 py-2 rounded-lg transition-all"
              style={{ color: "#475569" }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[13px] font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                boxShadow: "0 1px 3px 0 rgba(79,70,229,0.30), inset 0 1px 0 rgba(255,255,255,0.10)",
              }}
            >
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════ */}
      {/* HERO                                               */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 px-5 sm:px-8 overflow-hidden">

        {/* Background layers */}
        <div className="absolute inset-0 hero-grid" style={{ opacity: 0.35 }} />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 50% at 50% -5%, rgba(99,102,241,0.09), transparent)" }}
        />
        <div
          className="absolute -top-32 right-0 w-[700px] h-[600px] rounded-full blur-3xl translate-x-1/3 pointer-events-none"
          style={{ background: "rgba(99,102,241,0.055)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 pointer-events-none"
          style={{ background: "rgba(16,185,129,0.05)" }}
        />

        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-16 xl:gap-20 items-center">

            {/* ── Left copy ─────────────────────────────── */}
            <div className="stagger-1 max-w-xl xl:max-w-none">

              {/* Live badge */}
              <div
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-7 text-[11px] font-bold uppercase tracking-widest"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.22)",
                  color: "#059669",
                }}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Agents running now · 2,847 pieces sent today
              </div>

              <h1
                className="text-[2.75rem] sm:text-[3.4rem] xl:text-[3.75rem] font-black leading-[1.05] tracking-[-0.03em] mb-6"
                style={{ color: "#0F172A" }}
              >
                The dealership
                <br />
                <span className="gradient-text">that markets itself.</span>
              </h1>

              <p className="text-[17px] sm:text-[18px] leading-[1.65] mb-8 max-w-lg" style={{ color: "#64748B" }}>
                Connect your DMS. Set one goal. Five AI agents identify your best prospects, write{" "}
                <span style={{ color: "#334155", fontWeight: 600 }}>1-to-1 personalized copy</span>, and drop physical postcards in the mailbox — tracked, optimized, automatic.
              </p>

              {/* CTA row */}
              <div className="flex flex-col sm:flex-row gap-3 mb-7">
                <Link
                  href="/signup"
                  className="btn-press inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold text-[15px] transition-all"
                  style={{
                    background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                    boxShadow: "0 6px 24px -4px rgba(79,70,229,0.50), inset 0 1px 0 rgba(255,255,255,0.12)",
                  }}
                >
                  Start free trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="btn-press inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-[15px] transition-all"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(15,23,42,0.12)",
                    color: "#334155",
                    boxShadow: "0 1px 3px 0 rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                >
                  Request a demo
                </Link>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-9">
                {["No credit card required", "Setup in under 2 hours", "Cancel anytime"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "#94A3B8" }}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {t}
                  </span>
                ))}
              </div>

              {/* Social proof */}
              <div
                className="flex items-center gap-4 pt-6"
                style={{ borderTop: "1px solid rgba(15,23,42,0.07)" }}
              >
                <div className="flex -space-x-2">
                  {[
                    { i: "BM", bg: "#0B1526" }, { i: "JR", bg: "#6366F1" },
                    { i: "KP", bg: "#10B981" }, { i: "SR", bg: "#8B5CF6" },
                    { i: "DL", bg: "#F59E0B" },
                  ].map((a, idx) => (
                    <div
                      key={idx}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{
                        background: a.bg,
                        border: "2px solid white",
                        boxShadow: "0 0 0 1px rgba(15,23,42,0.08)",
                      }}
                    >
                      {a.i}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-[12px] font-medium" style={{ color: "#64748B" }}>
                    Trusted by <span className="font-bold" style={{ color: "#0F172A" }}>40+ dealerships</span> in pilot
                  </p>
                </div>
              </div>
            </div>

            {/* ── Right: Dashboard mockup ────────────────── */}
            <div className="relative hidden xl:block stagger-2">

              {/* Ambient glow behind mockup */}
              <div
                className="absolute -inset-10 rounded-3xl pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 55% 45%, rgba(99,102,241,0.09), transparent 65%)" }}
              />

              <div className="relative animate-float-slow">
                {/* Main window */}
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    border: "1px solid rgba(15,23,42,0.14)",
                    boxShadow: "0 36px 80px -14px rgba(15,23,42,0.24), 0 6px 20px -6px rgba(15,23,42,0.10)",
                  }}
                >
                  {/* Browser chrome */}
                  <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: "#060D18" }}>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(239,68,68,0.55)" }} />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(245,158,11,0.55)" }} />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(16,185,129,0.55)" }} />
                    </div>
                    <div className="flex-1 mx-2">
                      <div
                        className="flex items-center gap-2 px-3 py-1 rounded-md"
                        style={{ background: "rgba(255,255,255,0.07)" }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(16,185,129,0.7)" }} />
                        <span className="text-[9px] font-mono flex-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                          app.autocdp.com/dashboard
                        </span>
                        <span className="text-[8px] font-semibold" style={{ color: "rgba(255,255,255,0.20)" }}>
                          AutoCDP
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* App shell */}
                  <div className="flex" style={{ background: "#F3F6FA", minHeight: 370 }}>

                    {/* Sidebar */}
                    <div className="w-[132px] shrink-0 flex flex-col" style={{ background: "#0B1526" }}>
                      <div
                        className="flex items-center gap-2 px-3 py-3"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center"
                          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.3))", border: "1px solid rgba(255,255,255,0.10)" }}
                        >
                          <Car className="w-2.5 h-2.5 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-white">AutoCDP</span>
                      </div>

                      <div className="p-2 flex-1 space-y-0.5">
                        <div className="px-2 pt-2 pb-0.5 text-[7px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.18)" }}>Core</div>
                        {[
                          { label: "Dashboard", active: true },
                          { label: "Customers",  active: false },
                          { label: "Campaigns",  active: false },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[9px] font-medium relative"
                            style={{
                              color: item.active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.34)",
                              background: item.active ? "rgba(255,255,255,0.10)" : undefined,
                            }}
                          >
                            {item.active && (
                              <div
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 rounded-r"
                                style={{ background: "#10B981", boxShadow: "0 0 8px rgba(16,185,129,0.5)" }}
                              />
                            )}
                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: item.active ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.10)" }} />
                            {item.label}
                          </div>
                        ))}
                        <div className="px-2 pt-2 pb-0.5 text-[7px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.18)" }}>Channels</div>
                        {["Direct Mail", "Analytics", "AI Agents"].map((label) => (
                          <div key={label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[9px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
                            {label}
                          </div>
                        ))}
                      </div>

                      <div className="p-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[6px] font-bold shrink-0"
                            style={{ background: "#4338CA" }}
                          >BM</div>
                          <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.35)" }}>Bryant M.</span>
                        </div>
                      </div>
                    </div>

                    {/* Main content */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Header */}
                      <div
                        className="flex items-center justify-between px-4 py-2.5"
                        style={{ background: "rgba(255,255,255,0.96)", borderBottom: "1px solid rgba(15,23,42,0.07)" }}
                      >
                        <div>
                          <p className="text-[11px] font-semibold" style={{ color: "#0F172A" }}>Dashboard</p>
                          <p className="text-[8px]" style={{ color: "#94A3B8" }}>Sunrise Ford · Scottsdale AZ</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="flex items-center gap-1.5 h-5 px-2 rounded-md"
                            style={{ background: "#F1F5F9", border: "1px solid rgba(15,23,42,0.07)" }}
                          >
                            <div className="w-2 h-2 rounded-sm" style={{ background: "#CBD5E1" }} />
                            <span className="text-[8px]" style={{ color: "#94A3B8" }}>Search…</span>
                          </div>
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-bold"
                            style={{ background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)", color: "#4338CA" }}
                          >BM</div>
                        </div>
                      </div>

                      <div className="flex-1 p-3 space-y-2 overflow-hidden">

                        {/* Stat cards */}
                        <div className="grid grid-cols-4 gap-1.5">
                          {mockStats.map((s) => (
                            <div
                              key={s.label}
                              className="rounded-lg p-2 relative overflow-hidden"
                              style={{
                                background: "#FFFFFF",
                                border: "1px solid rgba(15,23,42,0.08)",
                                boxShadow: "0 1px 2px 0 rgba(15,23,42,0.04)",
                              }}
                            >
                              <div
                                className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r"
                                style={{ background: s.leftBorder }}
                              />
                              <p className="text-[7px] font-bold uppercase tracking-wider pl-1" style={{ color: "#94A3B8" }}>{s.label}</p>
                              <p className="text-[13px] font-black mt-0.5 tabular-nums pl-1" style={{ color: s.color }}>{s.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Campaign + Agent grid */}
                        <div className="grid grid-cols-5 gap-1.5">

                          {/* Campaigns */}
                          <div
                            className="col-span-3 rounded-lg overflow-hidden"
                            style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.08)", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
                          >
                            <div
                              className="flex items-center justify-between px-2.5 py-1.5"
                              style={{ borderBottom: "1px solid rgba(15,23,42,0.06)", background: "#FAFBFC" }}
                            >
                              <div className="flex items-center gap-1">
                                <Megaphone className="w-2.5 h-2.5" style={{ color: "#94A3B8" }} />
                                <p className="text-[8px] font-bold" style={{ color: "#334155" }}>Active Campaigns</p>
                              </div>
                              <span
                                className="text-[7px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: "#EEF2FF", color: "#4338CA" }}
                              >3 running</span>
                            </div>
                            <div className="p-2 space-y-2">
                              {mockCampaigns.map((c) => (
                                <div key={c.name}>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <div className="flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dotColor }} />
                                      <span className="text-[8px] font-medium truncate max-w-[90px]" style={{ color: "#334155" }}>{c.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[7px] tabular-nums" style={{ color: "#94A3B8" }}>{c.sent}</span>
                                      <span className="text-[7px] font-bold tabular-nums" style={{ color: c.dotColor }}>{c.pct}%</span>
                                    </div>
                                  </div>
                                  <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "#F1F5F9" }}>
                                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.dotColor }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Agent swarm */}
                          <div
                            className="col-span-2 rounded-lg overflow-hidden flex flex-col"
                            style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.08)", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
                          >
                            <div
                              className="flex items-center justify-between px-2.5 py-1.5 shrink-0"
                              style={{ borderBottom: "1px solid rgba(15,23,42,0.06)", background: "#FAFBFC" }}
                            >
                              <div className="flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" style={{ color: "#8B5CF6" }} />
                                <p className="text-[8px] font-bold" style={{ color: "#334155" }}>AI Agents</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                <span className="text-[7px] font-bold" style={{ color: "#4338CA" }}>LIVE</span>
                              </div>
                            </div>
                            <div className="p-2 space-y-0.5 flex-1">
                              {mockAgents.map((a) => (
                                <div
                                  key={a.name}
                                  className="flex items-center gap-1.5 px-1 py-0.5 rounded"
                                  style={a.state === "running" ? { background: "rgba(99,102,241,0.06)" } : {}}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.dot}`} />
                                  <span
                                    className="text-[8px] flex-1 truncate"
                                    style={{ color: a.state === "running" ? "#4338CA" : "#64748B", fontWeight: a.state === "running" ? 600 : 400 }}
                                  >{a.name}</span>
                                  <span
                                    className="text-[7px] font-bold"
                                    style={{
                                      color: a.state === "done" ? "#059669" :
                                             a.state === "running" ? "#6366F1" : "#CBD5E1"
                                    }}
                                  >
                                    {a.state === "done" ? "✓" : a.state === "running" ? "···" : "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* Live copy preview */}
                            <div
                              className="mx-1.5 mb-1.5 p-1.5 rounded-md"
                              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)" }}
                            >
                              <p className="text-[6px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#6366F1" }}>Creative · Writing</p>
                              <p className="text-[7px] leading-relaxed" style={{ color: "#4338CA" }}>
                                "James, your 2021 Tacoma is due…"
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Live activity ticker — dark */}
                        <div
                          className="rounded-lg px-2.5 py-1.5 flex items-center gap-2.5 overflow-hidden"
                          style={{ background: "#0B1526" }}
                        >
                          <div className="flex items-center gap-1 shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[7px] font-bold uppercase tracking-wider" style={{ color: "#34D399" }}>LIVE</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-[8px] overflow-hidden">
                            <span className="font-semibold" style={{ color: "#34D399" }}>↑ 3 pieces sent</span>
                            <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                            <span style={{ color: "rgba(255,255,255,0.45)" }}>QR scan: James C. (Scottsdale)</span>
                            <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                            <span style={{ color: "rgba(255,255,255,0.45)" }}>Win-back: 127 conversions</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badge: conversions */}
                <div className="absolute -bottom-6 -left-9 animate-float-delayed">
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(15,23,42,0.09)",
                      boxShadow: "0 12px 32px -6px rgba(15,23,42,0.16), 0 2px 8px -2px rgba(15,23,42,0.08)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.18)" }}
                    >
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>Campaign result</p>
                      <p className="text-[13px] font-black tracking-tight" style={{ color: "#059669" }}>+127 conversions</p>
                    </div>
                  </div>
                </div>

                {/* Floating badge: QR scan */}
                <div className="absolute -top-6 -right-7 animate-float-slow">
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(15,23,42,0.09)",
                      boxShadow: "0 12px 32px -6px rgba(15,23,42,0.16), 0 2px 8px -2px rgba(15,23,42,0.08)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.18)" }}
                    >
                      <ScanLine className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>QR code scanned</p>
                      <p className="text-[13px] font-black tracking-tight" style={{ color: "#0F172A" }}>James C. — 2m ago</p>
                    </div>
                  </div>
                </div>

                {/* Floating badge: mail sent */}
                <div className="absolute top-[42%] -right-10 animate-float" style={{ animationDelay: "1s" }}>
                  <div
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(15,23,42,0.09)",
                      boxShadow: "0 8px 24px -4px rgba(15,23,42,0.14)",
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.18)" }}
                    >
                      <Mail className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-[9px] font-medium" style={{ color: "#94A3B8" }}>PostGrid</p>
                      <p className="text-[11px] font-bold" style={{ color: "#0F172A" }}>Mail fulfilled ✓</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* INTEGRATION TICKER                                 */}
      {/* ═══════════════════════════════════════════════════ */}
      <div style={{ borderTop: "1px solid rgba(15,23,42,0.06)", borderBottom: "1px solid rgba(15,23,42,0.06)", background: "#FAFBFC" }} className="py-7 px-5 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] mb-6" style={{ color: "#CBD5E1" }}>
            Works with your existing stack
          </p>
          <div className="overflow-hidden relative">
            <div
              className="absolute left-0 inset-y-0 w-24 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to right, #FAFBFC, transparent)" }}
            />
            <div
              className="absolute right-0 inset-y-0 w-24 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to left, #FAFBFC, transparent)" }}
            />
            <div className="flex ticker-track gap-10 items-center whitespace-nowrap">
              {[...integrations, ...integrations].map((intg, i) => (
                <div key={i} className="flex items-center gap-2.5 shrink-0 group">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(15,23,42,0.10)",
                      boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                    }}
                  >
                    <span className="text-[8px] font-black" style={{ color: "#64748B" }}>{intg.abbr}</span>
                  </div>
                  <span className="text-[13px] font-semibold transition-colors" style={{ color: "#94A3B8" }}>
                    {intg.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* STATS BAR                                          */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="py-20 px-5 sm:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div
            className="grid grid-cols-2 md:grid-cols-4 rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(15,23,42,0.08)", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="px-8 py-10 text-center bg-white"
                style={{
                  borderRight: i < stats.length - 1 ? "1px solid rgba(15,23,42,0.07)" : undefined,
                  borderBottom: i < 2 ? "1px solid rgba(15,23,42,0.07)" : undefined,
                }}
              >
                <div
                  className="text-[2.5rem] font-black tracking-tight leading-none mb-2 stat-number"
                  style={{ color: s.color }}
                >
                  {s.value}
                </div>
                <div className="text-[12px] font-medium leading-snug" style={{ color: "#94A3B8" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* FEATURES                                           */}
      {/* ═══════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-5 sm:px-8" style={{ background: "#F8FAFC" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 section-enter">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold mb-5 uppercase tracking-widest"
              style={{ background: "#EEF2FF", border: "1px solid rgba(165,180,252,0.45)", color: "#4338CA" }}
            >
              Platform capabilities
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4" style={{ color: "#0F172A" }}>
              Everything in one platform
            </h2>
            <p className="text-[17px] max-w-xl mx-auto leading-relaxed" style={{ color: "#64748B" }}>
              Built for dealer groups that want AI-driven marketing without stitching together five vendors.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`feature-card ${f.glowClass} group p-7 rounded-2xl border border-slate-200 bg-white shadow-card stagger-${Math.min(i + 1, 6)} relative overflow-hidden`}
              >
                {/* Colored top accent */}
                <div className="absolute top-0 left-0 right-0 h-[2.5px]" style={{ background: f.topColor }} />

                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${f.iconBg} group-hover:scale-110 transition-transform duration-200`}
                >
                  <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <h3 className="font-bold text-[15px] mb-2 tracking-tight" style={{ color: "#0F172A" }}>{f.title}</h3>
                <p className="text-[13px] leading-relaxed mb-5" style={{ color: "#64748B" }}>{f.desc}</p>
                <div
                  className="flex items-center gap-2 pt-4"
                  style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}
                >
                  <span className="text-[17px] font-black tracking-tight" style={{ color: "#0F172A" }}>{f.stat}</span>
                  <span className="text-[11px] font-medium" style={{ color: "#94A3B8" }}>{f.statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* HOW IT WORKS                                       */}
      {/* ═══════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-5 sm:px-8 relative overflow-hidden" style={{ background: "#0B1526" }}>
        <div className="absolute inset-0 dark-grid opacity-70" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.14) 0%, transparent 65%)" }}
        />

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold mb-5 uppercase tracking-widest"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}
            >
              How It Works
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
              Connect once. Run forever.
            </h2>
            <p className="text-[17px] font-medium max-w-xl mx-auto leading-relaxed" style={{ color: "#64748B" }}>
              The AI swarm handles everything — audience selection, personalized copy, and physical mail fulfillment.
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative mb-6">
            {/* Connector line */}
            <div
              className="hidden md:block absolute h-px pointer-events-none"
              style={{
                top: "52px",
                left: "calc(33.333% + 1.5rem)",
                right: "calc(33.333% + 1.5rem)",
                background: "linear-gradient(to right, rgba(255,255,255,0.08), rgba(99,102,241,0.35), rgba(255,255,255,0.08))",
              }}
            />

            {steps.map((s, i) => (
              <div
                key={s.step}
                className="relative p-7 rounded-2xl transition-all duration-200 group cursor-default"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.12)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.22)" }}
                  >
                    <s.icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span
                    className="text-[2.5rem] font-black tabular-nums leading-none"
                    style={{ color: "rgba(255,255,255,0.05)" }}
                  >
                    {s.step}
                  </span>
                </div>
                <h3 className="font-semibold text-white text-[15px] mb-2 tracking-tight">{s.title}</h3>
                <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#64748B" }}>{s.desc}</p>
                <div
                  className="flex items-center gap-1.5 text-[11px] font-semibold"
                  style={{ color: "rgba(52,211,153,0.75)" }}
                >
                  <CheckCircle className="w-3 h-3" />
                  {s.time}
                </div>
              </div>
            ))}
          </div>

          {/* Differentiators */}
          <div
            className="p-7 rounded-2xl"
            style={{
              background: "rgba(16,185,129,0.05)",
              border: "1px solid rgba(16,185,129,0.14)",
            }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.12)" }}
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-white font-semibold text-[14px]">
                Key differentiators vs. Fullpath, CDK, and legacy DMS platforms
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {differentiators.map((d) => (
                <div key={d} className="flex items-start gap-3">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center mt-0.5 shrink-0"
                    style={{ background: "rgba(16,185,129,0.12)" }}
                  >
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                  </div>
                  <span className="text-[13px] leading-relaxed" style={{ color: "#94A3B8" }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* TESTIMONIALS + COMPARISON                          */}
      {/* ═══════════════════════════════════════════════════ */}
      <section id="results" className="py-24 px-5 sm:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold mb-5 uppercase tracking-widest"
              style={{ background: "#FFFBEB", border: "1px solid rgba(251,191,36,0.40)", color: "#92400E" }}
            >
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Real Results
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3" style={{ color: "#0F172A" }}>
              Real results from real dealers
            </h2>
            <p className="text-[17px] font-medium" style={{ color: "#64748B" }}>
              Not projections. Actual outcomes from pilot dealerships.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="card-lift p-8 rounded-2xl bg-white"
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <div
                    className="text-right px-4 py-2 rounded-xl"
                    style={{ background: t.statBg, border: `1px solid ${t.statBorder}` }}
                  >
                    <div className="text-2xl font-black tracking-tight" style={{ color: t.statColor }}>{t.stat}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "#94A3B8" }}>{t.statLabel}</div>
                  </div>
                </div>

                <blockquote className="text-[15px] italic leading-relaxed mb-7" style={{ color: "#334155" }}>
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <div
                  className="flex items-center gap-3 pt-5"
                  style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: "#0B1526", boxShadow: "0 0 0 2px white, 0 0 0 3px rgba(15,23,42,0.08)" }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "#0F172A" }}>{t.name}</p>
                    <p className="text-[11px] font-medium" style={{ color: "#94A3B8" }}>{t.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(15,23,42,0.08)", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
          >
            <div
              className="px-6 py-4"
              style={{ background: "#F8FAFC", borderBottom: "1px solid rgba(15,23,42,0.06)" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "#94A3B8" }}>
                AutoCDP vs. traditional approaches
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "rgba(15,23,42,0.07)" }}>
              {[
                {
                  label: "Legacy Mail House",
                  items: ["Manual list pulls", "Generic copy", "No QR tracking", "30-day batch cycles"],
                  ok: false,
                },
                {
                  label: "Fullpath / CDK Marketing",
                  items: ["Digital-only focus", "Per-seat pricing", "No direct mail", "Limited personalization"],
                  ok: false,
                },
                {
                  label: "AutoCDP",
                  items: ["Fully automated", "AI-personalized copy", "QR-tracked mail", "Usage-based pricing"],
                  ok: true,
                },
              ].map((col, ci) => (
                <div
                  key={col.label}
                  className="px-6 py-5"
                  style={col.ok ? { background: "#FAFBFF" } : {}}
                >
                  <p
                    className="text-[11px] font-bold uppercase tracking-wider mb-4"
                    style={{ color: col.ok ? "#4338CA" : "#94A3B8" }}
                  >
                    {col.label}
                  </p>
                  <ul className="space-y-2.5">
                    {col.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[12px]">
                        {col.ok ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <div
                            className="w-3.5 h-3.5 rounded-full border-2 shrink-0"
                            style={{ borderColor: "#E2E8F0" }}
                          />
                        )}
                        <span style={{ color: col.ok ? "#334155" : "#94A3B8", fontWeight: col.ok ? 500 : 400 }}>
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* FINAL CTA                                          */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="py-24 px-5 sm:px-8 relative overflow-hidden" style={{ background: "#0B1526" }}>
        <div className="absolute inset-0 dark-grid opacity-60" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 65%)" }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(16,185,129,0.10) 0%, transparent 70%)" }}
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold mb-8 uppercase tracking-widest"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.40)" }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Ready when you are
          </div>

          <h2 className="text-3xl sm:text-[2.8rem] font-black text-white tracking-tight mb-4 leading-tight">
            Launch your first AI campaign
            <br />
            <span style={{ color: "#818CF8" }}>in under two hours.</span>
          </h2>
          <p className="text-[17px] font-medium mb-10 leading-relaxed max-w-xl mx-auto" style={{ color: "#64748B" }}>
            Most dealerships connect their DMS, set a goal, and have mail in-transit the same day.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link
              href="/signup"
              className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-[15px] transition-all"
              style={{
                background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                boxShadow: "0 10px 36px -8px rgba(79,70,229,0.65), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-[15px] transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.80)",
              }}
            >
              Request a demo <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {["14-day free trial", "No credit card", "Full feature access", "Cancel anytime"].map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "#475569" }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* FOOTER                                             */}
      {/* ═══════════════════════════════════════════════════ */}
      <footer className="bg-white" style={{ borderTop: "1px solid rgba(15,23,42,0.07)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #0F1E35, #0B1526)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  }}
                >
                  <Car className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-[15px] tracking-tight" style={{ color: "#0F172A" }}>AutoCDP</span>
              </div>
              <p className="text-[13px] leading-relaxed max-w-[200px]" style={{ color: "#94A3B8" }}>
                AI-powered marketing for modern dealership groups.
              </p>
            </div>

            {[
              {
                heading: "Product",
                links: ["Features", "How it works", "Pricing", "Security"].map((l) => ({ label: l, href: "#" })),
              },
              {
                heading: "Integrations",
                links: ["CDK Fortellis", "Reynolds & Reynolds", "PostGrid", "Twilio"].map((l) => ({ label: l, href: "#" })),
              },
              {
                heading: "Account",
                links: [{ label: "Sign in", href: "/login" }, { label: "Sign up", href: "/signup" }, { label: "Dashboard", href: "/dashboard" }],
              },
            ].map((col) => (
              <div key={col.heading}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: "#CBD5E1" }}>
                  {col.heading}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="text-[13px] font-medium transition-colors" style={{ color: "#64748B" }}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3"
            style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}
          >
            <p className="text-[11px] font-medium" style={{ color: "#94A3B8" }}>
              © {new Date().getFullYear()} AutoCDP. Built for automotive retail.
            </p>
            <div className="flex items-center gap-2">
              <span className="chip chip-emerald text-[10px]">SOC 2 Type II (in progress)</span>
              <span className="chip chip-indigo text-[10px]">CCPA compliant</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
