"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Car, Globe, CheckCircle, Loader2, ArrowRight,
  Phone, MapPin, Clock, Image as ImageIcon, AlertTriangle,
  Sparkles,
} from "lucide-react";

interface HoursMap {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

interface AddressMap {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface ScrapedData {
  name: string;
  phone: string;
  address: AddressMap;
  hours: HoursMap;
  logoUrl: string;
  ctas: string[];
  confidence: "low" | "medium" | "high" | "none";
}

const HOUR_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state — populated from scrape, editable
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hours, setHours] = useState<HoursMap>({});
  const [confidence, setConfidence] = useState<ScrapedData["confidence"] | null>(null);
  const [ctas, setCtas] = useState<string[]>([]);
  const [scraped, setScraped] = useState(false);
  const [logoError, setLogoError] = useState(false);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    setScraping(true);
    setScrapeError(null);
    setLogoError(false);

    try {
      const res = await fetch("/api/onboarding/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });
      const data: ScrapedData = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error || "Scrape failed");

      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setStreet(data.address?.street ?? "");
      setCity(data.address?.city ?? "");
      setState(data.address?.state ?? "");
      setZip(data.address?.zip ?? "");
      setLogoUrl(data.logoUrl ?? "");
      setHours(data.hours ?? {});
      setCtas(data.ctas ?? []);
      setConfidence(data.confidence ?? "low");
      setScraped(true);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Failed to fetch dealership info");
      setScraped(true); // show manual entry fields anyway
    } finally {
      setScraping(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) { setSaveError("Dealership name is required."); return; }
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/dealership/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          website_url: websiteUrl.trim() || null,
          logo_url: logoUrl.trim() || null,
          address: { street, city, state, zip },
          hours,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      router.push("/dashboard/onboard/wizard");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const confidenceColor =
    confidence === "high" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    confidence === "medium" ? "bg-sky-50 text-sky-700 border-sky-200" :
    "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-medium">
            <Car className="w-4 h-4" />
            AutoCDP Setup
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Let&apos;s set up your dealership</h1>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            Enter your website URL and we&apos;ll automatically pull your logo, address, phone, and hours using AI.
          </p>
        </div>

        {/* Step 1: URL Input */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center">1</div>
              <CardTitle className="text-base">Enter your dealership website</CardTitle>
            </div>
            <CardDescription className="text-xs">
              We&apos;ll scrape your logo, address, phone, hours of operation, and key CTAs automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScrape} className="flex gap-3">
              <Input
                className="flex-1"
                placeholder="https://toyotaoftampabay.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                type="url"
                required
              />
              <Button type="submit" disabled={scraping || !websiteUrl} className="shrink-0">
                {scraping
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scanning…</>
                  : <><Globe className="mr-2 h-4 w-4" />Scan Site</>}
              </Button>
            </form>
            {scrapeError && (
              <div className="mt-3 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {scrapeError} — Fill in details manually below.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Review & Edit */}
        {scraped && (
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center">2</div>
                <CardTitle className="text-base">Review your dealership info</CardTitle>
                {confidence && confidence !== "none" && (
                  <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${confidenceColor}`}>
                    <Sparkles className="w-2.5 h-2.5 inline mr-1" />
                    {confidence} confidence
                  </span>
                )}
              </div>
              <CardDescription className="text-xs">
                Review and correct the AI-extracted data before saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Logo preview */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" /> Logo URL
                </Label>
                <div className="flex gap-3 items-start">
                  <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                    {logoUrl && !logoError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-full h-full object-contain p-1"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <Input
                    className="flex-1 text-xs font-mono"
                    placeholder="https://dealership.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => { setLogoUrl(e.target.value); setLogoError(false); }}
                  />
                </div>
                {logoUrl && logoError && (
                  <p className="text-xs text-amber-600">Logo URL didn&apos;t load — paste a direct image URL (.png, .jpg, .svg)</p>
                )}
                {logoUrl && !logoError && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Logo pulled from site successfully</p>
                )}
              </div>

              {/* Name + Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-slate-400" /> Dealership Name *
                  </Label>
                  <Input placeholder="Toyota of Tampa Bay" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone
                  </Label>
                  <Input placeholder="(813) 555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Address
                </Label>
                <Input placeholder="3101 N Dale Mabry Hwy" value={street} onChange={(e) => setStreet(e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Tampa" value={city} onChange={(e) => setCity(e.target.value)} />
                  <Input placeholder="FL" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} className="uppercase" />
                  <Input placeholder="33607" value={zip} onChange={(e) => setZip(e.target.value)} maxLength={5} />
                </div>
              </div>

              {/* Hours */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Hours of Operation
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {HOUR_DAYS.map((day) => (
                    <div key={day} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-20 shrink-0 capitalize font-medium">{day}</span>
                      <Input
                        className="text-xs h-8"
                        placeholder="8:00 AM – 6:00 PM"
                        value={hours[day] ?? ""}
                        onChange={(e) => setHours((h) => ({ ...h, [day]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              {ctas.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 uppercase tracking-wide">Detected CTAs</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ctas.map((cta) => (
                      <Badge key={cta} variant="secondary" className="text-xs">{cta}</Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">These calls-to-action will be used by the AI when writing campaign copy.</p>
                </div>
              )}

              {saveError && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {saveError}
                </div>
              )}

              <Button onClick={handleSave} className="w-full" size="lg" disabled={saving || !name.trim()}>
                {saving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving your dealership profile…</>
                  : <>Save &amp; Continue to Setup <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-gray-400">
          You can update any of this anytime in Settings · Data is stored securely in your private tenant
        </p>
      </div>
    </div>
  );
}
