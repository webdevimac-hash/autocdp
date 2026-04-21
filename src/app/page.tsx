import Link from "next/link";
import {
  Car, BarChart3, Mail, Bot, Shield, Zap, TrendingUp,
  CheckCircle, ArrowRight, Star, Cpu, Target, Database,
  Sparkles, Users, ArrowUpRight, Activity, CheckCircle2,
  Megaphone, ScanLine, MessageSquare,
} from "lucide-react";

export const metadata = {
  title: "AutoCDP — The CRM That Markets Itself",
  description: "AI agents that autonomously run dealership marketing. Personalized direct mail, SMS, and email — fulfilled and optimized after every DMS sync.",
};

// ── Feature cards ─────────────────────────────────────────────

const features = [
  {
    icon: Bot,
    title: "5-Agent AI Swarm",
    desc: "Orchestrator, Data, Targeting, Creative, and Optimization agents work in parallel — no prompts, no babysitting, no vendor wrangling.",
    iconBg: "bg-indigo-50", iconColor: "text-indigo-600", glowClass: "feature-card-indigo",
    stat: "5 agents", statLabel: "always running",
  },
  {
    icon: Mail,
    title: "Native Direct Mail",
    desc: "PostGrid-powered postcards and letters with QR tracking. Personalized per customer, printed, and fulfilled automatically.",
    iconBg: "bg-sky-50", iconColor: "text-sky-600", glowClass: "feature-card-sky",
    stat: "< $1.60", statLabel: "per piece",
  },
  {
    icon: TrendingUp,
    title: "Self-Learning Optimization",
    desc: "Every campaign result trains the next one. Response patterns improve across your entire customer base over time.",
    iconBg: "bg-amber-50", iconColor: "text-amber-600", glowClass: "feature-card-amber",
    stat: "3×", statLabel: "response rate",
  },
  {
    icon: Database,
    title: "Last-Visit Memory",
    desc: "Knows exactly what each customer drove in for, what they spent, and when they're likely to return — updated every sync.",
    iconBg: "bg-emerald-50", iconColor: "text-emerald-600", glowClass: "feature-card-emerald",
    stat: "360°", statLabel: "customer view",
  },
  {
    icon: Zap,
    title: "DMS Integration",
    desc: "CDK Fortellis and Reynolds & Reynolds sync automatically. Customer, RO, and inventory data — always current, zero exports.",
    iconBg: "bg-violet-50", iconColor: "text-violet-600", glowClass: "feature-card-violet",
    stat: "30 min", statLabel: "sync interval",
  },
  {
    icon: Shield,
    title: "Hybrid Pricing",
    desc: "Pay for what you send. No per-seat licenses, no long-term contracts. Scale up during conquest, scale down in slow months.",
    iconBg: "bg-rose-50", iconColor: "text-rose-600", glowClass: "feature-card-rose",
    stat: "$0", statLabel: "setup fee",
  },
];

// ── How it works ──────────────────────────────────────────────

const steps = [
  {
    step: "01", icon: Database,
    title: "Connect your DMS",
    desc: "OAuth or API key. CDK Fortellis and Reynolds sync automatically every 30–60 minutes. No CSV exports, no manual uploads.",
  },
  {
    step: "02", icon: Target,
    title: "Set a campaign goal",
    desc: "\"Win back service customers lapsed 6–12 months.\" Plain language. The AI handles audience selection, copy, and fulfillment.",
  },
  {
    step: "03", icon: Cpu,
    title: "Agents do the work",
    desc: "Data → Targeting → Creative → Mail house. Personalized per customer, tracked by QR code, optimized after every campaign.",
  },
];

const differentiators = [
  "Direct mail fulfilled, tracked, and optimized — no vendor wrangling",
  "AI agents re-run after every DMS sync, not on a monthly schedule",
  "Global learnings shared across the platform improve every dealer",
  "RLS-enforced data isolation — your data never crosses dealership lines",
];

// ── Testimonials ──────────────────────────────────────────────

const testimonials = [
  {
    quote: "We replaced three separate vendors — mail house, CRM, and reporting — with AutoCDP. Our service lane retention is up 18% in 90 days.",
    name: "Bryant M.", title: "Fixed Ops Director, Multi-Rooftop Group",
    initials: "BM", stat: "+18%", statLabel: "retention lift", statColor: "text-emerald-600",
    statBg: "bg-emerald-50",
  },
  {
    quote: "The AI writes better win-back copy than our ad agency did. And it sends automatically the moment a customer goes lapsed. Set it and forget it.",
    name: "Jake R.", title: "General Manager, Franchise Dealership",
    initials: "JR", stat: "3×", statLabel: "mail response rate", statColor: "text-indigo-600",
    statBg: "bg-indigo-50",
  },
];

// ── Stats ─────────────────────────────────────────────────────

const stats = [
  { value: "18%",  label: "Avg. retention lift",       icon: TrendingUp,  color: "text-emerald-600", bg: "bg-emerald-50" },
  { value: "3×",   label: "Mail response vs. generic", icon: Mail,        color: "text-indigo-600",  bg: "bg-indigo-50" },
  { value: "< 2h", label: "Time to first campaign",    icon: Zap,         color: "text-amber-600",   bg: "bg-amber-50" },
  { value: "0",    label: "Manual steps per send",     icon: CheckCircle, color: "text-violet-600",  bg: "bg-violet-50" },
];

// ── Dashboard mockup data ─────────────────────────────────────

const mockAgents = [
  { name: "Orchestrator", state: "done",    model: "opus-4.7",   dot: "bg-emerald-500" },
  { name: "Data Agent",   state: "done",    model: "sonnet-4.6", dot: "bg-emerald-500" },
  { name: "Targeting",    state: "running", model: "sonnet-4.6", dot: "bg-indigo-500 animate-pulse" },
  { name: "Creative",     state: "running", model: "sonnet-4.6", dot: "bg-indigo-500 animate-pulse" },
  { name: "Optimization", state: "idle",    model: "sonnet-4.6", dot: "bg-slate-300" },
];

const mockStats = [
  { label: "Sent (30d)", value: "2,847", leftBorder: "#6366F1", accent: "#4338CA" },
  { label: "Scan Rate",  value: "18.3%", leftBorder: "#10B981", accent: "#047857" },
  { label: "Conv.",      value: "127",   leftBorder: "#8B5CF6", accent: "#6D28D9" },
  { label: "Revenue",    value: "$84k",  leftBorder: "#F59E0B", accent: "#B45309" },
];

const mockCampaigns = [
  { name: "VIP Win-back Q2",      status: "active",    pct: 84, sent: "1,243", dotColor: "#10B981" },
  { name: "Service Due — May",    status: "active",    pct: 61, sent: "892",   dotColor: "#6366F1" },
  { name: "Conquest — Zip 48304", status: "scheduled", pct: 37, sent: "504",   dotColor: "#0EA5E9" },
];

const integrations = [
  { name: "CDK Fortellis",         abbr: "CDK" },
  { name: "Reynolds & Reynolds",   abbr: "R&R" },
  { name: "PostGrid",              abbr: "PG" },
  { name: "Anthropic Claude",      abbr: "AI" },
  { name: "Twilio",                abbr: "SMS" },
  { name: "Resend",                abbr: "Email" },
  { name: "USPS",                  abbr: "USPS" },
  { name: "Stripe",                abbr: "Pay" },
];

// ── Page ──────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Announcement bar ──────────────────────────────── */}
      <div className="relative overflow-hidden py-2.5 px-4 text-center" style={{ background: "#0B1526" }}>
        <div className="flex items-center justify-center gap-2.5 text-xs font-semibold">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-white/70">New:</span>
          <span className="text-white">CDK Fortellis &amp; Reynolds native integration now live</span>
          <Link href="/signup" className="hidden sm:inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors ml-1">
            Get access <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{ background: "#0B1526" }}>
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-[17px] tracking-tight">AutoCDP</span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {["Features", "How it works", "Results"].map((item, i) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
              >
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:block text-[13px] font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all">
              Sign in
            </Link>
            <Link href="/signup" className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 transition-colors shadow-[0_1px_3px_0_rgb(79_70_229/0.30)]">
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 px-5 sm:px-8 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 hero-grid opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.07),transparent)]" />
        <div className="absolute top-16 right-0 w-[700px] h-[600px] bg-indigo-100/20 rounded-full blur-3xl translate-x-1/3 pointer-events-none" />
        <div className="absolute top-40 left-0 w-[500px] h-[400px] bg-emerald-100/15 rounded-full blur-3xl -translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-14 xl:gap-20 items-center">

            {/* ── Left: Copy ─────────────────────────────── */}
            <div className="stagger-1 max-w-xl xl:max-w-none">
              {/* Trust badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-bold mb-7 uppercase tracking-widest shadow-sm">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live in dealerships today
              </div>

              <h1 className="text-[2.6rem] sm:text-[3.2rem] xl:text-[3.6rem] font-bold text-slate-900 leading-[1.06] tracking-tight mb-6">
                The CRM that
                <br />
                <span className="gradient-text">markets itself.</span>
              </h1>

              <p className="text-[17px] sm:text-lg text-slate-500 leading-relaxed mb-8 max-w-lg">
                AutoCDP runs AI agents across your customer data, writes personalized campaigns, and drops physical mail in the mailbox —{" "}
                <span className="text-slate-700 font-medium">automatically, after every DMS sync.</span>
              </p>

              {/* CTA row */}
              <div className="flex flex-col sm:flex-row gap-3 mb-7">
                <Link
                  href="/signup"
                  className="btn-press inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-700 transition-all shadow-[0_4px_20px_-4px_rgb(79_70_229/0.55)] active:scale-[0.98]"
                >
                  Start free trial <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="btn-press inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-base hover:bg-slate-50 hover:border-slate-300 transition-all shadow-card"
                >
                  Request a demo
                </Link>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 font-medium mb-8">
                {[
                  "No credit card required",
                  "Setup in under 2 hours",
                  "Cancel anytime",
                ].map((t, i) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {t}
                  </span>
                ))}
              </div>

              {/* Social proof strip */}
              <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                <div className="flex -space-x-2">
                  {["BM", "JR", "KP", "SR", "DL"].map((i, idx) => (
                    <div
                      key={idx}
                      className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white ring-1 ring-slate-200/50"
                      style={{ background: ["#0B1526","#6366F1","#10B981","#8B5CF6","#F59E0B"][idx] }}
                    >
                      {i}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Trusted by <span className="text-slate-800 font-semibold">40+ dealerships</span> in pilot
                  </p>
                </div>
              </div>
            </div>

            {/* ── Right: Dashboard mockup ────────────────── */}
            <div className="relative hidden xl:block stagger-2">
              {/* Outer glow */}
              <div className="absolute -inset-8 rounded-3xl opacity-60" style={{ background: "radial-gradient(ellipse at 60% 40%, rgba(99,102,241,0.10), transparent 70%)" }} />

              {/* Main mockup window */}
              <div className="relative animate-float">
                <div className="rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgb(15_23_42/0.22),0_4px_16px_-4px_rgb(15_23_42/0.08)] border border-slate-200/80">

                  {/* Browser titlebar */}
                  <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: "#060D18" }}>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                    </div>
                    <div className="flex-1 mx-2">
                      <div className="flex items-center gap-1.5 bg-white/8 rounded-md px-3 py-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-white/20 flex-shrink-0" />
                        <span className="text-[9px] font-mono text-white/40 flex-1">app.autocdp.com/dashboard</span>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[8px] text-white/30">secure</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-semibold text-white/25 tracking-wider">AutoCDP</span>
                  </div>

                  {/* App shell */}
                  <div className="flex" style={{ background: "#F3F6FA", minHeight: 360 }}>

                    {/* ── Mini sidebar ─── */}
                    <div className="w-[130px] shrink-0 flex flex-col" style={{ background: "#0B1526" }}>
                      {/* Logo */}
                      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/6">
                        <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center">
                          <Car className="w-2.5 h-2.5 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-white/90">AutoCDP</span>
                      </div>

                      {/* Nav groups */}
                      <div className="p-2 flex-1 space-y-0.5">
                        <div className="px-2 pt-1 pb-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-white/20">Core</div>
                        {[
                          { label: "Dashboard", active: true },
                          { label: "Customers", active: false },
                          { label: "Campaigns", active: false },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[9px] font-medium relative"
                            style={{
                              color: item.active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.38)",
                              background: item.active ? "rgba(255,255,255,0.10)" : undefined,
                            }}
                          >
                            {item.active && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-3.5 bg-emerald-400 rounded-r" />
                            )}
                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: "rgba(255,255,255,0.18)" }} />
                            {item.label}
                          </div>
                        ))}
                        <div className="px-2 pt-2 pb-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-white/20">Channels</div>
                        {["Direct Mail", "Analytics", "AI Agents"].map((label) => (
                          <div key={label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[9px]" style={{ color: "rgba(255,255,255,0.30)" }}>
                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: "rgba(255,255,255,0.10)" }} />
                            {label}
                          </div>
                        ))}
                      </div>

                      {/* Bottom user */}
                      <div className="p-2 border-t border-white/6">
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md">
                          <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[6px] font-bold">BM</div>
                          <span className="text-[8px] text-white/40">Bryant M.</span>
                        </div>
                      </div>
                    </div>

                    {/* ── Main content ─── */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-white/90 border-b border-slate-200/60">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-900">Dashboard</p>
                          <p className="text-[8px] text-slate-400">Your dealership at a glance</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 h-5 px-2 bg-slate-100 rounded-md">
                            <div className="w-2 h-2 rounded-sm bg-slate-300" />
                            <span className="text-[8px] text-slate-400">Search…</span>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[7px] font-bold text-indigo-700">BM</div>
                        </div>
                      </div>

                      <div className="flex-1 p-3 space-y-2.5 overflow-hidden">
                        {/* ── Stat cards ── */}
                        <div className="grid grid-cols-4 gap-1.5">
                          {mockStats.map((s) => (
                            <div
                              key={s.label}
                              className="bg-white rounded-lg border border-slate-200/80 p-2 shadow-sm relative overflow-hidden"
                            >
                              <div
                                className="absolute left-0 top-0 bottom-0 w-[2.5px] rounded-l"
                                style={{ background: s.leftBorder }}
                              />
                              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                              <p className="text-[13px] font-bold mt-0.5 tabular-nums" style={{ color: s.accent }}>{s.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* ── Bottom grid ── */}
                        <div className="grid grid-cols-5 gap-1.5">
                          {/* Campaign list — 3 cols */}
                          <div className="col-span-3 bg-white rounded-lg border border-slate-200/80 overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 bg-slate-50/60">
                              <div className="flex items-center gap-1">
                                <Megaphone className="w-2.5 h-2.5 text-slate-400" />
                                <p className="text-[8px] font-bold text-slate-700">Active Campaigns</p>
                              </div>
                              <span className="text-[7px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">3 running</span>
                            </div>
                            <div className="p-2 space-y-1.5">
                              {mockCampaigns.map((c) => (
                                <div key={c.name}>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <div className="flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dotColor }} />
                                      <span className="text-[8px] text-slate-700 font-medium truncate max-w-[100px]">{c.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[7px] text-slate-400 tabular-nums">{c.sent}</span>
                                      <span className="text-[7px] font-bold tabular-nums" style={{ color: c.dotColor }}>{c.pct}%</span>
                                    </div>
                                  </div>
                                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: c.dotColor }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Agent swarm — 2 cols */}
                          <div className="col-span-2 bg-white rounded-lg border border-slate-200/80 overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 bg-slate-50/60">
                              <div className="flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5 text-violet-500" />
                                <p className="text-[8px] font-bold text-slate-700">AI Agents</p>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[7px] font-bold text-indigo-600">LIVE</span>
                              </div>
                            </div>
                            <div className="p-2 space-y-1">
                              {mockAgents.map((a) => (
                                <div key={a.name} className="flex items-center gap-1.5 py-0.5">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.dot}`} />
                                  <span className="text-[8px] text-slate-600 flex-1 truncate">{a.name}</span>
                                  <span className={`text-[7px] font-semibold ${
                                    a.state === "done" ? "text-emerald-600" :
                                    a.state === "running" ? "text-indigo-600" :
                                    "text-slate-400"
                                  }`}>
                                    {a.state === "done" ? "✓" : a.state === "running" ? "…" : "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* Mini live feed */}
                            <div className="mx-2 mb-2 p-1.5 rounded bg-indigo-50/80 border border-indigo-100">
                              <p className="text-[7px] text-indigo-700 font-medium leading-relaxed">
                                Writing copy for James C. — 2021 Tacoma, lapsed 8mo
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* ── Live activity ticker ── */}
                        <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5 flex items-center gap-2 shadow-sm overflow-hidden">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                          <div className="flex items-center gap-3 text-[8px] text-slate-500 overflow-hidden">
                            <span className="font-semibold text-emerald-700">↑ 3 mail pieces sent</span>
                            <span className="text-slate-300">·</span>
                            <span>QR scan: James C. (Scottsdale)</span>
                            <span className="text-slate-300">·</span>
                            <span>VIP Win-back: 127 conversions</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Floating badge 1: conversions ──────────── */}
                <div className="absolute -bottom-5 -left-8 animate-float-delayed">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_24px_-4px_rgb(15_23_42/0.12)] px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Last campaign</p>
                      <p className="text-[13px] font-bold text-slate-900 tracking-tight">127 conversions ↑</p>
                    </div>
                  </div>
                </div>

                {/* ── Floating badge 2: QR scan ──────────────── */}
                <div className="absolute -top-5 -right-6 animate-float-slow">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_24px_-4px_rgb(15_23_42/0.12)] px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <ScanLine className="w-4.5 h-4.5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">QR scan received</p>
                      <p className="text-[13px] font-bold text-slate-900 tracking-tight">James C. — 2m ago</p>
                    </div>
                  </div>
                </div>

                {/* ── Floating badge 3: mail sent ────────────── */}
                <div className="absolute top-1/2 -right-12 translate-y-4 animate-float" style={{ animationDelay: "0.8s" }}>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_24px_-4px_rgb(15_23_42/0.12)] px-4 py-2.5 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      <Mail className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-medium">PostGrid</p>
                      <p className="text-[11px] font-bold text-slate-900">Mail sent ✓</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Integration logos ──────────────────────────────── */}
      <div className="border-y border-slate-100 bg-slate-50/60 py-7 px-5 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6">
            Works with your existing stack
          </p>
          <div className="overflow-hidden relative">
            <div className="absolute left-0 inset-y-0 w-20 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 inset-y-0 w-20 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none" />
            <div className="flex ticker-track gap-12 items-center whitespace-nowrap">
              {[...integrations, ...integrations].map((intg, i) => (
                <div key={i} className="flex items-center gap-2.5 shrink-0 group">
                  <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <span className="text-[8px] font-black text-slate-500">{intg.abbr}</span>
                  </div>
                  <span className="text-[13px] font-semibold text-slate-400 group-hover:text-slate-700 transition-colors">{intg.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────── */}
      <section className="py-16 px-5 sm:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="feature-card bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-card"
                style={{ ['--feature-glow' as string]: "rgba(99,102,241,0.12)" }}
              >
                <div className={`w-10 h-10 rounded-xl mx-auto mb-4 flex items-center justify-center ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="text-[2rem] font-black text-slate-900 tracking-tight leading-none stat-number">{s.value}</div>
                <div className="text-[12px] text-slate-500 mt-2 font-medium leading-snug">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" className="py-24 px-5 sm:px-8" style={{ background: "#F8FAFC" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 section-enter">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-bold mb-5 uppercase tracking-widest">
              Platform capabilities
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4">
              Everything in one platform
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
              Built specifically for auto dealership groups that want AI-driven marketing without stitching together five different vendors.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`feature-card ${f.glowClass} group p-7 rounded-2xl border border-slate-200 bg-white shadow-card stagger-${Math.min(i + 1, 6)}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${f.iconBg} group-hover:scale-110 transition-transform duration-200`}>
                  <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <h3 className="font-semibold text-slate-900 text-[15px] mb-2 tracking-tight">{f.title}</h3>
                <p className="text-[13px] text-slate-500 leading-relaxed mb-5">{f.desc}</p>
                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <span className="text-[17px] font-bold text-slate-900 tracking-tight">{f.stat}</span>
                  <span className="text-[11px] text-slate-400 font-medium">{f.statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-5 sm:px-8 relative overflow-hidden" style={{ background: "#0B1526" }}>
        <div className="absolute inset-0 dark-grid" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[320px] rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)" }} />

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/4 text-white/50 text-[11px] font-bold mb-5 uppercase tracking-widest">
              How It Works
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Connect. Set a goal. Ship.
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium leading-relaxed">
              The AI swarm handles everything from audience selection to physical mail fulfillment.
            </p>
          </div>

          {/* Steps with connecting line */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative mb-6">
            {/* Connector line */}
            <div className="hidden md:block absolute top-[52px] left-[calc(33%+2rem)] right-[calc(33%+2rem)] h-[1px] bg-gradient-to-r from-white/10 via-indigo-500/30 to-white/10" />

            {steps.map((s, i) => (
              <div
                key={s.step}
                className="relative p-7 rounded-2xl border border-white/8 hover:border-white/15 hover:bg-white/4 transition-all duration-200 group"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                    style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}
                  >
                    <s.icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span
                    className="text-[32px] font-black tabular-nums leading-none"
                    style={{ color: "rgba(255,255,255,0.06)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {s.step}
                  </span>
                </div>
                <h3 className="font-semibold text-white text-[15px] mb-2 tracking-tight">{s.title}</h3>
                <p className="text-[13px] text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Differentiator callout */}
          <div
            className="p-7 rounded-2xl border border-white/8"
            style={{ background: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.15)" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-white font-semibold text-[14px]">
                Key differentiators vs. Fullpath, CDK, and legacy DMS platforms
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {differentiators.map((d) => (
                <div key={d} className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center mt-0.5 shrink-0" style={{ background: "rgba(16,185,129,0.15)" }}>
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                  </div>
                  <span className="text-[13px] text-slate-300 leading-relaxed">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────── */}
      <section id="results" className="py-24 px-5 sm:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[11px] font-bold mb-5 uppercase tracking-widest">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Real Results
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-3">
              Real results from real dealers
            </h2>
            <p className="text-slate-500 text-[17px] font-medium">Not projections. Actual outcomes from pilot dealerships.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="card-lift p-8 rounded-2xl border border-slate-200 bg-white shadow-card group">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <div className={`text-right px-4 py-2 rounded-xl ${t.statBg}`}>
                    <div className={`text-2xl font-black tracking-tight ${t.statColor}`}>{t.stat}</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{t.statLabel}</div>
                  </div>
                </div>

                <blockquote className="text-slate-700 leading-relaxed mb-7 text-[15px] italic">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ring-white"
                    style={{ background: "#0B1526" }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">{t.name}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{t.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mini comparison table */}
          <div className="mt-10 p-7 rounded-2xl border border-slate-200 bg-slate-50/60">
            <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-5">AutoCDP vs. traditional approaches</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              {[
                {
                  label: "Legacy Mail House",
                  items: ["Manual list pulls", "Generic copy", "No tracking", "30-day campaigns"],
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
              ].map((col) => (
                <div key={col.label} className={`px-6 py-4 first:rounded-l-xl last:rounded-r-xl ${col.ok ? "bg-indigo-50/80 border-indigo-200" : ""}`}>
                  <p className={`text-[11px] font-bold uppercase tracking-wide mb-4 ${col.ok ? "text-indigo-600" : "text-slate-500"}`}>
                    {col.label}
                  </p>
                  <ul className="space-y-2">
                    {col.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[12px]">
                        {col.ok ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 shrink-0" />
                        )}
                        <span className={col.ok ? "text-slate-700 font-medium" : "text-slate-400"}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="py-24 px-5 sm:px-8 relative overflow-hidden" style={{ background: "#0B1526" }}>
        <div className="absolute inset-0 dark-grid" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)" }} />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/4 text-white/50 text-[11px] font-bold mb-7 uppercase tracking-widest">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Ready when you are
          </div>

          <h2 className="text-3xl sm:text-[2.6rem] font-bold text-white tracking-tight mb-4 leading-tight">
            Ready to run your first
            <br />AI campaign?
          </h2>
          <p className="text-[17px] text-slate-400 mb-10 leading-relaxed font-medium max-w-xl mx-auto">
            Most dealerships launch their first campaign within two hours of connecting their DMS.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link
              href="/signup"
              className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 transition-all shadow-[0_8px_32px_-8px_rgb(79_70_229/0.65)]"
            >
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-white/15 text-white font-semibold text-base hover:border-white/25 hover:bg-white/6 transition-all"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              Request a demo <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          {/* What's included */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-slate-500 font-medium">
            {[
              "14-day free trial",
              "No credit card",
              "Full feature access",
              "Cancel anytime",
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          {/* Top row */}
          <div className="py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#0B1526" }}>
                  <Car className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-slate-900 text-[15px] tracking-tight">AutoCDP</span>
              </div>
              <p className="text-[13px] text-slate-400 leading-relaxed max-w-[200px]">
                AI-powered marketing for modern dealership groups.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Product</p>
              <ul className="space-y-2.5">
                {["Features", "How it works", "Pricing", "Security"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors font-medium">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Integrations</p>
              <ul className="space-y-2.5">
                {["CDK Fortellis", "Reynolds & Reynolds", "PostGrid", "Twilio"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors font-medium">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Account</p>
              <ul className="space-y-2.5">
                {[
                  { label: "Sign in", href: "/login" },
                  { label: "Sign up", href: "/signup" },
                  { label: "Dashboard", href: "/dashboard" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors font-medium">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="py-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400 font-medium">
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
