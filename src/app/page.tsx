import Link from "next/link";
import { Car, BarChart3, Mail, Bot, Shield, Zap, TrendingUp, CheckCircle, ArrowRight, Star } from "lucide-react";

export const metadata = {
  title: "AutoCDP — AI-Powered Dealership CRM",
  description: "Autonomous direct mail, self-learning AI agents, and real-time customer intelligence built for modern dealership groups.",
};

// ── Feature cards ─────────────────────────────────────────────
const features = [
  {
    icon: Bot,
    title: "5-Agent AI Swarm",
    desc: "Orchestrator, Data, Targeting, Creative, and Optimization agents work in parallel — no prompts, no babysitting.",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: Mail,
    title: "Native Direct Mail",
    desc: "PostGrid-powered postcards and letters with QR tracking, personalized per customer, fulfilled automatically.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: TrendingUp,
    title: "Self-Learning Optimization",
    desc: "Every campaign result trains the next one. Response patterns improve across your entire fleet over time.",
    color: "bg-sky-50 text-sky-600",
  },
  {
    icon: BarChart3,
    title: "Last-Visit Memory",
    desc: "Knows exactly what each customer drove in for, what they spent, and when they're likely to return.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: Zap,
    title: "DMS Integration",
    desc: "CDK Fortellis and Reynolds & Reynolds sync automatically. Customer, RO, and inventory data — always current.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Shield,
    title: "Hybrid Pricing",
    desc: "Pay for what you use. No per-seat licenses. Scale up during conquest campaigns, scale down in slow months.",
    color: "bg-rose-50 text-rose-600",
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
  },
  {
    quote: "The AI writes better win-back copy than our ad agency did. And it sends automatically the moment a customer goes lapsed.",
    name: "Jake R.",
    title: "General Manager, Franchise Dealership",
    initials: "JR",
  },
];

const stats = [
  { value: "18%", label: "Avg. retention lift" },
  { value: "3×", label: "Mail response vs. generic" },
  { value: "< 2h", label: "Time to first campaign" },
  { value: "0", label: "Manual steps per send" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">AutoCDP</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How It Works</a>
            <a href="#testimonials" className="hover:text-slate-900 transition-colors">Results</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-navy-900 text-white text-sm font-medium hover:bg-navy-800 transition-colors shadow-sm"
            >
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-8 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Now with CDK Fortellis + Reynolds Integration
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-[1.08] tracking-tight mb-6">
            The CRM that markets
            <br />
            <span className="text-indigo-600">itself.</span>
          </h1>
          <p className="text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto mb-10">
            AutoCDP runs AI agents across your customer data, writes personalized campaigns, and drops direct mail in the physical mailbox — automatically, after every DMS sync.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-base hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              Request a demo
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">No credit card required · Setup in under 2 hours · Cancel anytime</p>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50 py-12 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold text-slate-900 tracking-tight">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-4">
              Everything in one platform
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Built specifically for auto dealership groups that want AI-driven marketing without stitching together five different vendors.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-card-md hover:border-slate-300 transition-all duration-200"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-navy-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-4">
              How AutoCDP works
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Connect your DMS. Define a campaign goal. The AI swarm handles the rest.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Connect your DMS", desc: "OAuth or API key — CDK Fortellis and Reynolds sync automatically every 30–60 minutes. No CSV exports." },
              { step: "02", title: "Set a campaign goal", desc: "\"Win back service customers lapsed 6–12 months\" or \"Upsell oil change customers to tire rotation\". Natural language." },
              { step: "03", title: "Agents do the work", desc: "Data → Targeting → Creative → Mail house. Personalized per customer, tracked by QR code, optimized after each run." },
            ].map((s) => (
              <div key={s.step} className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-4xl font-bold text-white/20 mb-4 font-mono">{s.step}</div>
                <h3 className="font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-slate-300 font-medium mb-4">Key differentiators</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {differentiators.map((d) => (
                <div key={d} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────── */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-4">
              Real results from real dealers
            </h2>
            <p className="text-slate-500 text-lg">Not projections. Actual outcomes from pilot dealerships.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="p-8 rounded-2xl border border-slate-200 bg-white shadow-card">
                <div className="flex gap-0.5 mb-5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="text-slate-700 leading-relaxed mb-6 text-[15px]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-navy-900 flex items-center justify-center text-white text-xs font-bold">
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

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-slate-50 border-t border-slate-100">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-4">
            Ready to run your first AI campaign?
          </h2>
          <p className="text-lg text-slate-500 mb-8">
            Most dealerships launch their first campaign within two hours of connecting their DMS.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              Sign in to dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-navy-900 flex items-center justify-center">
              <Car className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-slate-700 text-sm">AutoCDP</span>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} AutoCDP. Built for automotive retail.</p>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <Link href="/login" className="hover:text-slate-700 transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-slate-700 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
