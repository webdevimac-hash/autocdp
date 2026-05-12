"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Car,
  Mail,
  Bot,
  Shield,
  Zap,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Star,
  Cpu,
  Target,
  Database,
  Sparkles,
  Megaphone,
  Play,
  MessageSquare,
  AtSign,
  Menu,
  X,
  ChevronDown,
  Users,
  Award,
  ScanLine,
  Activity,
  BarChart3,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

const NAVY = "#0B1526";
const NAVY_DEEPER = "#060D18";
const EMERALD = "#10B981";
const EMERALD_BRIGHT = "#34D399";
const VIOLET = "#8B5CF6";
const SKY = "#38BDF8";

function OnVisible({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVis(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Data
// ═══════════════════════════════════════════════════════════════════════════

const ANNOUNCEMENTS = [
  { label: "Pilot results:", highlight: "+18% service retention", suffix: "in 90 days across SMS + email + direct mail" },
  { label: "New:", highlight: "AI direct mail with QR tracking", suffix: "— only AutoCDP runs all three channels in one swarm" },
  { label: "Join", highlight: "40+ rooftops in pilot", suffix: "— limited onboarding slots this month" },
];

const PRODUCTS = [
  {
    icon: Bot,
    eyebrow: "Signature",
    title: "5-Agent AI Swarm",
    desc: "Orchestrator, Data, Targeting, Creative, and Optimization agents share state and rerun on every DMS sync — choosing the channel, writing the message, learning from every result.",
    stat: "5 agents",
    statLabel: "always running",
    tone: EMERALD,
  },
  {
    icon: Mail,
    eyebrow: "Only AutoCDP",
    title: "AI Direct Mail",
    desc: "Handwriting-simulated postcards with a unique QR code per recipient, fulfilled by PostGrid and tracked from print → mailbox → scan.",
    stat: "$1.60",
    statLabel: "per piece delivered",
    tone: SKY,
  },
  {
    icon: MessageSquare,
    eyebrow: "Omnichannel",
    title: "SMS Campaigns",
    desc: "Twilio-powered, AI-written text messages triggered the instant a DMS event fires. Win-back, service reminder, conquest — all TCPA-compliant.",
    stat: "98%",
    statLabel: "average open rate",
    tone: VIOLET,
  },
  {
    icon: AtSign,
    eyebrow: "Omnichannel",
    title: "Email Campaigns",
    desc: "Resend-powered email with copy auto-segmented by vehicle, visit history, and RO spend. Not batch-and-blast — surgical.",
    stat: "42%",
    statLabel: "avg open rate",
    tone: EMERALD,
  },
  {
    icon: BarChart3,
    eyebrow: "Insight",
    title: "Unified Analytics",
    desc: "Cross-channel attribution in one dashboard. See exactly which campaign, channel, and creative drove every service appointment.",
    stat: "360°",
    statLabel: "attribution",
    tone: "#F59E0B",
  },
  {
    icon: Database,
    eyebrow: "Integration",
    title: "DMS Integration",
    desc: "CDK Fortellis and Reynolds & Reynolds sync every 30 – 60 minutes. Customer, RO, and inventory data always current.",
    stat: "30 min",
    statLabel: "sync interval",
    tone: "#F43F5E",
  },
];

const STEPS = [
  { n: "01", icon: Database, title: "Connect your DMS", desc: "OAuth or API key. CDK Fortellis and Reynolds & Reynolds. No CSV exports, no manual uploads.", time: "~15 min setup" },
  { n: "02", icon: Target, title: "Set a campaign goal", desc: "“Win back service customers lapsed 6–12 months.” Plain language — the agents pick audience, channel, and copy.", time: "60 seconds" },
  { n: "03", icon: Cpu, title: "Agents do the work", desc: "Data → Targeting → Creative → SMS / Email / Mail. Every send tracked, every result feeds the next campaign.", time: "< 48h to mailbox" },
];

const TESTIMONIALS = [
  {
    quote: "We replaced three separate vendors — mail house, CRM, and reporting — with AutoCDP. Service-lane retention is up 18 % in 90 days.",
    name: "Marcus T.",
    title: "Fixed Ops Director · Multi-Rooftop Group",
    initials: "MT",
    stat: "+18%",
    statLabel: "retention lift, 90 days",
    accent: EMERALD,
    channels: ["Direct Mail", "SMS", "Email"],
  },
  {
    quote: "The AI writes better win-back copy than our agency. It sends automatically the second a customer goes lapsed. Set it and forget it.",
    name: "Derek S.",
    title: "General Manager · Franchise Dealership",
    initials: "DS",
    stat: "3×",
    statLabel: "mail response rate",
    accent: "#818CF8",
    channels: ["Direct Mail", "Email"],
  },
  {
    quote: "We A/B-tested AutoCDP against Fullpath for 60 days. AutoCDP generated 3.4× more service appointments from the same list.",
    name: "Kevin P.",
    title: "Marketing Manager · 3-Store Group",
    initials: "KP",
    stat: "3.4×",
    statLabel: "vs. Fullpath",
    accent: SKY,
    channels: ["Direct Mail", "SMS"],
  },
];

const TRUST_LOGOS = [
  "CDK Fortellis",
  "Reynolds & Reynolds",
  "Anthropic Claude",
  "PostGrid",
  "Twilio",
  "Resend",
  "Stripe",
  "USPS",
];

const STATS = [
  { value: "+18%", label: "Avg. service-lane retention lift", sub: "90-day pilot data" },
  { value: "3×", label: "Response vs. generic mail", sub: "same customer list" },
  { value: "< 2h", label: "DMS connect → first send", sub: "first campaign live" },
  { value: "$142k", label: "Avg. revenue attributed", sub: "per rooftop, 90 days" },
];

const PLANS = [
  {
    name: "Starter",
    price: "$299",
    period: "/mo",
    desc: "One store. Two channels. Full AI.",
    features: ["SMS + email campaigns", "1 DMS connection", "Up to 2,500 customers", "3-agent AI processing", "Email support"],
    cta: "Start free trial",
    href: "/signup",
    featured: false,
  },
  {
    name: "Growth",
    price: "$599",
    period: "/mo",
    desc: "All 3 channels. Multi-store. Full swarm.",
    features: ["SMS + email + AI direct mail", "Up to 3 stores", "Up to 10,000 customers", "Full 5-agent swarm", "QR + click + open attribution", "Priority support"],
    cta: "Start free trial",
    href: "/signup",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "Unlimited stores. White-glove setup.",
    features: ["Unlimited stores & customers", "Custom DMS integrations", "Dedicated CSM + SLA", "API access & webhooks", "SAML SSO"],
    cta: "Talk to sales",
    href: "/signup?plan=enterprise",
    featured: false,
  },
];

const FAQS = [
  {
    q: "How is AutoCDP different from Fullpath or CDK's marketing tools?",
    a: "Fullpath and CDK offer digital ads and email — but neither does AI-personalized direct mail, and neither connects all three channels automatically. AutoCDP is the only platform that writes and sends SMS, email, and QR-tracked direct mail from a single DMS sync.",
  },
  { q: "How long does setup take?", a: "Most rooftops are live within 2 hours. Connect your CDK or Reynolds DMS via OAuth, set your first campaign goal in plain language, and AutoCDP handles audience, copy, delivery, and attribution." },
  { q: "Does AutoCDP replace my CRM?", a: "No — AutoCDP works alongside your existing CRM. We read from your DMS to trigger campaigns and optionally write activity back to your CRM. Think of AutoCDP as the AI-powered omnichannel engine, not the data warehouse." },
  { q: "What DMS systems do you support?", a: "CDK Fortellis and Reynolds & Reynolds are fully supported, with data syncing every 30–60 minutes. Additional integrations are available on Enterprise. Talk to us — we add new connectors quickly." },
  { q: "Can I try it before committing?", a: "Yes. Every plan includes a 14-day free trial with full access across all three channels. No credit card. Most dealers see their first automated campaign deliver within 48 hours." },
  { q: "How does AI direct mail work?", a: "AutoCDP designs a personalized postcard per segment, submits it to PostGrid for print and fulfillment, and tracks each unique QR scan back to the original send. Design-to-mailbox is under 14 days." },
];

// ═══════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  const [navOpen, setNavOpen] = useState(false);
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setAnnouncementIdx((i) => (i + 1) % ANNOUNCEMENTS.length);
    }, 5000);
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      clearInterval(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: NAVY_DEEPER, color: "#E2E8F0" }}>
      {/* ─────────────────────────────────────────────────────────────────
         ANNOUNCEMENT BAR
         ───────────────────────────────────────────────────────────────── */}
      <div
        className="relative py-2.5 px-4 text-center overflow-hidden"
        style={{ background: "linear-gradient(90deg, #050A12 0%, #0B1526 50%, #050A12 100%)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div key={announcementIdx} className="flex items-center justify-center gap-2.5 text-xs font-medium animate-fade-in">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-white/50">{ANNOUNCEMENTS[announcementIdx].label}</span>
          <strong className="font-bold text-emerald-300">{ANNOUNCEMENTS[announcementIdx].highlight}</strong>
          <span className="text-white/55 hidden sm:inline">{ANNOUNCEMENTS[announcementIdx].suffix}</span>
          <Link href="/signup" className="hidden sm:inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors ml-1">
            Get access <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
         NAV
         ───────────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 transition-all"
        style={{
          background: scrolled ? "rgba(6,13,24,0.78)" : "rgba(6,13,24,0.55)",
          backdropFilter: "blur(18px) saturate(180%)",
          WebkitBackdropFilter: "blur(18px) saturate(180%)",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${EMERALD} 0%, #0EA5E9 100%)`,
                boxShadow: "0 4px 16px -4px rgba(16,185,129,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[17px] tracking-tight text-white">AutoCDP</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {[
              { label: "Products", href: "#products" },
              { label: "How it works", href: "#how" },
              { label: "Results", href: "#results" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all text-white/65 hover:text-white hover:bg-white/5"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:block text-[13px] font-semibold px-3 py-2 rounded-lg text-white/70 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "white",
                backdropFilter: "blur(4px)",
              }}
            >
              Request a Demo
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:bg-white/5 hover:text-white"
              onClick={() => setNavOpen((o) => !o)}
              aria-label={navOpen ? "Close menu" : "Open menu"}
            >
              {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {navOpen && (
          <div className="sm:hidden border-t border-white/10 bg-[#060D18] px-5 py-4">
            <div className="flex flex-col gap-1 mb-4">
              {["Products", "How it works", "Results", "Pricing", "FAQ"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, "")}`}
                  className="px-3 py-3 text-[14px] font-semibold rounded-lg text-white/80 hover:bg-white/5"
                  onClick={() => setNavOpen(false)}
                >
                  {item}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
              <Link href="/login" onClick={() => setNavOpen(false)} className="px-3 py-3 text-center text-[14px] font-semibold rounded-lg bg-white/5 text-white border border-white/10">
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setNavOpen(false)}
                className="px-3 py-3 text-center text-[14px] font-bold rounded-lg text-white"
                style={{ background: `linear-gradient(135deg, ${EMERALD} 0%, #0EA5E9 100%)`, boxShadow: "0 4px 18px -4px rgba(16,185,129,0.5)" }}
              >
                Request a Demo
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─────────────────────────────────────────────────────────────────
         HERO
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative px-5 sm:px-8 pt-20 sm:pt-28 pb-20 sm:pb-28">
        {/* Background layers */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, rgba(0,0,0,1), transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, rgba(0,0,0,1), transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(16,185,129,0.16), transparent 65%)" }}
          />
          <div
            className="absolute top-0 right-0 w-[720px] h-[620px] rounded-full blur-3xl translate-x-1/3"
            style={{ background: "rgba(56,189,248,0.07)" }}
          />
          <div
            className="absolute bottom-0 left-0 w-[560px] h-[420px] rounded-full blur-3xl -translate-x-1/3 translate-y-1/4"
            style={{ background: "rgba(139,92,246,0.06)" }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1fr] gap-14 xl:gap-20 items-center">
            {/* Left copy */}
            <OnVisible>
              {/* Live badge */}
              <div
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-7 text-[11px] font-bold uppercase tracking-widest"
                style={{
                  background: "rgba(16,185,129,0.10)",
                  border: "1px solid rgba(16,185,129,0.30)",
                  color: EMERALD_BRIGHT,
                  boxShadow: "0 0 0 4px rgba(16,185,129,0.05), 0 4px 18px -6px rgba(16,185,129,0.30)",
                }}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live · SMS · Email · Direct Mail
              </div>

              <h1 className="text-[2.85rem] sm:text-[3.6rem] xl:text-[4.1rem] font-black leading-[1.02] tracking-[-0.038em] mb-7 text-white">
                Real dealers.
                <br />
                <span
                  style={{
                    backgroundImage: "linear-gradient(135deg, #34D399 0%, #38BDF8 60%, #A78BFA 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Real results.
                </span>
              </h1>

              <p className="text-[17px] sm:text-[19px] leading-[1.62] mb-9 max-w-xl text-white/65">
                Five Claude-powered AI agents watch your DMS and fire{" "}
                <span className="font-semibold text-white">personalized SMS, email, and QR-tracked direct mail</span>{" "}
                the instant a customer goes lapsed, due for service, or shows trade-in signal.
                <br className="hidden sm:block" />
                One platform replaces your mail house, CRM, and reporting vendor.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-9">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold text-[15px] transition-all group"
                  style={{
                    background: `linear-gradient(135deg, ${EMERALD} 0%, #059669 100%)`,
                    boxShadow: "0 12px 36px -6px rgba(16,185,129,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
                  }}
                >
                  Request a Demo
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-[15px] transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "white",
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)" }}
                  >
                    <Play className="w-2.5 h-2.5 text-white ml-0.5" fill="currentColor" />
                  </div>
                  Watch 60-sec demo
                </Link>
              </div>

              {/* Trust strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-8 max-w-xl">
                {[
                  { icon: CheckCircle, label: "No credit card", sub: "Start immediately" },
                  { icon: Zap, label: "Live in < 2 hrs", sub: "DMS to first send" },
                  { icon: Shield, label: "Cancel anytime", sub: "No contracts" },
                ].map((t) => (
                  <div
                    key={t.label}
                    className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)" }}
                    >
                      <t.icon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold leading-none text-white">{t.label}</p>
                      <p className="text-[10.5px] font-medium mt-0.5 text-white/45">{t.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-4 pt-6 border-t border-white/8">
                <div className="flex -space-x-2.5">
                  {["MT", "DS", "KP", "SR", "DL"].map((i, idx) => (
                    <div
                      key={idx}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{
                        background: ["#0B1526", "#6366F1", "#10B981", "#8B5CF6", "#F59E0B"][idx],
                        border: `2px solid ${NAVY_DEEPER}`,
                      }}
                    >
                      {i}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-[12px] font-medium text-white/60">
                    Trusted by <span className="font-bold text-white">40+ rooftops</span> in pilot
                  </p>
                </div>
              </div>
            </OnVisible>

            {/* Right: dashboard / chat preview */}
            <OnVisible delay={120} className="hidden xl:block">
              <HeroPreview />
            </OnVisible>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         METRIC TILES (mirrors DriveCentric Engagement / Satisfaction grid)
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative px-5 sm:px-8 pb-20">
        <div className="max-w-7xl mx-auto">
          <OnVisible>
            <div
              className="rounded-2xl p-6 sm:p-8 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
              style={{
                background: "linear-gradient(180deg, rgba(11,21,38,0.85) 0%, rgba(6,13,24,0.9) 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 30px 90px -30px rgba(0,0,0,0.6)",
              }}
            >
              {[
                { icon: MessageSquare, label: "Engagement", a: { value: "12,959", k: "Replies" }, b: { value: "9,760", k: "Attempts" }, tone: VIOLET },
                { icon: Star, label: "Satisfaction", a: { value: "1,086", k: "Raving fans" }, b: { value: "2,328", k: "Grateful" }, tone: VIOLET },
                { icon: Users, label: "Equal to", a: { value: "2,445", k: "Humans" }, b: { value: "27,819", k: "Hours saved" }, tone: VIOLET },
                { icon: TrendingUp, label: "Impact sales", a: { value: "$2.4M", k: "Gross" }, b: { value: "56", k: "Delivered" }, tone: EMERALD },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/55 mb-3">
                    <m.icon className="w-3.5 h-3.5" />
                    {m.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[m.a, m.b].map((cell, i) => (
                      <div
                        key={i}
                        className="rounded-xl px-3 py-3"
                        style={{
                          background: `${m.tone}14`,
                          border: `1px solid ${m.tone}33`,
                        }}
                      >
                        <p className="text-[20px] sm:text-[22px] font-black tabular-nums tracking-tight" style={{ color: m.tone === EMERALD ? EMERALD_BRIGHT : "#C4B5FD" }}>
                          {cell.value}
                        </p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mt-0.5">
                          {cell.k}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </OnVisible>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         TRUSTED BY
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative px-5 sm:px-8 pb-20">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-white/40 mb-6">
            Integrated with the tools dealers already trust
          </p>
          <div
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 px-6 py-6 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {TRUST_LOGOS.map((l) => (
              <span key={l} className="text-white/45 hover:text-white/80 transition-colors font-bold tracking-tight text-[15px]">
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         "One platform. Zero patchwork." — Big anchor section
         ───────────────────────────────────────────────────────────────── */}
      <section id="products" className="relative px-5 sm:px-8 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <OnVisible>
            <div className="text-center mb-14">
              <span
                className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}
              >
                Platform Overview
              </span>
              <h2 className="mt-5 text-[2.5rem] sm:text-[3.2rem] font-black leading-[1.05] tracking-[-0.034em] text-white">
                One platform.
                <br />
                <span
                  style={{
                    backgroundImage: "linear-gradient(135deg, #34D399 0%, #38BDF8 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Zero patchwork.
                </span>
              </h2>
              <p className="mt-5 text-[17px] text-white/55 max-w-2xl mx-auto leading-relaxed">
                Stop juggling a mail house, an SMS vendor, and an email tool that never talk to each other. AutoCDP replaces the patchwork with one streamlined AI engine.
              </p>
            </div>
          </OnVisible>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {PRODUCTS.map((p, i) => (
              <OnVisible key={p.title} delay={i * 60}>
                <ProductCard p={p} />
              </OnVisible>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         5-AGENT SWARM signature section
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative px-5 sm:px-8 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 items-center">
            <OnVisible>
              <span
                className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-5"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.30)", color: EMERALD_BRIGHT }}
              >
                Signature differentiator
              </span>
              <h2 className="text-[2.3rem] sm:text-[2.85rem] font-black leading-[1.05] tracking-[-0.032em] text-white mb-5">
                A 5-agent AI swarm that{" "}
                <span style={{ color: EMERALD_BRIGHT }}>actually finishes the work.</span>
              </h2>
              <p className="text-[17px] text-white/60 leading-relaxed mb-7">
                Most marketing AI stops at “suggesting.” AutoCDP&apos;s swarm goes all the way to delivered mail and replied SMS — and learns from every result.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  { name: "Orchestrator", role: "Plans execution and routes the work" },
                  { name: "Data Agent", role: "Segments customers, scores churn risk and LTV" },
                  { name: "Targeting Agent", role: "Picks the optimal audience and channel" },
                  { name: "Creative Agent", role: "Writes personalized copy per customer" },
                  { name: "Optimization Agent", role: "Analyses outcomes, extracts global patterns" },
                ].map((a, i) => (
                  <li key={a.name} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.30)", color: EMERALD_BRIGHT }}
                    >
                      0{i + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-white">{a.name}</span>
                      <span className="text-white/55"> — {a.role}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-[14px] text-white"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                See the swarm run <ArrowRight className="w-4 h-4" />
              </Link>
            </OnVisible>

            <OnVisible delay={120}>
              <SwarmPreview />
            </OnVisible>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         AI DIRECT MAIL signature section
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative px-5 sm:px-8 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <OnVisible>
              <DirectMailPreview />
            </OnVisible>
            <OnVisible delay={120}>
              <span
                className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-5"
                style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.30)", color: SKY }}
              >
                Only on AutoCDP
              </span>
              <h2 className="text-[2.3rem] sm:text-[2.85rem] font-black leading-[1.05] tracking-[-0.032em] text-white mb-5">
                The one channel <span style={{ color: SKY }}>nobody else automates.</span>
              </h2>
              <p className="text-[17px] text-white/60 leading-relaxed mb-7">
                Handwriting-simulated postcards. Per-recipient QR codes. PostGrid print + USPS fulfillment. Every scan tied back to the campaign that drove it — in real time.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Handwriting engine: per-character rotation, scale, opacity",
                  "Unique QR per recipient → live attribution dashboard",
                  "PostGrid REST → first-class delivery in 2–5 days",
                  "Webhook-tracked: printed, in-transit, delivered, returned",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3 text-white/75">
                    <CheckCircle className="mt-0.5 w-5 h-5 text-sky-400 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-[14px] text-white"
                style={{ background: "linear-gradient(135deg, #0EA5E9, #2563EB)", boxShadow: "0 10px 28px -6px rgba(56,189,248,0.45)" }}
              >
                See sample postcards <ArrowRight className="w-4 h-4" />
              </Link>
            </OnVisible>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         HOW IT WORKS
         ───────────────────────────────────────────────────────────────── */}
      <section id="how" className="relative px-5 sm:px-8 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <OnVisible>
            <div className="text-center mb-14">
              <span
                className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}
              >
                How it works
              </span>
              <h2 className="mt-5 text-[2.5rem] sm:text-[3.2rem] font-black leading-[1.05] tracking-[-0.034em] text-white">
                From DMS connect to mailbox{" "}
                <span style={{ color: EMERALD_BRIGHT }}>in under 48 hours.</span>
              </h2>
            </div>
          </OnVisible>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
            {/* Connector line */}
            <div
              className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.45), transparent)" }}
            />
            {STEPS.map((s, i) => (
              <OnVisible key={s.n} delay={i * 80}>
                <div
                  className="relative rounded-2xl p-6 h-full"
                  style={{
                    background: "linear-gradient(180deg, rgba(11,21,38,0.7) 0%, rgba(6,13,24,0.95) 100%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 20px 60px -20px rgba(0,0,0,0.5)",
                  }}
                >
                  <div
                    className="absolute top-6 right-6 text-[42px] font-black leading-none tracking-tighter"
                    style={{
                      backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.18))",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    {s.n}
                  </div>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)" }}
                  >
                    <s.icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-[18px] font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-[13.5px] text-white/55 leading-relaxed mb-4">{s.desc}</p>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400/80">
                    <Activity className="w-3 h-3" />
                    {s.time}
                  </div>
                </div>
              </OnVisible>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         RESULTS / STATS
         ───────────────────────────────────────────────────────────────── */}
      <section id="results" className="relative px-5 sm:px-8 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <OnVisible>
            <div className="text-center mb-12">
              <h2 className="text-[2.5rem] sm:text-[3.2rem] font-black leading-[1.05] tracking-[-0.034em] text-white">
                Real dealers.
                <br />
                <span
                  style={{
                    backgroundImage: "linear-gradient(135deg, #34D399 0%, #38BDF8 60%, #A78BFA 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Real results.
                </span>
              </h2>
              <p className="mt-4 text-[17px] text-white/55 max-w-2xl mx-auto">
                AutoCDP isn&apos;t another software vendor — we&apos;re a partner that genuinely understands the car business.
              </p>
            </div>
          </OnVisible>

          {/* Top stat ribbon */}
          <OnVisible>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl p-6 text-center"
                  style={{
                    background: "linear-gradient(180deg, rgba(11,21,38,0.75) 0%, rgba(6,13,24,0.95) 100%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <p
                    className="text-[36px] sm:text-[42px] font-black tabular-nums tracking-tight"
                    style={{
                      backgroundImage: "linear-gradient(135deg, #34D399 0%, #38BDF8 100%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    {s.value}
                  </p>
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-white/65 mt-1">
                    {s.label}
                  </p>
                  <p className="text-[10.5px] text-white/40 mt-1">{s.sub}</p>
                </div>
              ))}
            </div>
          </OnVisible>

          {/* Testimonials */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <OnVisible key={t.name} delay={i * 80}>
                <TestimonialCard t={t} />
              </OnVisible>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         PRICING
         ───────────────────────────────────────────────────────────────── */}
      <section id="pricing" className="relative px-5 sm:px-8 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <OnVisible>
            <div className="text-center mb-14">
              <span
                className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}
              >
                Pricing
              </span>
              <h2 className="mt-5 text-[2.5rem] sm:text-[3.2rem] font-black leading-[1.05] tracking-[-0.034em] text-white">
                Straightforward, per-rooftop pricing.
              </h2>
              <p className="mt-4 text-[16px] text-white/55 max-w-2xl mx-auto">
                14-day free trial. No credit card required. Cancel anytime.
              </p>
            </div>
          </OnVisible>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((p, i) => (
              <OnVisible key={p.name} delay={i * 80}>
                <PlanCard plan={p} />
              </OnVisible>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         FAQ
         ───────────────────────────────────────────────────────────────── */}
      <section id="faq" className="relative px-5 sm:px-8 pb-20 sm:pb-28">
        <div className="max-w-3xl mx-auto">
          <OnVisible>
            <div className="text-center mb-10">
              <span
                className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}
              >
                FAQ
              </span>
              <h2 className="mt-4 text-[2rem] sm:text-[2.4rem] font-black tracking-tight text-white">
                Common questions.
              </h2>
            </div>
          </OnVisible>

          <div className="space-y-3">
            {FAQS.map((f, i) => {
              const isOpen = openFaq === i;
              return (
                <OnVisible key={f.q} delay={i * 40}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full text-left rounded-xl p-5 transition-all"
                    style={{
                      background: isOpen ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isOpen ? "rgba(16,185,129,0.30)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-[15px] text-white">{f.q}</span>
                      <ChevronDown
                        className="w-5 h-5 shrink-0 transition-transform text-white/60"
                        style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                      />
                    </div>
                    {isOpen && (
                      <p className="mt-3 text-[14px] leading-relaxed text-white/65">{f.a}</p>
                    )}
                  </button>
                </OnVisible>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         CTA CARD (mirrors DriveCentric "Discover the Power")
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative px-5 sm:px-8 pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <OnVisible>
            <div
              className="relative overflow-hidden rounded-3xl p-8 sm:p-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
              style={{
                background: "linear-gradient(135deg, #0B1526 0%, #1E1B4B 100%)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 30px 90px -20px rgba(16,185,129,0.20)",
              }}
            >
              {/* Glow */}
              <div
                className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl pointer-events-none"
                style={{ background: "rgba(16,185,129,0.18)" }}
              />
              <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(139,92,246,0.14)" }} />

              <div className="relative">
                <h3 className="text-[1.85rem] sm:text-[2.4rem] font-black tracking-tight text-white leading-[1.08]">
                  Discover the Power of AutoCDP.
                </h3>
                <p className="mt-3 text-white/65 text-[15px] max-w-md">
                  Transform your dealership marketing with hyper-personalized AI across SMS, email, and direct mail — all from one platform.
                </p>
              </div>
              <Link
                href="/signup"
                className="relative inline-flex items-center gap-2 px-7 py-4 rounded-xl font-bold text-[15px] text-white shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${EMERALD} 0%, #059669 100%)`,
                  boxShadow: "0 12px 32px -6px rgba(16,185,129,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
                }}
              >
                Request a Demo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </OnVisible>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
         FOOTER
         ───────────────────────────────────────────────────────────────── */}
      <footer className="relative px-5 sm:px-8 pt-16 pb-12 border-t border-white/8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2 md:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${EMERALD} 0%, #0EA5E9 100%)`, boxShadow: "0 4px 16px -4px rgba(16,185,129,0.45)" }}
                >
                  <Car className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-[18px] tracking-tight text-white">AutoCDP</span>
              </Link>
              <p className="text-[13px] text-white/45 max-w-sm leading-relaxed">
                AI-powered marketing for automotive dealerships. SMS, email, and direct mail — all from one platform.
              </p>
            </div>

            <FooterColumn
              title="Product"
              links={[
                { label: "Features", href: "#products" },
                { label: "Pricing", href: "#pricing" },
                { label: "How it works", href: "#how" },
                { label: "Integrations", href: "#products" },
              ]}
            />
            <FooterColumn
              title="Company"
              links={[
                { label: "About", href: "/about" },
                { label: "Careers", href: "/careers" },
                { label: "Contact", href: "/contact" },
              ]}
            />
            <FooterColumn
              title="Resources"
              links={[
                { label: "Request a demo", href: "/signup" },
                { label: "Sign in", href: "/login" },
                { label: "FAQ", href: "#faq" },
                { label: "Support", href: "/support" },
              ]}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-white/8">
            <p className="text-[12px] text-white/40">
              © {new Date().getFullYear()} AutoCDP. All rights reserved.
            </p>
            <div className="flex items-center gap-5 text-[12px] text-white/40">
              <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white/70 transition-colors">Terms</Link>
              <Link href="/security" className="hover:text-white/70 transition-colors">Security</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Subcomponents
// ═══════════════════════════════════════════════════════════════════════════

function ProductCard({ p }: { p: (typeof PRODUCTS)[number] }) {
  const Icon = p.icon;
  return (
    <div
      className="group relative h-full rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1"
      style={{
        background:
          "linear-gradient(180deg, rgba(15,26,46,0.78) 0%, rgba(6,13,24,0.96) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow:
          "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 30px 80px -30px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.4)",
      }}
    >
      {/* Top hairline accent — brightens on hover */}
      <div
        className="absolute inset-x-7 top-0 h-px transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${p.tone}, transparent)`,
          opacity: 0.45,
        }}
      />

      {/* Decorative dotted grid behind the icon */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 -left-6 h-32 w-32 rounded-2xl opacity-[0.35] transition-opacity duration-500 group-hover:opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0)",
          backgroundSize: "12px 12px",
          maskImage:
            "radial-gradient(ellipse at 30% 30%, rgba(0,0,0,1), transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 30% 30%, rgba(0,0,0,1), transparent 70%)",
        }}
      />

      {/* Soft corner glow on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `${p.tone}22` }}
      />

      {/* Header row: layered icon tile + eyebrow chip */}
      <div className="relative flex items-start justify-between mb-7">
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-[1.04]"
          style={{
            background: `linear-gradient(155deg, ${p.tone}26 0%, ${p.tone}08 60%, transparent 100%)`,
            border: `1px solid ${p.tone}40`,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 24px -8px ${p.tone}55, 0 1px 0 0 rgba(255,255,255,0.06) inset`,
          }}
        >
          {/* Inner gloss */}
          <span
            aria-hidden
            className="absolute inset-px rounded-[14px] opacity-60"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
            }}
          />
          <Icon
            className="relative h-6 w-6"
            style={{ color: p.tone, strokeWidth: 1.75 }}
          />
        </div>

        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{
            background: `${p.tone}12`,
            color: p.tone,
            border: `1px solid ${p.tone}38`,
          }}
        >
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: p.tone, boxShadow: `0 0 6px ${p.tone}` }}
          />
          {p.eyebrow}
        </span>
      </div>

      {/* Title + description */}
      <h3 className="relative text-[20px] font-bold tracking-tight text-white mb-2.5 leading-tight">
        {p.title}
      </h3>
      <p className="relative text-[13.5px] text-white/55 leading-[1.65] mb-6 min-h-[80px]">
        {p.desc}
      </p>

      {/* Stat divider + learn-more arrow */}
      <div
        className="relative flex items-end justify-between pt-5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex flex-col">
          <span
            className="text-[26px] font-black tabular-nums tracking-tight leading-none"
            style={{ color: p.tone }}
          >
            {p.stat}
          </span>
          <span className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/50">
            {p.statLabel}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35 transition-all duration-300 group-hover:gap-2 group-hover:text-white/75">
          Learn more
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: (typeof PLANS)[number] }) {
  const featured = plan.featured;
  return (
    <div
      className="relative h-full rounded-2xl p-7 flex flex-col"
      style={{
        background: featured
          ? "linear-gradient(180deg, rgba(16,185,129,0.10) 0%, rgba(6,13,24,0.95) 100%)"
          : "linear-gradient(180deg, rgba(11,21,38,0.7) 0%, rgba(6,13,24,0.9) 100%)",
        border: `1px solid ${featured ? "rgba(16,185,129,0.40)" : "rgba(255,255,255,0.08)"}`,
        boxShadow: featured ? "0 30px 80px -25px rgba(16,185,129,0.45)" : "0 20px 60px -25px rgba(0,0,0,0.5)",
      }}
    >
      {featured && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
          style={{ background: `linear-gradient(135deg, ${EMERALD}, #059669)`, boxShadow: "0 6px 18px -4px rgba(16,185,129,0.6)" }}
        >
          Most popular
        </span>
      )}
      <h3 className="text-[17px] font-bold text-white">{plan.name}</h3>
      <p className="text-[13px] text-white/50 mt-1">{plan.desc}</p>
      <div className="flex items-baseline gap-1 mt-5 mb-6">
        <span className="text-[42px] font-black tracking-tight text-white tabular-nums">{plan.price}</span>
        <span className="text-[13px] text-white/45 font-semibold">{plan.period}</span>
      </div>
      <ul className="space-y-2.5 mb-7 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-white/70">
            <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={plan.href}
        className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl font-semibold text-[14px] text-white transition-all"
        style={
          featured
            ? {
                background: `linear-gradient(135deg, ${EMERALD} 0%, #059669 100%)`,
                boxShadow: "0 8px 24px -6px rgba(16,185,129,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
              }
            : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)" }
        }
      >
        {plan.cta} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function TestimonialCard({ t }: { t: (typeof TESTIMONIALS)[number] }) {
  return (
    <div
      className="relative h-full rounded-2xl p-6 flex flex-col"
      style={{
        background: "linear-gradient(180deg, rgba(11,21,38,0.78) 0%, rgba(6,13,24,0.95) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 60px -25px rgba(0,0,0,0.6)",
      }}
    >
      {/* Top tinted border */}
      <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${t.accent}88, transparent)` }} />

      <div className="flex gap-0.5 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
        ))}
      </div>

      <p className="text-[15px] leading-[1.55] text-white/85 mb-5 flex-1">“{t.quote}”</p>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {t.channels.map((c) => (
          <span
            key={c}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.65)" }}
          >
            {c}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-5 border-t border-white/8">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
          style={{ background: `linear-gradient(135deg, ${t.accent} 0%, ${NAVY} 100%)`, boxShadow: `0 0 0 2px ${t.accent}33` }}
        >
          {t.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-white truncate">{t.name}</p>
          <p className="text-[11.5px] text-white/45 truncate">{t.title}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[20px] font-black tabular-nums" style={{ color: t.accent }}>{t.stat}</p>
          <p className="text-[9.5px] font-semibold uppercase tracking-wider text-white/45">{t.statLabel}</p>
        </div>
      </div>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/45 mb-4">{title}</p>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-[13px] text-white/65 hover:text-white transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Hero preview: dashboard + chat cards ─────────────────────────────────────

function HeroPreview() {
  return (
    <div className="relative">
      {/* Ambient glow */}
      <div
        className="absolute -inset-10 rounded-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 55% 45%, rgba(16,185,129,0.16), transparent 65%)" }}
      />

      {/* Browser-style frame */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: NAVY,
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 50px 120px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(16,185,129,0.10)",
        }}
      >
        {/* Chrome */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: NAVY_DEEPER, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/55" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/55" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/55" />
          </div>
          <div className="flex-1 mx-1">
            <div className="flex items-center gap-2 px-3 py-1 rounded-md" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
              <span className="text-[10px] font-mono text-white/40">app.autocdp.com/dashboard</span>
            </div>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="p-5 grid grid-cols-2 gap-3" style={{ background: NAVY }}>
          {/* Stat tiles */}
          {[
            { icon: Mail, label: "Mail today", value: "1,847", tone: SKY, spark: [38, 52, 45, 63, 58, 70, 84] },
            { icon: MessageSquare, label: "SMS today", value: "892", tone: VIOLET, spark: [45, 58, 52, 67, 71, 79, 88] },
            { icon: AtSign, label: "Email open", value: "41%", tone: EMERALD, spark: [55, 62, 58, 68, 72, 78, 83] },
            { icon: TrendingUp, label: "Rev. attributed", value: "$84k", tone: "#FBBF24", spark: [44, 53, 61, 57, 69, 75, 88] },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.tone}18` }}>
                  <s.icon className="w-3.5 h-3.5" style={{ color: s.tone }} />
                </div>
                <ScanLine className="w-3 h-3 text-white/25" />
              </div>
              <p className="text-[22px] font-black tabular-nums tracking-tight text-white">{s.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mt-0.5">{s.label}</p>
              <div className="flex items-end gap-px mt-2.5 h-4">
                {s.spark.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{ height: `${h}%`, background: s.tone, opacity: 0.25 + (i / 6) * 0.7 }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating chat card 1 */}
      <div
        className="absolute -left-6 top-1/3 w-[230px] rounded-xl p-3.5 rotate-[-4deg]"
        style={{
          background: "white",
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.45)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center">CF</div>
          <div className="text-[11px] font-bold text-slate-800">Cody Fisher</div>
        </div>
        <p className="text-[11px] leading-snug text-slate-700">
          “Hey David — saw your 2024 Camry hit 12k miles. Quick window for service this Tuesday?”
        </p>
        <div className="mt-2 text-[9px] text-emerald-600 font-semibold">Sent via SMS</div>
      </div>

      {/* Floating chat card 2 */}
      <div
        className="absolute -right-6 bottom-10 w-[240px] rounded-xl p-3.5 rotate-[3deg]"
        style={{
          background: "white",
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.45)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">AI</div>
          <div className="text-[11px] font-bold text-slate-800">Creative Agent</div>
          <span className="ml-auto text-[8px] font-mono text-emerald-600">composing…</span>
        </div>
        <p className="text-[11px] leading-snug text-slate-700">
          Personalized postcard — 6×9 — generated for <strong>32 lapsed Camry owners</strong>.
        </p>
        <div className="mt-2 flex items-center gap-2 text-[9px] font-semibold">
          <span className="text-sky-600">Mail piece</span>
          <span className="text-slate-400">·</span>
          <span className="text-emerald-600">QR-tracked</span>
        </div>
      </div>
    </div>
  );
}

// ── Swarm preview ────────────────────────────────────────────────────────────

function SwarmPreview() {
  const agents = [
    { name: "Orchestrator", state: "done", color: EMERALD },
    { name: "Data Agent", state: "done", color: EMERALD },
    { name: "Targeting", state: "running", color: "#818CF8" },
    { name: "Creative", state: "running", color: "#818CF8" },
    { name: "Optimization", state: "idle", color: "#475569" },
  ];
  return (
    <div
      className="relative rounded-2xl p-6"
      style={{
        background: "linear-gradient(180deg, rgba(11,21,38,0.85) 0%, rgba(6,13,24,0.95) 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 40px 100px -30px rgba(16,185,129,0.20)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-white/65">Live swarm</span>
        </div>
        <span className="text-[10px] font-mono text-white/40">run_id · 0xCAFE</span>
      </div>

      <ul className="space-y-2 mb-6">
        {agents.map((a) => (
          <li
            key={a.name}
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: a.color,
                  boxShadow: a.state === "running" ? `0 0 8px ${a.color}` : a.state === "done" ? `0 0 0 2px ${a.color}33` : "none",
                }}
              />
              <span className="text-[13px] font-semibold text-white">{a.name}</span>
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{
                color: a.state === "done" ? EMERALD_BRIGHT : a.state === "running" ? "#A5B4FC" : "#64748B",
              }}
            >
              {a.state}
            </span>
          </li>
        ))}
      </ul>

      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)" }}
      >
        <Activity className="w-4 h-4 text-emerald-400" />
        <span className="text-[12px] text-white/80">
          <strong className="text-white">32 personalized postcards</strong> queued · ETA 4 mins
        </span>
      </div>
    </div>
  );
}

// ── Direct mail preview ──────────────────────────────────────────────────────

function DirectMailPreview() {
  return (
    <div className="relative">
      {/* The postcard */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #FEFEFC 0%, #F8F2E6 100%)",
          aspectRatio: "9 / 6",
          boxShadow: "0 40px 90px -25px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        <div className="absolute inset-0 p-6 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Beck Toyota of Indianapolis
            </div>
            <p
              className="text-[20px] leading-snug text-slate-700 italic"
              style={{ fontFamily: "ui-serif, Georgia, serif", transform: "rotate(-0.4deg)" }}
            >
              Hey David — it&apos;s been a while since you visited us with the Tacoma.
              We&apos;ve got <span className="font-bold">$300 off your next service</span> waiting.
            </p>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">— Sarah at Beck Toyota</p>
              <p className="text-[9px] text-slate-400 mt-1">Expires 30 days from postmark</p>
            </div>
            {/* QR */}
            <div
              className="w-16 h-16 rounded-md"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #0F172A 25%, transparent 25%), linear-gradient(-45deg, #0F172A 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0F172A 75%), linear-gradient(-45deg, transparent 75%, #0F172A 75%)",
                backgroundSize: "8px 8px",
                backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
              }}
            />
          </div>
        </div>

        {/* Stamp */}
        <div
          className="absolute top-4 right-4 w-12 h-14 rounded-sm rotate-3 flex items-center justify-center text-[9px] font-bold text-white text-center leading-tight px-1"
          style={{ background: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)" }}
        >
          USPS
          <br />
          FIRST CLASS
        </div>
      </div>

      {/* Status pill */}
      <div
        className="absolute -bottom-5 left-6 right-6 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-fit flex items-center gap-3 px-4 py-2.5 rounded-full"
        style={{
          background: NAVY,
          border: "1px solid rgba(16,185,129,0.35)",
          boxShadow: "0 16px 40px -12px rgba(16,185,129,0.35)",
        }}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[11px] font-semibold text-white/80">
          QR scanned <strong className="text-white">14 mins ago</strong>
        </span>
        <span className="text-white/30">·</span>
        <span className="text-[11px] font-semibold text-emerald-400">+1 service appointment booked</span>
      </div>
    </div>
  );
}
