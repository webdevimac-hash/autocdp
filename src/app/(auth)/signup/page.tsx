"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Car,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Mail,
  MessageSquare,
  Target,
  Database,
  Bot,
  Sparkles,
  TrendingUp,
  BarChart3,
  Building2,
} from "lucide-react";
import { slugify } from "@/lib/utils";

const NAVY_DEEPER = "#060D18";
const EMERALD = "#10B981";

const FLOATING_TILES = [
  { Icon: Mail, top: "8%", left: "6%", size: 84, rotate: -10, tone: "#34D399", delay: 0 },
  { Icon: MessageSquare, top: "18%", left: "78%", size: 96, rotate: 8, tone: "#A78BFA", delay: 0.6 },
  { Icon: Bot, top: "62%", left: "4%", size: 110, rotate: -6, tone: "#38BDF8", delay: 1.2 },
  { Icon: Target, top: "70%", left: "82%", size: 90, rotate: 12, tone: "#FBBF24", delay: 0.3 },
  { Icon: Database, top: "44%", left: "88%", size: 72, rotate: -8, tone: "#F472B6", delay: 0.9 },
  { Icon: TrendingUp, top: "78%", left: "44%", size: 80, rotate: 6, tone: "#34D399", delay: 1.5 },
  { Icon: Sparkles, top: "12%", left: "44%", size: 70, rotate: -4, tone: "#A78BFA", delay: 0.4 },
  { Icon: BarChart3, top: "30%", left: "18%", size: 78, rotate: 10, tone: "#38BDF8", delay: 0.8 },
];

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [dealershipName, setDealershipName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          dealership_name: dealershipName,
          dealership_slug: slugify(dealershipName),
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (signUpData.user) {
      const res = await fetch("/api/onboarding/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: signUpData.user.id,
          dealershipName,
          dealershipSlug: slugify(dealershipName),
        }),
      });

      if (!res.ok) {
        setError(
          "Account created but dealership setup failed. Please contact support.",
        );
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: NAVY_DEEPER, color: "#E2E8F0" }}
    >
      {/* ─── Background ────────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(0,0,0,1), transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(0,0,0,1), transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 -top-32 h-[420px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(16,185,129,0.18), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full blur-3xl pointer-events-none"
        style={{ background: "rgba(99,102,241,0.10)" }}
      />
      <div
        aria-hidden
        className="absolute -top-40 -left-40 w-[460px] h-[460px] rounded-full blur-3xl pointer-events-none"
        style={{ background: "rgba(56,189,248,0.08)" }}
      />
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        {FLOATING_TILES.map(({ Icon, top, left, size, rotate, tone, delay }, i) => (
          <div
            key={i}
            className="absolute rounded-2xl flex items-center justify-center auth-floating-tile"
            style={{
              top,
              left,
              width: size,
              height: size,
              transform: `rotate(${rotate}deg)`,
              background: `linear-gradient(155deg, ${tone}10 0%, ${tone}05 60%, transparent 100%)`,
              border: `1px solid ${tone}1A`,
              boxShadow: `0 1px 0 0 rgba(255,255,255,0.04) inset, 0 18px 40px -20px ${tone}33`,
              animationDelay: `${delay}s`,
              opacity: 0.55,
            }}
          >
            <Icon
              className="opacity-50"
              style={{
                color: tone,
                width: size * 0.32,
                height: size * 0.32,
                strokeWidth: 1.5,
              }}
            />
          </div>
        ))}
      </div>

      {/* ─── Card ──────────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-[440px]">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center justify-center gap-2.5 mb-7 group"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-[1.03]"
            style={{
              background: `linear-gradient(135deg, ${EMERALD} 0%, #0EA5E9 100%)`,
              boxShadow:
                "0 8px 24px -6px rgba(16,185,129,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 1px 0 0 rgba(255,255,255,0.18) inset",
            }}
          >
            <Car className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-[18px] tracking-tight text-white">
            AutoCDP
          </span>
        </Link>

        {success ? (
          /* ── Email-confirmation state ─────────────────────────────── */
          <div
            className="relative rounded-2xl p-9 text-center"
            style={{
              background:
                "linear-gradient(180deg, rgba(15,26,46,0.92) 0%, rgba(6,13,24,0.96) 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 40px 100px -28px rgba(0,0,0,0.7)",
            }}
          >
            <div
              aria-hidden
              className="absolute inset-x-9 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(16,185,129,0.7), transparent)",
              }}
            />
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{
                background: "rgba(16,185,129,0.10)",
                border: "1px solid rgba(16,185,129,0.30)",
                boxShadow: "0 0 0 4px rgba(16,185,129,0.06)",
              }}
            >
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-white mb-2">
              Check your email
            </h1>
            <p className="text-[13.5px] text-white/60 leading-relaxed mb-6">
              We sent a confirmation link to{" "}
              <strong className="text-white">{email}</strong>. Click it to
              activate your AutoCDP account.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full h-11 rounded-xl text-white text-[14px] font-bold"
              style={{
                background: `linear-gradient(135deg, ${EMERALD} 0%, #059669 100%)`,
                boxShadow:
                  "0 12px 28px -8px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.20)",
              }}
            >
              Go to Sign In
              <ArrowRight className="ml-1.5 w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* ── Signup form ─────────────────────────────────────────── */
          <div
            className="relative rounded-2xl p-8 sm:p-9"
            style={{
              background:
                "linear-gradient(180deg, rgba(15,26,46,0.92) 0%, rgba(6,13,24,0.96) 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 40px 100px -28px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.4)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <div
              aria-hidden
              className="absolute inset-x-9 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(16,185,129,0.7), transparent)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 rounded-2xl opacity-[0.30]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0)",
                backgroundSize: "12px 12px",
                maskImage:
                  "radial-gradient(ellipse at 70% 30%, rgba(0,0,0,1), transparent 70%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse at 70% 30%, rgba(0,0,0,1), transparent 70%)",
              }}
            />

            <div className="relative mb-7 text-center">
              <h1 className="text-[22px] font-bold tracking-tight text-white">
                Create your account
              </h1>
              <p className="mt-1.5 text-[13px] text-white/55">
                Set up AutoCDP for your dealership in 2 minutes.
              </p>
            </div>

            <form onSubmit={handleSignup} className="relative space-y-4">
              {error && (
                <div
                  className="flex items-start gap-2.5 p-3 rounded-lg text-[12.5px]"
                  style={{
                    background: "rgba(239,68,68,0.10)",
                    border: "1px solid rgba(239,68,68,0.30)",
                    color: "#FCA5A5",
                  }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Dealership name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="dealership"
                  className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65 flex items-center gap-1.5"
                >
                  <Building2 className="w-3 h-3" />
                  Dealership Name
                </label>
                <input
                  id="dealership"
                  type="text"
                  value={dealershipName}
                  onChange={(e) => setDealershipName(e.target.value)}
                  placeholder="Sunrise Ford"
                  required
                  className="auth-input w-full h-11 px-3.5 rounded-xl text-[14px] text-white placeholder:text-white/35 transition-all focus:outline-none"
                />
                {dealershipName && (
                  <p className="text-[10.5px] text-white/40 mt-1">
                    Workspace:{" "}
                    <code className="text-emerald-300 font-mono">
                      {slugify(dealershipName)}
                    </code>
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65"
                >
                  Work Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@dealership.com"
                  required
                  autoComplete="email"
                  className="auth-input w-full h-11 px-3.5 rounded-xl text-[14px] text-white placeholder:text-white/35 transition-all focus:outline-none"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="auth-input w-full h-11 px-3.5 rounded-xl text-[14px] text-white placeholder:text-white/35 transition-all focus:outline-none"
                />
              </div>

              {/* CTA */}
              <button
                type="submit"
                disabled={loading || !dealershipName || !email || !password}
                className="group relative w-full h-12 rounded-xl text-white text-[14px] font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:translate-y-[-1px] mt-1"
                style={{
                  background: `linear-gradient(135deg, ${EMERALD} 0%, #059669 100%)`,
                  boxShadow:
                    "0 12px 28px -8px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.20)",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-white/40 text-center pt-1">
                By signing up you agree to our{" "}
                <Link href="/terms" className="text-white/65 hover:text-white">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-white/65 hover:text-white">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          </div>
        )}

        {!success && (
          <p className="mt-6 text-center text-[13px] text-white/55">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        )}

        <p className="mt-3 text-center text-[11px] text-white/30">
          © {new Date().getFullYear()} AutoCDP · Built for dealerships
        </p>
      </div>
    </div>
  );
}
