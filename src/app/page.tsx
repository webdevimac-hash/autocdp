import Link from "next/link";
import {
  Car, BarChart3, Mail, Bot, Shield, Zap, TrendingUp,
  CheckCircle, ArrowRight, Star, Cpu, Target, Pencil,
  Database, ScanLine,
} from "lucide-react";

export const metadata = {
  title: "AutoCDP — AI-Powered Dealership CRM",
  description: "Autonomous direct mail, self-learning AI agents, and real-time customer intelligence built for modern dealership groups.",
};

const features = [
  {
    icon: Bot,
    title: "5-Agent AI Swarm",
    desc: "Orchestrator, Data, Targeting, Creative, and Optimization agents work in parallel — no prompts, no babysitting.",
    color: "bg-indigo-50 text-indigo-600",
    border: "hover:border-indigo-200",
  },
  {
    icon: Mail,
    title: "Native Direct Mail",
    desc: "PostGrid-powered postcards and letters with QR tracking, personalized per customer, fulfilled automatically.",
    color: "bg-emerald-50 text-emerald-600",
    border: "hover:border-emerald-200",
  },
  {
    icon: TrendingUp,
    title: "Self-Learning Optimization",
    desc: "Every campaign result trains the next one. Response patterns improve across your entire fleet over time.",
    color: "bg-sky-50 text-sky-600",
    border: "hover:border-sky-200",
  },
  {
    icon: BarChart3,
    title: "Last-Visit Memory",
    desc: "Knows exactly what each customer drove in for, what they spent, and when they're likely to return.",
    color: "bg-violet-50 text-violet-600",
    border: "hover:border-violet-200",
  },
  {
    icon: Zap,
    title: "DMS Integration",
    desc: "CDK Fortellis and Reynolds & Reynolds sync automatically. Customer, RO, and inventory data — always current.",
    color: "bg-amber-50 text-amber-600",
    border: "hover:border-amber-200",
  },
  {
    icon: Shield,
    title: "Hybrid Pricing",
    desc: "Pay for what you use. No per-seat licenses. Scale up during conquest campaigns, scale down in slow months.",
    color: "bg-rose-50 text-rose-600",
    border: "hover:border-rose-200",
  },
];

const steps = [
  {
    step: "01",
    title: "Connect your DMS",
    desc: "OAuth or API key — CDK Fortellis and Reynolds sync automatically every 30–60 minutes. No CSV exports, no manual uploads.",
    icon: Database,
  },
  {
    step: "02",
    title: "Set a campaign goal",
    desc: "\"Win back service customers lapsed 6–12 months\" or \"Upsell oil change customers to tire rotation.\" Plain language.",
    icon: Target,
  },
  {
    step: "03",
    title: "Agents do the work",
    desc: "Data → Targeting → Creative → Mail house. Personalized per customer, tracked by QR code, optimized after each run.",
    icon: Cpu,
  },
];

const differentiators = [
  "Direct mail fulfilled, tracked, and optimized — no vendor wrangling",
  "AI agents re-run after every DMS sync, not on a monthly schedule",
  "Global learnings shared across the platform improve every dealer",
  "RLS-enforced data isolation — your customer data never crosses dealership lines",
];

const testimonials = [
  {
    quote: "We replaced three separate vendors — mail house, CRM, and reporting — with AutoCDP. Our service lane retention is up 18% in 90 days.",
    name: "Bryant M.",
    title: "Fixed Ops Director, Multi-Rooftop Group",
    initials: "BM",
    stat: "+18%",
    statLabel: "retention",
  },
  {
    quote: "The AI writes better win-back copy than our ad agency did. And it sends automatically the moment a customer goes lapsed.",
    name: "Jake R.",
    title: "General Manager, Franchise Dealership",
    initials: "JR",
    stat: "3×",
    statLabel: "response rate",
  },
];

const stats = [
  { value: "18%", label: "Avg. retention lift" },
  { value: "3×", label: "Mail response vs. generic" },
  { value: "< 2h", label: "Time to first campaign" },
  { value: "0", label: "Manual steps per send" },
];

// Mini mock campaign data for hero visual
const mockCampaigns = [
  { name: "VIP Win-back Q2", pct: 84, sent: 1243 },
  { name: "Service Due — May", pct: 61, sent: 892 },
  { name: "Conquest — Zip 48304", pct: 37, sent: 504 },
];

const mockAgents = [
  { name: "Data Agent", status: "Complete", dot: "bg-emerald-500" },
  { name: "Targeting", status: "Running", dot: "bg-indigo-500" },
  { name: "Creative", status: "Queued", dot: "bg-slate-300" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center shadow-sm">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">AutoCDP</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it works</a>
            <a href="#results" className="hover:text-slate-900 transition-colors">Results</a>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 px-5 sm:px-8 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.08),transparent)]" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-indigo-100/30 rounded-full blur-3xl -translate-y-1/4 translate-x-1/4" />
        <div className="absolute top-40 left-0 w-[400px] h-[400px] bg-emerald-100/20 rounded-full blur-3xl -translate-x-1/3" />

        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-8 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CDK Fortellis + Reynolds Integration Live
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.06] tracking-tight mb-6">
                The CRM that
                <br />
                <span className="text-indigo-600">markets itself.</span>
              </h1>
              <p className="text-xl text-slate-500 leading-relaxed mb-10 max-w-lg">
                AutoCDP runs AI agents across your customer data, writes personalized campaigns, and drops physical mail in the mailbox — automatically, after every DMS sync.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200/60"
                >
                  Start free trial <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-base hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  Request a demo
                </Link>
              </div>
              <p className="text-xs text-slate-400">No credit card required · Setup in under 2 hours · Cancel anytime</p>
            </div>

            {/* Right — mock dashboard */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-6 bg-indigo-500/8 rounded-3xl blur-2xl" />
              <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
                {/* Titlebar */}
                <div className="bg-navy-900 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  </div>
                  <div className="ml-2 text-white/50 text-xs font-mono">AutoCDP · Dashboard</div>
                </div>

                <div className="p-5 space-y-4 bg-slate-50">
                  {/* Stat cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Sent (30d)</p>
                      <p className="text-xl font-bold text-slate-900 mt-0.5">2,847</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3">
                      <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Scan Rate</p>
                      <p className="text-xl font-bold text-emerald-700 mt-0.5">18.3%</p>
                    </div>
                    <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-3">
                      <p className="text-[10px] text-indigo-600 uppercase tracking-wide">Converted</p>
                      <p className="text-xl font-bold text-indigo-700 mt-0.5">127</p>
                    </div>
                  </div>

                  {/* Agent status */}
                  <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-slate-700">AI Agent Swarm</p>
                      <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Running</span>
                    </div>
                    <div className="space-y-2">
                      {mockAgents.map((a) => (
                        <div key={a.name} className="flex items-center gap-2.5">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.dot}`} />
                          <span className="text-xs text-slate-600 flex-1">{a.name}</span>
                          <span className="text-[10px] text-slate-400">{a.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Campaigns */}
                  <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-slate-700 mb-3">Recent Campaigns</p>
                    <div className="space-y-2.5">
                      {mockCampaigns.map((c) => (
                        <div key={c.name} className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-500 flex-1 truncate">{c.name}</span>
                          <span className="text-[10px] text-slate-400 tabular-nums">{c.sent.toLocaleString()}</span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${c.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50 py-12 px-5 sm:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`text-center ${i !== 3 ? "md:border-r border-slate-200" : ""}`}>
              <div className="text-3xl font-bold text-slate-900 tracking-tight">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold mb-5 uppercase tracking-wider">
              Platform Features
            </div>
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-4">
              Everything in one platform
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
              Built specifically for auto dealership groups that want AI-driven marketing without stitching together five different vendors.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className={`p-7 rounded-2xl border border-slate-200 bg-white hover:shadow-card-lg transition-all duration-200 group ${f.border}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${f.color} transition-transform group-hover:scale-110 duration-200`}>
                  <f.icon className="w-5 h-5" />
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
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/70 text-xs font-semibold mb-5 uppercase tracking-wider">
              How It Works
            </div>
            <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
              Connect. Set a goal. Ship.
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              The AI swarm handles everything from audience selection to physical mail fulfillment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {steps.map((s) => (
              <div key={s.step} className="p-7 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-white/60" />
                  </div>
                  <span className="text-3xl font-bold text-white/15 font-mono">{s.step}</span>
                </div>
                <h3 className="font-semibold text-white text-base mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-7 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <p className="text-white font-semibold text-sm">Key differentiators vs. Fullpath and legacy DMS platforms</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      <section id="results" className="py-24 px-5 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold mb-5 uppercase tracking-wider">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              Real Results
            </div>
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-4">
              Real results from real dealers
            </h2>
            <p className="text-slate-500 text-lg">Not projections. Actual outcomes from pilot dealerships.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="p-8 rounded-2xl border border-slate-200 bg-white shadow-card-md hover:shadow-card-lg transition-shadow">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-600">{t.stat}</div>
                    <div className="text-xs text-slate-400">{t.statLabel}</div>
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
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            Ready to run your first AI campaign?
          </h2>
          <p className="text-lg text-slate-400 mb-10">
            Most dealerships launch their first campaign within two hours of connecting their DMS.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/40"
            >
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-white/20 bg-white/5 text-white font-semibold text-base hover:bg-white/10 transition-all"
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
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} AutoCDP. Built for automotive retail.</p>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <Link href="/login" className="hover:text-slate-800 transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-slate-800 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
