"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Save, Loader2, Globe, CheckCircle, AlertTriangle,
  Image as ImageIcon, RefreshCw,
} from "lucide-react";
import type { Dealership } from "@/types";

interface SettingsFormProps {
  dealership: Dealership;
}

const HOUR_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export function SettingsForm({ dealership }: SettingsFormProps) {
  const addr = dealership.address as Record<string, string> ?? {};
  const hrs  = dealership.hours as Record<string, string> ?? {};
  const sett = dealership.settings as Record<string, string> ?? {};

  const [name, setName] = useState(dealership.name ?? "");
  const [phone, setPhone] = useState(dealership.phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(dealership.website_url ?? "");
  const [logoUrl, setLogoUrl] = useState(dealership.logo_url ?? "");
  const [street, setStreet] = useState(addr.street ?? "");
  const [city, setCity] = useState(addr.city ?? "");
  const [stateVal, setStateVal] = useState(addr.state ?? "");
  const [zip, setZip] = useState(addr.zip ?? "");
  const [hours, setHours] = useState<Record<string, string>>(hrs);
  const [tone, setTone] = useState(sett.tone ?? "friendly");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

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
    if (!websiteUrl) { setScrapeMsg("Enter a website URL first."); return; }
    setScraping(true);
    setScrapeMsg(null);
    setLogoError(false);
    try {
      const res = await fetch("/api/onboarding/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");

      if (data.name && !name) setName(data.name);
      if (data.phone) setPhone(data.phone);
      if (data.logoUrl) setLogoUrl(data.logoUrl);
      if (data.address?.street) setStreet(data.address.street);
      if (data.address?.city) setCity(data.address.city);
      if (data.address?.state) setStateVal(data.address.state);
      if (data.address?.zip) setZip(data.address.zip);
      if (data.hours) setHours(data.hours);

      setScrapeMsg(`Re-scraped with ${data.confidence} confidence. Review changes below.`);
    } catch (err) {
      setScrapeMsg(`Scrape failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="space-y-5">

      {/* Logo */}
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
                alt="Logo"
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
              className="text-xs font-mono"
            />
            <p className="text-[10px] text-slate-400">
              Direct image URL (.png, .jpg, .svg, .webp). Used in direct mail letterhead and AI copy context.
            </p>
            {logoUrl && logoError && (
              <p className="text-xs text-amber-600">Couldn&apos;t load this URL — check the image link.</p>
            )}
          </div>
        </div>
      </div>

      {/* Website + re-scrape */}
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
            variant="outline"
            size="sm"
            className="h-10 shrink-0 text-xs"
            onClick={handleRescrape}
            disabled={scraping}
          >
            {scraping
              ? <><Loader2 className="mr-1.5 w-3.5 h-3.5 animate-spin" />Scanning…</>
              : <><RefreshCw className="mr-1.5 w-3.5 h-3.5" />Re-scrape</>}
          </Button>
        </div>
        {scrapeMsg && (
          <p className={`text-xs px-2.5 py-1.5 rounded-md border ${scrapeMsg.startsWith("Scrape failed") ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
            {scrapeMsg}
          </p>
        )}
      </div>

      {/* Name + Phone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Dealership Name</Label>
          <Input placeholder="Toyota of Tampa Bay" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Phone Number</Label>
          <Input placeholder="(813) 555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Address</Label>
        <Input placeholder="3101 N Dale Mabry Hwy" value={street} onChange={(e) => setStreet(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Tampa" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input placeholder="FL" value={stateVal} onChange={(e) => setStateVal(e.target.value)} maxLength={2} className="uppercase" />
          <Input placeholder="33607" value={zip} onChange={(e) => setZip(e.target.value)} maxLength={5} />
        </div>
      </div>

      {/* Hours */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Hours of Operation</Label>
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

      {/* AI Tone */}
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

      {/* Save */}
      {saveError && (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {saveError}
        </div>
      )}

      <div className="flex items-center gap-3">
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
      </div>
    </div>
  );
}
