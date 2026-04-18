"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Globe, CheckCircle, Loader2, ArrowRight, Phone, MapPin, Clock } from "lucide-react";

interface ScrapedData {
  name?: string;
  phone?: string;
  address?: string;
  hours?: string;
  logoUrl?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scraped, setScraped] = useState<ScrapedData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    setScraping(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape failed");
      setScraped(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch dealership info");
      // Fallback to manual entry
      setScraped({});
    } finally {
      setScraping(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    // TODO: Save scraped data to dealerships table via API
    await new Promise((r) => setTimeout(r, 1000)); // simulate save
    setSaving(false);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-1.5 rounded-full text-sm font-medium">
            <Car className="w-4 h-4" />
            AutoCDP Setup
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Let&apos;s set up your dealership
          </h1>
          <p className="text-gray-500 max-w-md mx-auto">
            Enter your website URL and we&apos;ll automatically pull your dealership info using AI.
            Takes about 30 seconds.
          </p>
        </div>

        {/* Step 1: URL Input */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center">1</div>
              <CardTitle className="text-base">Enter your dealership website</CardTitle>
            </div>
            <CardDescription>
              We&apos;ll scrape your logo, address, phone number, and hours automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScrape} className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="https://yourdealership.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  type="url"
                  required
                />
              </div>
              <Button type="submit" disabled={scraping || !websiteUrl}>
                {scraping ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning...</>
                ) : (
                  <><Globe className="mr-2 h-4 w-4" /> Scan Site</>
                )}
              </Button>
            </form>

            {error && (
              <p className="mt-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                {error} — Please fill in the details manually below.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Review & Edit */}
        {scraped !== null && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center">2</div>
                <CardTitle className="text-base">Review your dealership info</CardTitle>
                <Badge variant="secondary" className="ml-auto bg-green-50 text-green-700">
                  <CheckCircle className="w-3 h-3 mr-1" /> AI Extracted
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    <Car className="w-3.5 h-3.5 inline mr-1" />
                    Dealership Name
                  </Label>
                  <Input
                    id="name"
                    defaultValue={scraped.name || ""}
                    placeholder="Sunrise Ford"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="w-3.5 h-3.5 inline mr-1" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    defaultValue={scraped.phone || ""}
                    placeholder="(555) 100-2000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />
                  Address
                </Label>
                <Input
                  id="address"
                  defaultValue={scraped.address || ""}
                  placeholder="123 Auto Row, Phoenix, AZ 85001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours">
                  <Clock className="w-3.5 h-3.5 inline mr-1" />
                  Hours
                </Label>
                <Input
                  id="hours"
                  defaultValue={scraped.hours || ""}
                  placeholder="Mon-Fri 8am-6pm, Sat 9am-4pm"
                />
              </div>

              <div className="pt-2">
                <Button onClick={handleSave} className="w-full" size="lg" disabled={saving}>
                  {saving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting up your workspace...</>
                  ) : (
                    <>Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-gray-400">
          You can update this anytime in Settings · Data is stored securely in your private tenant
        </p>
      </div>
    </div>
  );
}
