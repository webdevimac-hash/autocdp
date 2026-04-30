"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Save, Loader2, Globe, CheckCircle, AlertTriangle,
  Image as ImageIcon, RefreshCw, Info,
} from "lucide-react";
import type { Dealership } from "@/types";

interface SettingsFormProps {
  dealership: Dealership;
}

interface ScrapeResult {
  name: string | null;
  phone: string | null;
  logoUrl: string | null;
  address: { street?: string; city?: string; state?: string; zip?: string } | null;
  hours: Record<string, string> | null;
  confidence: "high" | "medium" | "low";
  fieldsFound: string[];
}

const HOUR_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const styles = {
    high:   "bg-emerald-50 border-emerald-200 text-emerald-700",
    medium: "bg-amber-50 border-amber-200 text-amber-700",
    low:    "bg-orange-50 border-orange-200 text-orange-700",
  };
  const icons = { high: "✓", medium: "~", low: "!" };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${styles[level]}`}>
      {icons[level]} {level.charAt(0).toUpperCase() + level.slice(1)} confidence
    </span>
  );
}

// Format E.164 phone (+1xxxxxxxxxx) for human display — used in placeholder only
function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}

export function SettingsForm({ dealership }: SettingsFormProps) {
  const addr = dealership.address as Record<string, string> ?? {};
  const hrs  = dealership.hours as Record<string, string> ?? {};
  const sett = dealership.settings as Record<string, string> ?? {};

  const [name, setName]           = useState(dealership.name ?? "");
  const [phone, setPhone]         = useState(dealership.phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(dealership.website_url ?? "");
  const [logoUrl, setLogoUrl]     = useState(dealership.logo_url ?? "");
  const [street, setStreet]       = useState(addr.street ?? "");
  const [city, setCity]           = useState(addr.city ?? "");
  const [stateVal, setStateVal]   = useState(addr.state ?? "");
  const [zip, setZip]             = useState(addr.zip ?? "");
  const [hours, setHours]         = useState<Record<string, string>>(hrs);
  const [tone, setTone]           = useState(sett.tone ?? "friendly");

  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  const [scraping, setScraping]     = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [lastScrape, setLastScrape] = useState<ScrapeResult | null>(null);
  const [scrapedFields, setScrapedFields] = useState<Set<string>>(new Set());
  const [logoError, setLogoError]   = useState(false);

  // Clear scraped field highlight after 4s
  function markScraped(fields: string[]) {
    const s = new Set(fields);
    setScrapedFields(s);
    setTimeout(() => setScrapedFields(new Set()), 4000);
  }

  function scrapedClass(field: string) {
    return scrapedFields.has(field)
      ? "ring-1 ring-emerald-400 border-emerald-300 transition-all duration-500"
      : "";
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
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
          address: { street, city, state: stateVal, zip },
          hours,
          settings: { ...sett, tone },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRescrape() {
    if (!websiteUrl.trim()) {
      setScrapeError("Enter a website URL above first.");
      return;
    }
    setScraping(true);
    setScrapeError(null);
    setLastScrape(null);
    setLogoError(false);
    try {
      const res = await fetch("/api/onboarding/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });
      const data: ScrapeResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");

      const populated: string[] = [];

      if (data.name) { setName(data.name); populated.push("name"); }
      if (data.phone) { setPhone(data.phone); populated.push("phone"); }
      if (data.logoUrl) { setLogoUrl(data.logoUrl); setLogoError(false); populated.push("logoUrl"); }
      if (data.address?.street) { setStreet(data.address.street); populated.push("address"); }
      if (data.address?.city)   setCity(data.address.city);
      if (data.address?.state)  setStateVal(data.address.state);
      if (data.address?.zip)    setZip(data.address.zip);
      if (data.hours) { setHours(data.hours); populated.push("hours"); }

      setLastScrape({ ...data, fieldsFound: populated });
      markScraped(populated);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setScraping(false);
    }
  }

  const fieldLabels: Record<string, string> = {
    name: "Name", phone: "Phone", logoUrl: "Logo", address: "Address", hours: "Hours",
  };

  return (
    <div className="space-y-5">

      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" /> Dealership Logo
        </Label>
        <div className="flex gap-3 items-start">
          <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl && !logoError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Dealership logo"
                className="w-full h-full object-contain p-1"
                onError={() => setLogoError(true)}
              />
            ) : (
              <ImageIcon className="w-6 h-6 text-slate-300" />
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <Input
              placeholder="https://yourdealership.com/logo.png"
              value={logoUrl}
              onChange={(e) => { setLogoUrl(e.target.value); setLogoError(false); }}
              className={`text-xs font-mono ${scrapedClass("logoUrl")}`}
            />
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" />
              Direct image URL (.png, .jpg, .svg, .webp). Used in direct mail letterhead and AI context.
            </p>
            {logoUrl && logoError && (
              <p className="text-xs text-amber-600">Couldn&apos;t load this URL — check the image link.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Website + Re-scrape button ────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" /> Website URL
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://yourdealership.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            type="url"
            className="flex-1"
          />
          <Button
            variant="default"
            size="sm"
            className="h-10 shrink-0 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleRescrape}
            disabled={scraping}
            title="Re-scrape anytime to refresh dealership info from your website"
          >
            {scraping
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Scanning…</>
              : <><RefreshCw className="w-3.5 h-3.5" />Re-scrape</>}
          </Button>
        </div>

        {/* Scrape success summary */}
        {lastScrape && !scrapeError && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs text-emerald-700 font-medium">Re-scraped</span>
            <ConfidenceBadge level={lastScrape.confidence} />
            {lastScrape.fieldsFound.length > 0 && (
              <span className="text-xs text-emerald-600">
                Updated: {lastScrape.fieldsFound.map(f => fieldLabels[f] ?? f).join(", ")}
              </span>
            )}
            {lastScrape.fieldsFound.length < 5 && (
              <span className="text-xs text-slate-500">
                · Not found: {(["name","phone","logoUrl","address","hours"] as const)
                  .filter(f => !lastScrape.fieldsFound.includes(f))
                  .map(f => fieldLabels[f])
                  .join(", ")}
              </span>
            )}
          </div>
        )}

        {/* Scrape error */}
        {scrapeError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className="text-xs text-red-700">{scrapeError}</span>
          </div>
        )}

        <p className="text-[10px] text-slate-400 flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" />
          Re-scrape anytime to refresh from your website. Fields below will auto-fill — review before saving.
        </p>
      </div>

      {/* ── Name + Phone ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Dealership Name</Label>
          <Input
            placeholder="Toyota of Tampa Bay"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={scrapedClass("name")}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Phone Number</Label>
          <Input
            placeholder="(813) 555-0100"
            value={phone ? (phone.startsWith("+1") ? formatPhoneDisplay(phone) : phone) : ""}
            onChange={(e) => setPhone(e.target.value)}
            className={scrapedClass("phone")}
          />
          {phone?.startsWith("+1") && (
            <p className="text-[10px] text-slate-400">Stored as E.164: {phone}</p>
          )}
        </div>
      </div>

      {/* ── Address ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Address</Label>
        <Input
          placeholder="3101 N Dale Mabry Hwy"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className={scrapedClass("address")}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            placeholder="Tampa"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={scrapedClass("address")}
          />
          <Input
            placeholder="FL"
            value={stateVal}
            onChange={(e) => setStateVal(e.target.value)}
            maxLength={2}
            className={`uppercase ${scrapedClass("address")}`}
          />
          <Input
            placeholder="33607"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            maxLength={5}
            className={scrapedClass("address")}
          />
        </div>
      </div>

      {/* ── Hours of Operation ───────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Hours of Operation</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {HOUR_DAYS.map((day) => (
            <div key={day} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-20 shrink-0 capitalize font-medium">{day}</span>
              <Input
                className={`text-xs h-8 ${scrapedClass("hours")}`}
                placeholder="9:00 AM – 6:00 PM"
                value={hours[day] ?? ""}
                onChange={(e) => setHours((h) => ({ ...h, [day]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Tone ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">AI Tone / Personality</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
        >
          <option value="friendly">Friendly &amp; Approachable</option>
          <option value="professional">Professional &amp; Direct</option>
          <option value="luxury">Luxury &amp; White Glove</option>
          <option value="hometown">Hometown &amp; Personal</option>
        </select>
      </div>

      {/* ── Save ─────────────────────────────────────────────────── */}
      {saveError && (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {saveError}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" className="h-9" onClick={handleSave} disabled={saving}>
          {saving
            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
            : <><Save className="w-3.5 h-3.5 mr-1.5" />Save Changes</>}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        {lastScrape && !saved && (
          <Badge variant="secondary" className="text-[10px]">
            Unsaved scrape results — review &amp; save
          </Badge>
        )}
      </div>
    </div>
  );
}
