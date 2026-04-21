"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Car, Mail, Bot, Shield, Zap, TrendingUp,
  CheckCircle, ArrowRight, Star, Cpu, Target, Database,
  Sparkles, ArrowUpRight, CheckCircle2,
  Megaphone, ScanLine, ArrowUp, Play,
  MessageSquare, BarChart2, AtSign,
} from "lucide-react";

// ── Mini sparkline ─────────────────────────────────────────────
function MiniSpark({ bars, color, animKey = 0 }: { bars: number[]; color: string; animKey?: number }) {
  return (
    <div className="flex items-end gap-px" style={{ height: 13, marginTop: 4 }}>
      {bars.map((h, i) => (
        <div
          key={`${animKey}-${i}`}
          className="flex-1 rounded-sm spark-bar"
          style={{
            height: `${h}%`,
            background: color,
            opacity: 0.28 + (i / (bars.length - 1)) * 0.72,
            animationDelay: `${i * 0.06}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Scroll reveal ─────────────────────────────────────────────
function ScrollReveal({ children, className = "", delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          obs.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -48px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: "translateY(22px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────

const features: Array<{
  icon: React.ElementType; title: string; desc: string;
  iconBgClass: string; iconColor: string; glowClass: string;
  topColor: string; stat: string; statLabel: string; statColor: string;
  badge?: string;
}> = [
  {
    icon: Bot,
    title: "5-Agent AI Swarm",
    desc: "Orchestrator, Data, Targeting, Creative, and Optimization agents run 24/7 against your DMS — picking the best channel per customer, writing personalized copy, and learning from every result to make the next campaign better.",
    iconBgClass: "icon-bg-indigo",
    iconColor: "text-indigo-600",
    glowClass: "feature-card-indigo",
    topColor: "#6366F1",
    stat: "5 agents", statLabel: "always running", statColor: "#4F46E5",
  },
  {
    icon: Mail,
    title: "AI Direct Mail",
    desc: "PostGrid-powered postcards with QR tracking — personalized per customer, printed, and fulfilled automatically. The one channel Fullpath and CDK can't touch.",
    iconBgClass: "icon-bg-sky",
    iconColor: "text-sky-600",
    glowClass: "feature-card-sky",
    topColor: "#0EA5E9",
    stat: "< $1.60", statLabel: "per piece delivered", statColor: "#0284C7",
    badge: "Only AutoCDP",
  },
  {
    icon: MessageSquare,
    title: "SMS Campaigns",
    desc: "Twilio-powered, AI-written text messages triggered instantly by DMS events. Win-back sequences, service reminders, and conquest — all personalized and TCPA-compliant.",
    iconBgClass: "icon-bg-violet",
    iconColor: "text-violet-600",
    glowClass: "feature-card-violet",
    topColor: "#8B5CF6",
    stat: "98%", statLabel: "open rate", statColor: "#7C3AED",
  },
  {
    icon: AtSign,
    title: "Email Campaigns",
    desc: "Resend-powered marketing and transactional emails with AI-written copy. Auto-segmented by vehicle type, visit history, and RO spend — not batch-and-blast.",
    iconBgClass: "icon-bg-emerald",
    iconColor: "text-emerald-600",
    glowClass: "feature-card-emerald",
    topColor: "#10B981",
    stat: "42%", statLabel: "avg. open rate", statColor: "#059669",
  },
  {
    icon: BarChart2,
    title: "Unified Analytics",
    desc: "Cross-channel attribution in one dashboard. See exactly which campaign, channel, and creative drove each service appointment — updated every sync.",
    iconBgClass: "icon-bg-amber",
    iconColor: "text-amber-600",
    glowClass: "feature-card-amber",
    topColor: "#F59E0B",
    stat: "360°", statLabel: "attribution", statColor: "#B45309",
  },
  {
    icon: Database,
    title: "DMS Integration",
    desc: "CDK Fortellis and Reynolds & Reynolds sync every 30–60 minutes. Customer, RO, and inventory data always current — zero exports, zero manual steps.",
    iconBgClass: "icon-bg-rose",
    iconColor: "text-rose-600",
    glowClass: "feature-card-rose",
    topColor: "#F43F5E",
    stat: "30 min", statLabel: "sync interval", statColor: "#E11D48",
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
    desc: "Data → Targeting → Creative → SMS / Email / Mail. Every message personalized, every channel tracked, every result fed back to improve the next campaign.",
    time: "< 48h to mailbox",
  },
];

const differentiators = [
  "SMS, email, and QR-tracked direct mail — all from one platform, not three vendors",
  "AI agents pick the best channel per customer, re-running on every DMS sync",
  "Cross-channel attribution: see exactly which channel drove each appointment",
  "RLS-enforced data isolation — your data never crosses dealership lines",
];

const testimonials = [
  {
    quote: "We replaced three separate vendors — mail house, CRM, and reporting — with AutoCDP. Our service lane retention is up 18% in 90 days.",
    name: "Marcus T.", title: "Fixed Ops Director, Multi-Rooftop Group",
    initials: "MT", stat: "+18%", statLabel: "retention lift",
    statColor: "#059669", statBg: "rgba(16,185,129,0.07)", statBorder: "rgba(16,185,129,0.18)",
    avatarGrad: "linear-gradient(135deg, #059669, #0B1526)",
    avatarRing: "rgba(16,185,129,0.40)",
    channels: ["Direct Mail", "SMS", "Email"],
    hoverClass: "testimonial-emerald",
  },
  {
    quote: "The AI writes better win-back copy than our ad agency did. And it sends automatically the moment a customer goes lapsed. Set it and forget it.",
    name: "Derek S.", title: "General Manager, Franchise Dealership",
    initials: "DS", stat: "3×", statLabel: "mail response rate",
    statColor: "#4338CA", statBg: "rgba(99,102,241,0.07)", statBorder: "rgba(99,102,241,0.18)",
    avatarGrad: "linear-gradient(135deg, #6366F1, #0B1526)",
    avatarRing: "rgba(99,102,241,0.40)",
    channels: ["Direct Mail", "Email"],
    hoverClass: "testimonial-indigo",
  },
  {
    quote: "We ran AutoCDP alongside Fullpath for 60 days. AutoCDP generated 3.4× more service appointments from the same customer list. The QR tracking alone changed how we budget.",
    name: "Kevin P.", title: "Marketing Manager, 3-Store Group",
    initials: "KP", stat: "3.4×", statLabel: "vs. Fullpath",
    statColor: "#0EA5E9", statBg: "rgba(14,165,233,0.07)", statBorder: "rgba(14,165,233,0.18)",
    avatarGrad: "linear-gradient(135deg, #0EA5E9, #0B1526)",
    avatarRing: "rgba(14,165,233,0.40)",
    channels: ["Direct Mail", "SMS"],
    hoverClass: "testimonial-sky",
  },
];

const stats = [
  { value: "18%",  label: "Avg. retention lift",       color: "#059669", arrow: true  },
  { value: "3×",   label: "Response vs. generic mail",  color: "#4338CA", arrow: true  },
  { value: "< 2h", label: "Time to first campaign",     color: "#B45309", arrow: false },
  { value: "0",    label: "Manual steps per send",      color: "#5B21B6", arrow: false },
];

const mockAgents = [
  { name: "Orchestrator", state: "done",    model: "opus-4.7",   dot: "bg-emerald-500",               dotStyle: { boxShadow: "0 0 0 2px rgba(16,185,129,0.22)" } },
  { name: "Data Agent",   state: "done",    model: "sonnet-4.6", dot: "bg-emerald-500",               dotStyle: { boxShadow: "0 0 0 2px rgba(16,185,129,0.22)" } },
  { name: "Targeting",    state: "running", model: "sonnet-4.6", dot: "bg-indigo-400 animate-pulse",  dotStyle: { boxShadow: "0 0 6px rgba(99,102,241,0.55)" } },
  { name: "Creative",     state: "running", model: "sonnet-4.6", dot: "bg-indigo-400 animate-pulse",  dotStyle: { boxShadow: "0 0 6px rgba(99,102,241,0.55)" } },
  { name: "Optimization", state: "idle",    model: "sonnet-4.6", dot: "bg-slate-600",                 dotStyle: {} },
];

const mockStats = [
  { label: "Mail Sent",   value: "1,847", leftBorder: "#0EA5E9", color: "#0284C7", spark: [38, 52, 45, 63, 58, 70, 84] },
  { label: "SMS Sent",    value: "892",   leftBorder: "#8B5CF6", color: "#6D28D9", spark: [45, 58, 52, 67, 71, 79, 88] },
  { label: "Email Open",  value: "41%",   leftBorder: "#10B981", color: "#065F46", spark: [55, 62, 58, 68, 72, 78, 83] },
  { label: "Revenue",     value: "$84k",  leftBorder: "#F59E0B", color: "#92400E", spark: [44, 53, 61, 57, 69, 75, 88] },
];

const MOCK_STAT_CYCLES = [
  [
    { label: "Mail Sent",  value: "1,847", leftBorder: "#0EA5E9", color: "#0284C7", spark: [38, 52, 45, 63, 58, 70, 84] },
    { label: "SMS Sent",   value: "892",   leftBorder: "#8B5CF6", color: "#6D28D9", spark: [45, 58, 52, 67, 71, 79, 88] },
    { label: "Email Open", value: "41%",   leftBorder: "#10B981", color: "#065F46", spark: [55, 62, 58, 68, 72, 78, 83] },
    { label: "Revenue",    value: "$84k",  leftBorder: "#F59E0B", color: "#92400E", spark: [44, 53, 61, 57, 69, 75, 88] },
  ],
  [
    { label: "Mail Sent",  value: "2,013", leftBorder: "#0EA5E9", color: "#0284C7", spark: [52, 45, 63, 58, 70, 78, 91] },
    { label: "SMS Sent",   value: "1,047", leftBorder: "#8B5CF6", color: "#6D28D9", spark: [58, 52, 67, 71, 79, 85, 92] },
    { label: "Email Open", value: "43%",   leftBorder: "#10B981", color: "#065F46", spark: [62, 58, 68, 72, 78, 81, 87] },
    { label: "Revenue",    value: "$91k",  leftBorder: "#F59E0B", color: "#92400E", spark: [53, 61, 57, 69, 75, 82, 94] },
  ],
  [
    { label: "Mail Sent",  value: "1,624", leftBorder: "#0EA5E9", color: "#0284C7", spark: [45, 38, 55, 48, 65, 72, 80] },
    { label: "SMS Sent",   value: "743",   leftBorder: "#8B5CF6", color: "#6D28D9", spark: [38, 50, 45, 60, 65, 74, 83] },
    { label: "Email Open", value: "39%",   leftBorder: "#10B981", color: "#065F46", spark: [48, 54, 50, 62, 68, 75, 80] },
    { label: "Revenue",    value: "$76k",  leftBorder: "#F59E0B", color: "#92400E", spark: [40, 47, 55, 51, 63, 71, 84] },
  ],
];

const mockCampaigns = [
  { name: "Win-back SMS · Q2",      pct: 84, sent: "892",   dotColor: "#8B5CF6" },
  { name: "Service Email — May",    pct: 61, sent: "1,243", dotColor: "#10B981" },
  { name: "Direct Mail — Conquest", pct: 37, sent: "504",   dotColor: "#0EA5E9" },
];

// ── Live cycling data ─────────────────────────────────────────

type AgentRow = { name: string; state: string; dot: string; dotStyle: React.CSSProperties };

const AGENT_CYCLES: AgentRow[][] = [
  [
    { name: "Orchestrator", state: "done",    dot: "bg-emerald-500",              dotStyle: { boxShadow: "0 0 0 2px rgba(16,185,129,0.22)" } },
    { name: "Data Agent",   state: "done",    dot: "bg-emerald-500",              dotStyle: { boxShadow: "0 0 0 2px rgba(16,185,129,0.22)" } },
    { name: "Targeting",    state: "running", dot: "bg-indigo-400 animate-pulse", dotStyle: { boxShadow: "0 0 6px rgba(99,102,241,0.55)" } },
    { name: "Creative",     state: "running", dot: "bg-indigo-400 animate-pulse", dotStyle: { boxShadow: "0 0 6px rgba(99,102,241,0.55)" } },
    { name: "Optimization", state: "idle",    dot: "bg-slate-600",                dotStyle: {} },
  ],
  [
    { name: "Orchestrator", state: "done",    dot: "bg-emerald-500",              dotStyle: { boxShadow: "0 0 0 2px rgba(16,185,129,0.22)" } },
    { name: "Data Agent",   state: "done",    dot: "bg-emerald-500",              dotStyle: { boxShadow: "0 0 0 2px rgba(16,185,129,0.22)" } },
    { name: "Targeting",    state: "done",    dot: "bg-emerald-500",              dotStyle: { boxShadow: "0 0 0 2px rgba(16,185,129,0.22)" } },
    { name: "Creative",     state: "done",    dot: "bg-emerald-500",              dotStyle: { boxShadow: "0 0 0 2px rgba(16,185,129,0.22)" } },
    { name: "Optimization", state: "running", dot: "bg-violet-400 animate-pulse", dotStyle: { boxShadow: "0 0 6px rgba(139,92,246,0.55)" } },
  ],
  [
    { name: "Orchestrator", state: "running", dot: "bg-indigo-400 animate-pulse", dotStyle: { boxShadow: "0 0 6px rgba(99,102,241,0.55)" } },
    { name: "Data Agent",   state: "running", dot: "bg-indigo-400 animate-pulse", dotStyle: { boxShadow: "0 0 6px rgba(99,102,241,0.55)" } },
    { name: "Targeting",    state: "idle",    dot: "bg-slate-600",                dotStyle: {} },
    { name: "Creative",     state: "idle",    dot: "bg-slate-600",                dotStyle: {} },
    { name: "Optimization", state: "done",    dot: "bg-emerald-500",              dotStyle: { boxShadow: "0 0 0 2px rgba(16,185,129,0.22)" } },
  ],
];

const TICKER_EVENTS = [
  [
    { text: "↑ SMS: 47 sent",       color: "#34D399" },
    { text: "Email opens: 23",       color: "#818CF8" },
    { text: "Mail in-transit: 504",  color: "#38BDF8" },
  ],
  [
    { text: "↑ QR scan: Marcus C.",  color: "#34D399" },
    { text: "Email click: Sarah M.", color: "#818CF8" },
    { text: "SMS reply: David K.",   color: "#F59E0B" },
  ],
  [
    { text: "↑ Win-back: 3 booked", color: "#34D399" },
    { text: "Mail delivered: 127",   color: "#38BDF8" },
    { text: "Open rate: 41.2%",      color: "#818CF8" },
  ],
];

const integrations = [
  { name: "CDK Fortellis",       abbr: "CDK"  },
  { name: "Reynolds & Reynolds", abbr: "R&R"  },
  { name: "PostGrid",            abbr: "PG"   },
  { name: "Anthropic Claude",    abbr: "AI"   },
  { name: "Twilio",              abbr: "SMS"  },
  { name: "Resend",              abbr: "✉"    },
  { name: "USPS",                abbr: "USPS" },
  { name: "Stripe",              abbr: "Pay"  },
];

// ── Page ──────────────────────────────────────────────────────

export default function LandingPage() {
  const [agentIdx, setAgentIdx] = useState(0);
  const [tickerIdx, setTickerIdx] = useState(0);
  const [tickerKey, setTickerKey] = useState(0);
  const [statsIdx, setStatsIdx] = useState(0);
  const [countdown, setCountdown] = useState({ d: 9, h: 14, m: 33 });
  const [nextCampaign, setNextCampaign] = useState({ h: 4, m: 12, s: 7 });

  useEffect(() => {
    const aId = setInterval(() => setAgentIdx(i => (i + 1) % AGENT_CYCLES.length), 3200);
    const tId = setInterval(() => {
      setTickerIdx(i => (i + 1) % TICKER_EVENTS.length);
      setTickerKey(k => k + 1);
      setStatsIdx(i => (i + 1) % MOCK_STAT_CYCLES.length);
    }, 4000);
    return () => { clearInterval(aId); clearInterval(tId); };
  }, []);

  useEffect(() => {
    const target = new Date("2026-05-01T09:00:00-05:00").getTime();
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) return;
      setCountdown({ d: Math.floor(diff / 86400000), h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000) });
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setNextCampaign(prev => {
        let { h, m, s } = prev;
        s -= 1;
        if (s < 0) { s = 59; m -= 1; }
        if (m < 0) { m = 59; h -= 1; }
        if (h < 0) { h = 4; m = 12; s = 7; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const liveAgents = AGENT_CYCLES[agentIdx];
  const liveTicker = TICKER_EVENTS[tickerIdx];
  const liveStats  = MOCK_STAT_CYCLES[statsIdx];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Announcement bar ──────────────────────────────── */}
      <div className="relative py-2.5 px-4 text-center" style={{ background: "#060D18" }}>
        <div className="flex items-center justify-center gap-2.5 text-xs font-medium">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-white/50">Pilot results:</span>
          <span className="text-white/80">Dealers average <strong className="text-emerald-400 font-bold">+18% service retention</strong> in 90 days — <span className="text-white/60 font-normal">3 channels, zero extra vendors</span></span>
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
                background: "linear-gradient(135deg, #4F46E5 0%, #0B1526 100%)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.10)",
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
        <div className="absolute inset-0 hero-grid" style={{ opacity: 0.55 }} />

        {/* Deep indigo radial from top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 85% 50% at 50% -8%, rgba(99,102,241,0.14), transparent 62%)" }}
        />

        {/* Right ambient glow */}
        <div
          className="absolute -top-32 right-0 w-[700px] h-[600px] rounded-full blur-3xl translate-x-1/3 pointer-events-none"
          style={{ background: "rgba(99,102,241,0.07)" }}
        />

        {/* Emerald bottom glow */}
        <div
          className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "rgba(16,185,129,0.05)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 pointer-events-none"
          style={{ background: "rgba(16,185,129,0.05)" }}
        />

        {/* Subtle violet upper-left bloom */}
        <div
          className="absolute top-0 -left-32 w-[560px] h-[420px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "rgba(139,92,246,0.05)" }}
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
                  boxShadow: "0 0 0 3px rgba(16,185,129,0.06)",
                }}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live · SMS · Email · Direct Mail · All running now
              </div>

              {/* Channel pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { icon: Mail,           label: "Direct Mail", color: "#0EA5E9", bg: "rgba(14,165,233,0.10)", border: "rgba(14,165,233,0.30)" },
                  { icon: MessageSquare,  label: "SMS",         color: "#8B5CF6", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.30)" },
                  { icon: AtSign,         label: "Email",       color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.30)" },
                ].map((ch) => (
                  <div
                    key={ch.label}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
                    style={{ background: ch.bg, border: `1px solid ${ch.border}`, color: ch.color }}
                  >
                    <ch.icon className="w-3 h-3" />
                    {ch.label}
                  </div>
                ))}
              </div>

              <h1
                className="text-[2.75rem] sm:text-[3.4rem] xl:text-[3.85rem] font-black leading-[1.04] tracking-[-0.034em] mb-6"
                style={{ color: "#0F172A" }}
              >
                Turn your DMS data into
                <br />
                <span className="gradient-text">service appointments.</span>
              </h1>

              <p className="text-[17px] sm:text-[18px] leading-[1.68] mb-8 max-w-lg" style={{ color: "#64748B" }}>
                Five AI agents monitor your DMS 24/7 — writing, sending, and self-optimizing{" "}
                <span style={{ color: "#334155", fontWeight: 600 }}>personalized SMS, email, and QR-tracked direct mail</span>{" "}
                the moment a customer trigger fires.{" "}
                <span style={{ color: "#334155", fontWeight: 600 }}>No manual steps. No extra vendors.</span>{" "}
                Your competitors are still doing this by hand.
              </p>

              {/* CTA row */}
              <div className="flex flex-col sm:flex-row gap-3 mb-7">
                <Link
                  href="/signup"
                  className="btn-press btn-beacon inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold text-[15px] transition-all"
                  style={{
                    background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                    boxShadow: "0 8px 28px -4px rgba(79,70,229,0.55), inset 0 1px 0 rgba(255,255,255,0.12)",
                  }}
                >
                  Start free trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/demo"
                  className="btn-press inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-[15px] transition-all"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(15,23,42,0.12)",
                    color: "#334155",
                    boxShadow: "0 1px 3px 0 rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                >
                  <div
                    className="play-ring w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.22)" }}
                  >
                    <Play className="w-2.5 h-2.5 text-indigo-600 ml-0.5" fill="currentColor" />
                  </div>
                  Watch 60-sec demo
                </Link>
              </div>

              {/* Trust signals — horizontal icon + label + sub */}
              <div className="flex flex-col sm:flex-row gap-2 mb-9 max-w-lg">
                {[
                  { icon: CheckCircle2, label: "No credit card",  sub: "Start immediately",   color: "#10B981", bg: "rgba(16,185,129,0.08)"  },
                  { icon: Zap,          label: "Live in < 2 hrs", sub: "DMS to first send",   color: "#6366F1", bg: "rgba(99,102,241,0.08)"  },
                  { icon: Shield,       label: "Cancel anytime",  sub: "No long contracts",   color: "#0EA5E9", bg: "rgba(14,165,233,0.08)"  },
                ].map((t) => (
                  <div
                    key={t.label}
                    className="trust-pill-lg flex items-center gap-2.5 px-3.5 py-3.5 rounded-xl flex-1"
                    style={{
                      background: `linear-gradient(145deg, #FFFFFF 50%, ${t.bg} 100%)`,
                      border: "1px solid rgba(15,23,42,0.08)",
                      borderLeft: `3px solid ${t.color}`,
                      boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.bg, border: `1px solid ${t.color}22` }}>
                      <t.icon className="w-4 h-4" style={{ color: t.color }} />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold leading-none" style={{ color: "#0F172A" }}>{t.label}</p>
                      <p className="text-[10.5px] font-medium mt-0.5" style={{ color: "#94A3B8" }}>{t.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile-only live stats preview (mockup hidden on mobile) */}
              <div className="xl:hidden grid grid-cols-2 gap-2 mb-7">
                {[
                  { value: "1,847", label: "Mail sent today",  color: "#0EA5E9", bg: "rgba(14,165,233,0.07)" },
                  { value: "892",   label: "SMS delivered",    color: "#8B5CF6", bg: "rgba(139,92,246,0.07)" },
                  { value: "41%",   label: "Email open rate",  color: "#10B981", bg: "rgba(16,185,129,0.07)" },
                  { value: "$84k",  label: "Rev. attributed",  color: "#F59E0B", bg: "rgba(245,158,11,0.07)" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl p-3 text-center"
                    style={{ background: s.bg, border: "1px solid rgba(15,23,42,0.06)" }}
                  >
                    <p className="text-[20px] font-black tabular-nums leading-none mb-0.5" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[9px] font-semibold leading-tight" style={{ color: "#94A3B8" }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Social proof */}
              <div
                className="flex items-center gap-4 pt-6"
                style={{ borderTop: "1px solid rgba(15,23,42,0.07)" }}
              >
                <div className="flex -space-x-2">
                  {[
                    { i: "MT", bg: "#0B1526" }, { i: "DS", bg: "#6366F1" },
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
                className="absolute -inset-12 rounded-3xl pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 55% 45%, rgba(99,102,241,0.11), transparent 65%)" }}
              />

              <div className="relative animate-float-slow">
                {/* Main window */}
                <div className="rounded-2xl overflow-hidden mockup-shadow">

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
                  <div className="flex relative" style={{ background: "#F3F6FA", minHeight: 380 }}>

                    {/* Scan-line overlay for depth */}
                    <div className="absolute inset-0 scan-overlay z-10" />

                    {/* Sidebar */}
                    <div className="w-[132px] shrink-0 flex flex-col relative z-20" style={{ background: "#0B1526" }}>
                      <div
                        className="flex items-center gap-2 px-3 py-3"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center"
                          style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)", border: "1px solid rgba(255,255,255,0.12)" }}
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
                                style={{ background: "#10B981", boxShadow: "0 0 8px rgba(16,185,129,0.6)" }}
                              />
                            )}
                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: item.active ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.10)" }} />
                            {item.label}
                          </div>
                        ))}
                        <div className="px-2 pt-2 pb-0.5 text-[7px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.18)" }}>Channels</div>
                        {[
                          { label: "SMS",         dot: "#8B5CF6" },
                          { label: "Email",       dot: "#10B981" },
                          { label: "Direct Mail", dot: "#0EA5E9" },
                          { label: "Analytics",   dot: "rgba(255,255,255,0.15)" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[9px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.dot }} />
                            {item.label}
                          </div>
                        ))}
                      </div>

                      <div className="p-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[6px] font-bold shrink-0"
                            style={{ background: "#4338CA" }}
                          >MT</div>
                          <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.35)" }}>Marcus T.</span>
                        </div>
                      </div>
                    </div>

                    {/* Main content */}
                    <div className="flex-1 flex flex-col overflow-hidden relative z-20">
                      {/* Header */}
                      <div
                        className="flex items-center justify-between px-4 py-2.5"
                        style={{ background: "rgba(255,255,255,0.97)", borderBottom: "1px solid rgba(15,23,42,0.07)" }}
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
                          >MT</div>
                        </div>
                      </div>

                      <div className="flex-1 p-3 space-y-2 overflow-hidden">

                        {/* Stat cards with sparklines */}
                        <div className="grid grid-cols-4 gap-1.5">
                          {liveStats.map((s) => (
                            <div
                              key={`${tickerKey}-${s.label}`}
                              className="rounded-lg p-2 relative overflow-hidden stat-card-flash"
                              style={{
                                background: `linear-gradient(145deg, #FFFFFF 0%, rgba(248,250,252,0.9) 100%)`,
                                border: `1px solid rgba(15,23,42,0.08)`,
                                borderTop: `2px solid ${s.leftBorder}`,
                                boxShadow: "0 2px 6px -1px rgba(15,23,42,0.07)",
                              }}
                            >
                              <p className="text-[7px] font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>{s.label}</p>
                              <p className="text-[13px] font-black mt-0.5 tabular-nums" style={{ color: s.color }}>{s.value}</p>
                              <MiniSpark bars={s.spark} color={s.leftBorder} animKey={tickerKey} />
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
                              {mockCampaigns.map((c, ci) => (
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
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${c.pct}%`,
                                        background: `linear-gradient(90deg, ${c.dotColor}aa, ${c.dotColor})`,
                                        transformOrigin: "left",
                                        animation: `bar-scale-in 1s cubic-bezier(0.34, 1.56, 0.64, 1) ${ci * 0.28 + 0.15}s both`,
                                      }}
                                    />
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
                              {liveAgents.map((a) => (
                                <div
                                  key={a.name}
                                  className="flex items-center gap-1.5 px-1.5 py-1 rounded"
                                  style={a.state === "running"
                                    ? { background: "rgba(99,102,241,0.07)", borderRadius: "5px" }
                                    : {}}
                                >
                                  <div
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.dot}`}
                                    style={a.dotStyle}
                                  />
                                  <span
                                    className="text-[8px] flex-1 truncate"
                                    style={{
                                      color: a.state === "running" ? "#4338CA" : a.state === "done" ? "#334155" : "#94A3B8",
                                      fontWeight: a.state === "running" ? 700 : a.state === "done" ? 500 : 400,
                                    }}
                                  >{a.name}</span>
                                  <span
                                    className="text-[7px] font-bold tabular-nums"
                                    style={{
                                      color: a.state === "done" ? "#059669" :
                                             a.state === "running" ? "#6366F1" : "#CBD5E1",
                                    }}
                                  >
                                    {a.state === "done" ? "✓" : a.state === "running" ? "···" : "—"}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Live copy preview with typing dots */}
                            <div
                              className="mx-1.5 mb-1.5 p-1.5 rounded-md"
                              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)" }}
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <p className="text-[6px] font-bold uppercase tracking-wider" style={{ color: "#6366F1" }}>Creative · SMS Draft</p>
                                <div className="flex items-end gap-px ml-1" style={{ height: 6 }}>
                                  {[1, 2, 3].map((n) => (
                                    <div key={n} className={`typing-dot w-0.5 rounded-full`} style={{ height: 4, background: "#6366F1" }} />
                                  ))}
                                </div>
                              </div>
                              <p className="text-[7px] leading-relaxed" style={{ color: "#4338CA" }}>
                                SMS: "Hi Marcus, your Tacoma is due for its 30k—"
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
                          <div key={tickerKey} className="flex items-center gap-2.5 text-[8px] overflow-hidden ticker-item">
                            {liveTicker.map((item, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>}
                                <span className="font-semibold" style={{ color: item.color }}>{item.text}</span>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badge: conversions */}
                <div className="absolute -bottom-6 -left-9 animate-float-delayed">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl float-badge">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.20)" }}
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
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl float-badge">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)" }}
                    >
                      <ScanLine className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>QR code scanned</p>
                      <p className="text-[13px] font-black tracking-tight" style={{ color: "#0F172A" }}>Marcus C. — 2m ago</p>
                    </div>
                  </div>
                </div>

                {/* Floating badge: mail sent */}
                <div className="absolute top-[42%] -right-10 animate-float" style={{ animationDelay: "1s" }}>
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl float-badge">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)" }}
                    >
                      <Mail className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-[9px] font-medium" style={{ color: "#94A3B8" }}>PostGrid</p>
                      <p className="text-[11px] font-bold" style={{ color: "#0F172A" }}>Mail fulfilled ✓</p>
                    </div>
                  </div>
                </div>

                {/* Floating badge: win-back booking */}
                <div className="absolute top-[18%] -left-10 animate-float" style={{ animationDelay: "2.4s" }}>
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl float-badge">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.22)" }}
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[9px] font-medium" style={{ color: "#94A3B8" }}>Win-back SMS</p>
                      <p className="text-[11px] font-bold" style={{ color: "#059669" }}>Booked: David K. ✓</p>
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
                <div key={i} className="flex items-center gap-3 shrink-0 group">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(15,23,42,0.10)",
                      boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
                    }}
                  >
                    <span className="text-[8px] font-black" style={{ color: "#475569" }}>{intg.abbr}</span>
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
      <section className="py-20 px-5 sm:px-8 relative overflow-hidden" style={{ background: "#060D18" }}>
        {/* Background grid */}
        <div className="absolute inset-0 dark-grid opacity-50" />
        {/* Centered glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[350px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 65%)" }}
        />
        <div className="relative max-w-5xl mx-auto">
          {/* Label */}
          <div className="flex items-center justify-center gap-2 mb-10">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/10" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.25)" }}>
              Pilot results — updated weekly
            </p>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/10" />
          </div>
          <div
            className="grid grid-cols-2 md:grid-cols-4 rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="px-6 py-10 text-center relative"
                style={{
                  background: "#060D18",
                  borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                  borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                }}
              >
                {/* Top accent */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-full"
                  style={{ background: s.color, opacity: 0.75 }}
                />
                <div className="flex items-start justify-center gap-1.5 mb-2">
                  <div
                    className={`text-[2.8rem] sm:text-[3.2rem] font-black tracking-tight leading-none stat-pop stat-pop-${i + 1} stat-glow`}
                    style={{ color: s.color }}
                  >
                    {s.value}
                  </div>
                  {s.arrow && (
                    <ArrowUp className="w-4 h-4 mt-2 shrink-0" style={{ color: s.color }} />
                  )}
                </div>
                <div className="text-[12px] font-medium leading-snug" style={{ color: "rgba(255,255,255,0.32)" }}>{s.label}</div>
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
              Every channel. One platform. No headcount.
            </h2>
            <p className="text-[17px] max-w-xl mx-auto leading-relaxed" style={{ color: "#64748B" }}>
              SMS, email, and AI-personalized direct mail — all connected to your DMS, all written and sent by AI agents, all tracked in one dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* ── Hero card: AI Swarm — full width ─────────────────── */}
            {(() => {
              const f = features[0];
              return (
                <div
                  key={f.title}
                  className={`feature-card feature-card-premium ${f.glowClass} group col-span-1 sm:col-span-2 lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-card stagger-1 flex flex-col lg:flex-row overflow-hidden`}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2.5px] rounded-t-2xl" style={{ background: f.topColor }} />

                  {/* Left: content */}
                  <div className="p-7 lg:p-9 flex flex-col justify-between flex-1">
                    <div>
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${f.iconBgClass} group-hover:scale-110 transition-transform duration-200`}
                        style={{ boxShadow: "0 2px 6px -2px rgba(0,0,0,0.08)" }}
                      >
                        <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                      </div>
                      <h3 className="font-black text-[19px] mb-2 tracking-tight" style={{ color: "#0F172A" }}>{f.title}</h3>
                      <p className="text-[14px] leading-relaxed max-w-sm" style={{ color: "#64748B" }}>{f.desc}</p>
                    </div>
                    <div
                      className="flex items-baseline gap-2 pt-5 mt-5"
                      style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}
                    >
                      <span className="text-[28px] font-black tracking-tight" style={{ color: f.statColor }}>{f.stat}</span>
                      <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>{f.statLabel}</span>
                    </div>
                  </div>

                  {/* Right: dark mini-agent panel */}
                  <div
                    className="lg:w-[340px] shrink-0 p-6 flex flex-col justify-between"
                    style={{ background: "#0B1526", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-4" style={{ color: "rgba(255,255,255,0.28)" }}>
                        Live agent status
                      </p>
                      <div className="space-y-2.5">
                        {liveAgents.map((a) => (
                          <div
                            key={a.name}
                            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${a.dot}`} style={a.dotStyle} />
                              <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.72)" }}>{a.name}</span>
                            </div>
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                              style={
                                a.state === "done"
                                  ? { background: "rgba(16,185,129,0.12)", color: "#34D399" }
                                  : a.state === "running"
                                  ? { background: "rgba(99,102,241,0.14)", color: "#818CF8" }
                                  : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.28)" }
                              }
                            >
                              {a.state}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div
                      className="mt-5 pt-4"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "rgba(255,255,255,0.28)" }}>
                        Next campaign fires in
                      </p>
                      <p className="text-[22px] font-black tabular-nums" style={{ color: "#818CF8" }}>
                        {String(nextCampaign.h).padStart(2,"0")}h {String(nextCampaign.m).padStart(2,"0")}m{" "}
                        <span className="text-[14px]" style={{ color: "rgba(129,140,248,0.50)" }}>{String(nextCampaign.s).padStart(2,"0")}s</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Remaining 5 feature cards ─────────────────────────── */}
            {features.slice(1).map((f, i) => (
              <div
                key={f.title}
                className={`feature-card feature-card-premium ${f.glowClass} group p-7 rounded-2xl border border-slate-200 bg-white shadow-card stagger-${Math.min(i + 2, 6)}`}
              >
                <div className="absolute top-0 left-0 right-0 h-[2.5px] rounded-t-2xl" style={{ background: f.topColor }} />

                {/* Exclusive badge (Direct Mail only) */}
                {f.badge && (
                  <div className="absolute top-4 right-4">
                    <span
                      className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg"
                      style={{
                        background: f.topColor,
                        color: "#FFFFFF",
                        boxShadow: `0 2px 10px ${f.topColor}55`,
                        letterSpacing: "0.07em",
                      }}
                    >
                      ★ {f.badge}
                    </span>
                  </div>
                )}

                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${f.iconBgClass} group-hover:scale-110 transition-transform duration-200`}
                  style={{ boxShadow: "0 2px 6px -2px rgba(0,0,0,0.08)" }}
                >
                  <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <h3 className="font-bold text-[15px] mb-2 tracking-tight" style={{ color: "#0F172A" }}>{f.title}</h3>
                <p className="text-[13px] leading-relaxed mb-5" style={{ color: "#64748B" }}>{f.desc}</p>
                <div
                  className="flex items-baseline gap-2 pt-4"
                  style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}
                >
                  <span className="text-[22px] font-black tracking-tight" style={{ color: f.statColor }}>{f.stat}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>{f.statLabel}</span>
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
              The AI swarm handles every channel — audience selection, personalized copy, and omnichannel delivery across SMS, email, and direct mail.
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
                    className="text-[3.5rem] font-black tabular-nums leading-none select-none"
                    style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.30) 0%, rgba(99,102,241,0.06) 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
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
                Why dealers switch from Fullpath, CDK, and their mail house to AutoCDP
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
      {/* TESTIMONIALS + COMPARISON  (dark, cinematic)      */}
      {/* ═══════════════════════════════════════════════════ */}
      <section id="results" className="py-24 px-5 sm:px-8 relative overflow-hidden" style={{ background: "#0B1526" }}>

        {/* Background */}
        <div className="absolute inset-0 dark-grid opacity-40" />
        <div
          className="absolute top-0 left-1/4 w-[600px] h-[400px] blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.10) 0%, transparent 65%)" }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[400px] h-[300px] blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, transparent 65%)" }}
        />

        <div className="relative max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center mb-16">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold mb-5 uppercase tracking-widest"
              style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)", color: "#FCD34D" }}
            >
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Real Results
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
              Real results from real dealers
            </h2>
            <p className="text-[17px] font-medium" style={{ color: "#64748B" }}>
              Not projections. Actual outcomes from pilot dealerships.
            </p>
          </div>

          {/* Cinematic testimonial cards */}
          <ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className={`${t.hoverClass} relative p-8 rounded-2xl overflow-hidden`}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {/* Decorative large quote mark */}
                <div
                  className="absolute top-4 right-6 text-[80px] font-black leading-none pointer-events-none select-none"
                  style={{ color: "rgba(99,102,241,0.13)", fontFamily: "Georgia, 'Times New Roman', serif" }}
                >&ldquo;</div>

                {/* Verified chip */}
                <div className="mb-4 relative">
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-bold uppercase tracking-wider"
                    style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.22)", color: "#34D399" }}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Verified pilot dealer
                  </div>
                </div>

                {/* Stars + stat badge */}
                <div className="flex items-start justify-between mb-5 relative">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <div
                    className="px-3.5 py-2 rounded-xl text-right"
                    style={{ background: t.statBg, border: `1px solid ${t.statBorder}` }}
                  >
                    <div className="text-[22px] font-black tracking-tight leading-none" style={{ color: t.statColor }}>{t.stat}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "rgba(255,255,255,0.30)" }}>{t.statLabel}</div>
                  </div>
                </div>

                {/* Quote */}
                <blockquote
                  className="text-[15px] leading-[1.7] mb-7 relative italic"
                  style={{ color: "rgba(255,255,255,0.72)" }}
                >
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                {/* Author */}
                <div
                  className="flex items-center gap-3 pt-5"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{
                      background: t.avatarGrad,
                      boxShadow: `0 0 0 2px ${t.avatarRing}, 0 0 0 4px ${t.avatarRing.replace("0.40", "0.10")}`,
                    }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white">{t.name}</p>
                    <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>{t.title}</p>
                  </div>
                </div>
                {/* Channels used */}
                <div className="flex items-center gap-1.5 flex-wrap mt-3">
                  {t.channels.map((ch: string) => (
                    <span
                      key={ch}
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.38)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          </ScrollReveal>

          {/* Comparison table — dark version */}
          <ScrollReveal delay={120}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div
              className="px-6 py-4"
              style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.28)" }}>
                AutoCDP vs. traditional approaches
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {[
                {
                  label: "Legacy Mail House",
                  items: ["Mail only — no SMS or email", "Generic batch copy", "No QR or click tracking", "30-day manual cycles"],
                  ok: false,
                },
                {
                  label: "Fullpath / CDK Marketing",
                  items: ["SMS + email only", "Zero direct mail capability", "Per-seat licensing costs", "No self-learning AI"],
                  ok: false,
                },
                {
                  label: "AutoCDP",
                  items: ["SMS + email + direct mail", "AI-personalized per customer", "QR + click + open tracking", "Self-learning across campaigns"],
                  ok: true,
                },
              ].map((col) => (
                <div
                  key={col.label}
                  className="px-6 py-5"
                  style={col.ok ? { background: "rgba(99,102,241,0.06)" } : {}}
                >
                  <p
                    className="text-[11px] font-bold uppercase tracking-wider mb-4"
                    style={{ color: col.ok ? "#818CF8" : "rgba(255,255,255,0.22)" }}
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
                            className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}
                          >
                            <span className="text-[7px] font-black leading-none" style={{ color: "#EF4444" }}>✕</span>
                          </div>
                        )}
                        <span style={{ color: col.ok ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.28)", fontWeight: col.ok ? 500 : 400 }}>
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          </ScrollReveal>
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

          {/* Social proof mini row */}
          <div className="flex items-center justify-center gap-3 mb-7">
            <div className="flex -space-x-2">
              {[
                { i: "MT", bg: "#0B1526" }, { i: "DS", bg: "#6366F1" }, { i: "KP", bg: "#10B981" },
              ].map((a, idx) => (
                <div
                  key={idx}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ background: a.bg, border: "2px solid #0B1526" }}
                >{a.i}</div>
              ))}
            </div>
            <p className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.40)" }}>
              40+ dealerships in pilot —{" "}
              <span style={{ color: "#34D399", fontWeight: 700 }}>limited spots this month</span>
            </p>
          </div>

          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-[12px] font-bold"
            style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.28)", color: "#FCD34D" }}
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
            </span>
            Next cohort: May 1 · {countdown.d}d {countdown.h}h {countdown.m}m
          </div>

          <h2 className="text-3xl sm:text-[2.8rem] font-black text-white tracking-tight mb-4 leading-tight">
            One platform. Every channel.
            <br />
            <span style={{ color: "#818CF8" }}>Live in under two hours.</span>
          </h2>
          <p className="text-[17px] font-medium mb-10 leading-relaxed max-w-xl mx-auto" style={{ color: "#64748B" }}>
            Connect your DMS, set a goal, and AutoCDP fires SMS, email, and direct mail campaigns the same day — automatically, forever.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link
              href="/signup"
              className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 rounded-xl text-white font-bold text-[15px] transition-all"
              style={{
                background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                boxShadow: "0 0 0 4px rgba(99,102,241,0.18), 0 12px 40px -8px rgba(79,70,229,0.70), inset 0 1px 0 rgba(255,255,255,0.12)",
                letterSpacing: "-0.01em",
              }}
            >
              Start free trial — no card needed <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/demo"
              className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-[15px] transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.80)",
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.10)" }}
              >
                <Play className="w-2.5 h-2.5 text-white ml-0.5" fill="currentColor" />
              </div>
              Watch 60-sec demo
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {["14-day free trial", "Full feature access", "Cancel anytime"].map((item) => (
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
      <footer className="pb-16 sm:pb-0" style={{ background: "#060D18", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #4F46E5, #0B1526)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.10)",
                  }}
                >
                  <Car className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-[15px] tracking-tight text-white">AutoCDP</span>
              </div>
              <p className="text-[13px] leading-relaxed max-w-[200px]" style={{ color: "rgba(255,255,255,0.28)" }}>
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
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: "rgba(255,255,255,0.20)" }}>
                  {col.heading}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="footer-link text-[13px] font-medium transition-colors"
                        style={{ color: "rgba(255,255,255,0.38)" }}
                      >
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
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.22)" }}>
              © {new Date().getFullYear()} AutoCDP. Built for automotive retail.
            </p>
            <div className="flex items-center gap-2">
              <div
                className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.20)", color: "#34D399" }}
              >
                SOC 2 Type II (in progress)
              </div>
              <div
                className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)", color: "#818CF8" }}
              >
                CCPA compliant
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Mobile sticky CTA ─────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 sm:hidden pb-safe"
        style={{
          background: "rgba(6,13,24,0.97)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div className="flex gap-2.5 p-3">
          <Link
            href="/signup"
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl text-white font-bold text-[14px]"
            style={{
              background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
              boxShadow: "0 6px 20px -4px rgba(79,70,229,0.55)",
            }}
          >
            Start free trial <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
          </Link>
        </div>
      </div>

    </div>
  );
}
