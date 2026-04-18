"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Car, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { slugify } from "@/lib/utils";

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
        setError("Account created but dealership setup failed. Please contact support.");
        setLoading(false);
        return;
      }

      // Auto-confirm is enabled — go straight to dashboard
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // Fallback if email confirmation is required
    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Check your email</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your AutoCDP account.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-[480px] flex-col justify-between p-12 bg-navy-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/15">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">AutoCDP</span>
          </Link>
        </div>
        <div className="relative space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white leading-snug tracking-tight mb-3">
              Your AI marketing team,<br />fully autonomous.
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Connect your DMS. Set a goal. Your autonomous swarm targets, writes, and mails — then learns from every response.
            </p>
          </div>
          <div className="space-y-3">
            {[
              "Direct mail personalized per customer",
              "Self-optimizing after every campaign",
              "CDK & Reynolds sync every 60 min",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-sm text-slate-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} AutoCDP</p>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-slate-50">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">AutoCDP</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create your account</h1>
            <p className="text-slate-500 text-sm mt-1">Set up AutoCDP for your dealership in 2 minutes.</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="dealership" className="text-sm font-medium text-slate-700">
                Dealership Name
              </label>
              <input
                id="dealership"
                type="text"
                value={dealershipName}
                onChange={(e) => setDealershipName(e.target.value)}
                placeholder="Sunrise Ford"
                required
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors"
              />
              {dealershipName && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Slug: <code className="text-slate-600">{slugify(dealershipName)}</code>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
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
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !dealershipName || !email || !password}
              className="w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center">
            By signing up you agree to our Terms of Service and Privacy Policy.
          </p>

          <p className="text-sm text-slate-500 text-center">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
