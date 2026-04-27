import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, Key, Bell, Shield, Webhook, BookOpen, Gauge } from "lucide-react";
import { SettingsForm } from "@/components/settings/settings-form";
import { TrainingDataSection } from "@/components/settings/training-data";
import { LimitsSection } from "@/components/settings/limits-section";
import type { Dealership } from "@/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ud } = await supabase
    .from("user_dealerships")
    .select("dealership_id, role")
    .eq("user_id", user!.id)
    .single();

  const { data: dealership } = await supabase
    .from("dealerships")
    .select("*")
    .eq("id", ud?.dealership_id ?? "")
    .single() as { data: Dealership | null };

  return (
    <>
      <Header title="Settings" subtitle="Dealership & account configuration" userEmail={user?.email} />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-3xl">
        {/* Dealership profile */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Dealership Profile</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Used in AI-generated messages, direct mail templates, and your account. Re-scrape anytime to refresh from your website.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dealership ? (
              <SettingsForm dealership={dealership} />
            ) : (
              <p className="text-sm text-muted-foreground">No dealership profile found.</p>
            )}
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Integrations & API Keys</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Anthropic API", key: "ANTHROPIC_API_KEY", status: "configured", description: "Required for AI agent swarm" },
              { name: "Lob.com (Direct Mail)", key: "LOB_API_KEY", status: "not_configured", description: "Direct mail fulfillment" },
              { name: "Twilio (SMS)", key: "TWILIO_ACCOUNT_SID", status: "not_configured", description: "SMS campaign delivery" },
              { name: "Resend (Email)", key: "RESEND_API_KEY", status: "not_configured", description: "Email campaign delivery" },
              { name: "Stripe", key: "STRIPE_SECRET_KEY", status: "not_configured", description: "Subscription billing" },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.name}</p>
                    <Badge
                      variant={item.status === "configured" ? "success" : "secondary"}
                      className="text-[10px]"
                    >
                      {item.status === "configured" ? "✓ Configured" : "Not set"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <Button variant="outline" size="sm" className="text-xs h-8 shrink-0">
                  {item.status === "configured" ? "Rotate Key" : "Configure"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Webhooks</CardTitle>
            </div>
            <CardDescription className="text-xs">
              AutoCDP sends webhook events for campaign completions, delivery confirmations, and billing events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Webhook Endpoint URL</Label>
              <div className="flex gap-2">
                <Input placeholder="https://yoursite.com/webhooks/autocdp" type="url" />
                <Button variant="outline" size="sm" className="h-10 shrink-0">Test</Button>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border text-xs font-mono text-muted-foreground">
              POST /api/billing/webhook — Stripe events<br />
              POST /api/onboarding/scrape — Dealership scraper
            </div>
          </CardContent>
        </Card>

        {/* Team */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Team & Permissions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 py-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700">
                {user?.email?.slice(0, 2).toUpperCase() ?? "?"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Owner</p>
              </div>
              <Badge variant="secondary">You</Badge>
            </div>
            <Separator />
            <Button variant="outline" size="sm" className="text-xs h-8">
              + Invite Team Member
            </Button>
          </CardContent>
        </Card>

        {/* Rate Limits & Cost Guards */}
        <Card className="border-0 shadow-sm" id="limits">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Rate Limits &amp; Cost Guards</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Set daily send limits and a spend cap. Limits reset at midnight UTC. Null values use the global defaults.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LimitsSection />
          </CardContent>
        </Card>

        {/* Training Data */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">AI Training Data</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Paste historical direct mail examples so the Creative Agent writes in your dealership&apos;s proven style.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrainingDataSection />
          </CardContent>
        </Card>

        {/* Notifications placeholder */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {["Campaign launched", "Campaign completed", "Agent run failed", "Monthly billing summary"].map((n) => (
              <div key={n} className="flex items-center justify-between py-1">
                <span className="text-sm">{n}</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded" />
                    Email
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" className="rounded" />
                    SMS
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
