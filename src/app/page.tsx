import Link from "next/link";
import {
  Car, BarChart3, Mail, Bot, Shield, Zap, TrendingUp,
  CheckCircle, ArrowRight, Star, Cpu, Target, Database,
  Sparkles,
} from "lucide-react";

export const metadata = {
  title: "AutoCDP — AI-Powered Dealership CRM",
  description: "Autonomous direct mail, self-learning AI agents, and real-time customer intelligence built for modern dealership groups.",
};

// ── Feature definitions ────────────────────────────────────────
const features = [
  {
    icon: Bot,
    title: "5-Agent AI Swarm",
    desc: "Orchestrator, Data, Targeting, Creative, and Optimization agents work in parallel — no prompts, no babysitting.",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    glowClass: "feature-card-indigo",
    accent: "indigo",
  },
  {
    icon: Mail,
    title: "Native Direct Mail",
    desc: "PostGrid-powered postcards and letters with QR tracking, personalized per customer, fulfilled automatically.",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    glowClass: "feature-card-sky",
    accent: "sky",
  },
  {
    icon: TrendingUp,
    title: "Self-Learning Optimization",
    desc: "Every campaign result trains the next one. Response patterns improve across your entire fleet over time.",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    glowClass: "feature-card-amber",
    accent: "amber",
  },
  {
    icon: BarChart3,
    title: "Last-Visit Memory",
    desc: "Knows exactly what each customer drove in for, what they spent, and when they're likely to return.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    glowClass: "feature-card-emerald",
    accent: "emerald",
  },
  {
    icon: Zap,
    title: "DMS Integration",
    desc: "CDK Fortellis and Reynolds & Reynolds sync automatically. Customer, RO, and inventory data — always current.",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    glowClass: "feature-card-violet",
    accent: "violet",
  },
  {
    icon: Shield,
    title: "Hybrid Pricing",
    desc: "Pay for what you use. No per-seat licenses. Scale up during conquest campaigns, scale down in slow months.",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    glowClass: "feature-card-rose",
    accent: "rose",
  },
];

// ── How it works steps ─────────────────────────────────────────
const steps = [
  {
    step: "01",
    icon: Database,
    title: "Connect your DMS",
    desc: "OAuth or API key. CDK Fortellis and Reynolds sync automatically every 30–60 minutes. No CSV exports, no manual uploads.",
  },
  {
    step: "02",
    icon: Target,
    title: "Set a campaign goal",
    desc: "\"Win back service customers lapsed 6–12 months.\" Plain language. The AI handles the rest — audience selection, copy, fulfillment.",
  },
  {
    step: "03",
    icon: Cpu,
    title: "Agents do the work",
    desc: "Data → Targeting → Creative → Mail house. Personalized per customer, tracked by QR code, optimized after each run.",
  },
];

// ── Differentiators ────────────────────────────────────────────
const differentiators = [
  "Direct mail fulfilled, tracked, and optimized — no vendor wrangling",
  "AI agents re-run after every DMS sync, not on a monthly schedule",
  "Global learnings shared across the platform improve every dealer",
  "RLS-enforced data isolation — your customer data never crosses dealership lines",
];

// ── Testimonials ───────────────────────────────────────────────
const testimonials = [
  {
    quote: "We replaced three separate vendors — mail house, CRM, and reporting — with AutoCDP. Our service lane retention is up 18% in 90 days.",
    name: "Bryant M.",
    title: "Fixed Ops Director, Multi-Rooftop Group",
    initials: "BM",
    stat: "+18%",
    statLabel: "retention in 90 days",
    statColor: "text-emerald-600",
  },
  {
    quote: "The AI writes better win-back copy than our ad agency did. And it sends automatically the moment a customer goes lapsed.",
    name: "Jake R.",
    title: "General Manager, Franchise Dealership",
    initials: "JR",
    stat: "3×",
    statLabel: "mail response rate",
    statColor: "text-indigo-600",
  },
];

// ── Stats bar ──────────────────────────────────────────────────
const stats = [
  { value: "18%", label: "Avg. retention lift" },
  { value: "3×",  label: "Mail response vs. generic" },
  { value: "< 2h", label: "Time to first campaign" },
  { value: "0",   label: "Manual steps per send" },
];

// ── Hero dashboard mockup data ─────────────────────────────────
const mockStats = [
  { label: "Sent (30d)", value: "2,847", bg: "bg-white", labelColor: "text-slate-400", valColor: "text-slate-900" },
  { label: "Scan Rate",  value: "18.3%", bg: "bg-emerald-50", labelColor: "text-emerald-600", valColor: "text-emerald-700" },
  { label: "Converted",  value: "127",   bg: "bg-indigo-50",  labelColor: "text-indigo-600",  valColor: "text-indigo-700" },
];

const mockAgents = [
  { name: "Data Agent",  status: "Complete", state: "done" },
  { name: "Targeting",   status: "Running",  state: "running" },
  { name: "Creative",    status: "Queued",   state: "idle" },
];

const mockCampaigns = [
  { name: "VIP Win-back Q2",      pct: 84, sent: "1,243" },
  { name: "Service Due — May",    pct: 61, sent: "892" },
  { name: "Conquest — Zip 48304", pct: 37, sent: "504" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Sticky Nav ──────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-slate-200/70 bg-white/92 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center shadow-sm">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">AutoCDP</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-500">
            <a href="#features"     className="hover:text-slate-900 transition-colors duration-150">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors duration-150">How it works</a>
            <a href="#results"      className="hover:text-slate-900 transition-colors duration-150">Results</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 px-5 sm:px-8 overflow-hidden">
        {/* Background radial + grid */}
        <div className="absolute inset-0 hero-grid opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.07),transparent)]" />
        <div className="absolute top-16 right-0 w-[700px] h-[500px] bg-indigo-100/25 rounded-full blur-3xl -translate-y-1/4 translate-x-1/4 pointer-events-none" />
        <div className="absolute top-48 left-0 w-[450px] h-[400px] bg-emerald-100/15 rounded-full blur-3xl -translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 xl:gap-20 items-center">

            {/* Left — headline + CTAs */}
            <div className="stagger-1">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-8 uppercase tracking-wider">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                CDK Fortellis + Reynolds Integration Live
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-bold text-slate-900 leading-[1.08] tracking-tight mb-5 sm:mb-6">
                The CRM that
                <br />
                <span className="gradient-text">markets itself.</span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-500 leading-relaxed mb-8 sm:mb-10 max-w-lg">
                AutoCDP runs AI agents across your customer data, writes personalized campaigns, and drops physical mail in the mailbox — automatically, after every DMS sync.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Link
                  href="/signup"
                  className="btn-press inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200/60 active:scale-[0.98]"
                >
                  Start free trial <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="btn-press inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-base hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  Request a demo
                </Link>
              </div>
              <p className="text-xs text-slate-400">No credit card required · Setup in under 2 hours · Cancel anytime</p>
            </div>

            {/* Right — animated dashboard mockup */}
            <div className="relative hidden lg:block stagger-2">
              {/* Outer glow */}
              <div className="absolute -inset-8 bg-indigo-500/6 rounded-3xl blur-2xl" />

              {/* Floating card with animation */}
              <div className="relative animate-float">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_24px_64px_-12px_rgb(15_23_42/0.18)] overflow-hidden">

                  {/* Titlebar */}
                  <div className="bg-navy-900 px-4 py-3 flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                      <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                      <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-5 bg-white/8 rounded-md" />
                    </div>
                    <span className="text-white/35 text-[10px] font-mono">AutoCDP · Dashboard</span>
                  </div>

                  <div className="p-5 bg-slate-50 space-y-4">

                    {/* Stat cards */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {mockStats.map((s) => (
                        <div key={s.label} className={`${s.bg} rounded-xl border border-slate-100 p-3 shadow-sm`}>
                          <p className={`text-[9px] font-semibold uppercase tracking-wider ${s.labelColor}`}>{s.label}</p>
                          <p className={`text-xl font-bold mt-0.5 ${s.valColor}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* AI Agent swarm status */}
                    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-violet-500" />
                          <p className="text-[11px] font-semibold text-slate-700">AI Agent Swarm</p>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wide">
                          Running
                        </span>
                      </div>
                      <div className="space-y-2">
                        {mockAgents.map((a) => (
                          <div key={a.name} className="flex items-center gap-2.5">
                            {/* Status indicator */}
                            {a.state === "running" ? (
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                              </span>
                            ) : a.state === "done" ? (
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                              </span>
                            ) : (
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-300" />
                              </span>
                            )}
                            <span className="text-[11px] text-slate-600 flex-1">{a.name}</span>
                            <span className={`text-[9px] font-medium ${a.state === "done" ? "text-emerald-600" : a.state === "running" ? "text-indigo-600" : "text-slate-400"}`}>
                              {a.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent campaigns */}
                    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold text-slate-700 mb-3">Recent Campaigns</p>
                      <div className="space-y-2.5">
                        {mockCampaigns.map((c) => (
                          <div key={c.name} className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-500 flex-1 truncate">{c.name}</span>
                            <span className="text-[9px] text-slate-400 tabular-nums">{c.sent}</span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${c.pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-6 animate-float" style={{ animationDelay: "0.5s" }}>
                <div className="bg-white rounded-xl border border-slate-200 shadow-card-md px-4 py-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Last campaign</p>
                    <p className="text-xs font-semibold text-slate-900">127 converted ↑</p>
                  </div>
                </div>
              </div>

              {/* Floating badge 2 */}
              <div className="absolute -top-4 -right-4 animate-float" style={{ animationDelay: "1s" }}>
                <div className="bg-white rounded-xl border border-slate-200 shadow-card-md px-4 py-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">AI agents</p>
                    <p className="text-xs font-semibold text-slate-900">3 of 5 running</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50/80 py-12 px-5 sm:px-8">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={s.label} className={`text-center py-2 ${i < 3 ? "md:border-r border-slate-200" : ""}`}>
              <div className="text-3xl font-bold text-slate-900 tracking-tight stat-number">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 section-enter">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold mb-5 uppercase tracking-wider">
              Platform Features
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
                className={`feature-card ${f.glowClass} p-7 rounded-2xl border border-slate-200 bg-white cursor-default stagger-${Math.min(i + 1, 6)}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${f.iconBg} transition-transform duration-200 group-hover:scale-110`}>
                  <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <h3 className="font-semibold text-slate-900 text-base mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-5 sm:px-8 bg-navy-900 relative overflow-hidden">
        <div className="absolute inset-0 dark-grid" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/70 text-xs font-semibold mb-5 uppercase tracking-wider">
              How It Works
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Connect. Set a goal. Ship.
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              The AI swarm handles everything from audience selection to physical mail fulfillment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {steps.map((s, i) => (
              <div
                key={s.step}
                className="card-lift p-7 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/20 transition-colors"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-white/60" />
                  </div>
                  <span className="text-3xl font-bold text-white/12 font-mono">{s.step}</span>
                </div>
                <h3 className="font-semibold text-white text-base mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-7 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <p className="text-white font-semibold text-sm">
                Key differentiators vs. Fullpath, CDK, and legacy DMS platforms
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {differentiators.map((d) => (
                <div key={d} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300 leading-relaxed">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────── */}
      <section id="results" className="py-24 px-5 sm:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold mb-5 uppercase tracking-wider">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              Real Results
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-3">
              Real results from real dealers
            </h2>
            <p className="text-slate-500 text-lg">Not projections. Actual outcomes from pilot dealerships.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="card-lift p-8 rounded-2xl border border-slate-200 bg-white shadow-card-md"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${t.statColor}`}>{t.stat}</div>
                    <div className="text-[11px] text-slate-400">{t.statLabel}</div>
                  </div>
                </div>
                <blockquote className="text-slate-700 leading-relaxed mb-7 text-[15px]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-navy-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="py-24 px-5 sm:px-8 bg-navy-900 relative overflow-hidden">
        <div className="absolute inset-0 dark-grid" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            Ready to run your first AI campaign?
          </h2>
          <p className="text-lg text-slate-400 mb-10 leading-relaxed">
            Most dealerships launch their first campaign within two hours of connecting their DMS.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/40"
            >
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-white/20 bg-white/5 text-white font-semibold text-base hover:bg-white/10 transition-all"
            >
              Sign in to dashboard
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-500">No credit card required. No setup fee. Cancel anytime.</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-8 px-5 sm:px-8 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-navy-900 flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm tracking-tight">AutoCDP</span>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} AutoCDP. Built for automotive retail.
          </p>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <Link href="/login" className="hover:text-slate-800 transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-slate-800 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
