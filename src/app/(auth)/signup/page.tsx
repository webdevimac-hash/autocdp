"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Loader2 } from "lucide-react";
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
      // Call server action to provision dealership + user_dealerships row
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
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-green-600">Check your email!</CardTitle>
            <CardDescription>
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
              AutoCDP account, then sign in.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/login">Go to Sign In</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl backdrop-blur-sm">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AutoCDP</h1>
          <p className="text-blue-200 text-sm">Start your free trial</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription>Set up AutoCDP for your dealership in 2 minutes</CardDescription>
          </CardHeader>

          <form onSubmit={handleSignup}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="dealership">Dealership Name</Label>
                <Input
                  id="dealership"
                  placeholder="Sunrise Ford"
                  value={dealershipName}
                  onChange={(e) => setDealershipName(e.target.value)}
                  required
                />
                {dealershipName && (
                  <p className="text-xs text-muted-foreground">
                    Slug: <code>{slugify(dealershipName)}</code>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@dealership.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || !dealershipName}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By signing up you agree to our Terms of Service and Privacy Policy.
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
