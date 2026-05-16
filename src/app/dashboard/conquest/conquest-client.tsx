"use client";

/**
 * ConquestClient — 4-tab conquest & retargeting dashboard
 *
 * Tabs:
 *   1. Leads      — scored lead table with credit tier, in-market signal, filters
 *   2. Audiences  — named segment list, create modal, push to platforms
 *   3. Retargeting — pixel embed code, retargeting audience buckets
 *   4. Campaigns  — outreach hooks (AI-generated), platform sync status
 */

import { useState, useTransition } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CsvUploader } from "@/components/onboard/csv-uploader";
import {
  Target, Users, TrendingUp, Zap, Radio, Globe,
  Copy, Check, RefreshCw, Send, Plus, ChevronRight,
  AlertCircle, CheckCircle2, Clock, Building2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConquestLead {
  id: string;
  first_name: string | null;
  last_name:  string | null;
  email:      string | null;
  phone:      string | null;
  score:      number | null;
  status:     string;
  source:     string | null;
  credit_tier: string | null;
  in_market_signal: boolean;
  make_interest:  string | null;
  model_interest: string | null;
  retargeted_google: boolean;
  retargeted_meta:   boolean;
  created_at: string;
  audience_id: string | null;
}

interface ConquestAudience {
  id:             string;
  name:           string;
  description:    string | null;
  criteria:       Record<string, unknown>;
  lead_count:     number;
  enriched_count: number;
  in_market_count: number;
  google_audience_id: string | null;
  meta_audience_id:   string | null;
  google_synced_at:   string | null;
  meta_synced_at:     string | null;
  status:         string;
  last_built_at:  string | null;
  build_error:    string | null;
  created_at:     string;
}

interface RetargetingAudience {
  id:             string;
  name:           string;
  rule_type:      string;
  rule_config:    Record<string, unknown>;
  session_count:  number;
  matched_crm:    number;
  google_audience_id: string | null;
  meta_audience_id:   string | null;
  status:         string;
  last_built_at:  string | null;
  created_at:     string;
}

interface Props {
  dealershipId:         string;
  dealershipName:       string;
  pixelSnippet:         string;
  leads:                Array<Record<string, unknown>>;
  audiences:            Array<Record<string, unknown>>;
  retargetingAudiences: Array<Record<string, unknown>>;
  stats: {
    totalLeads:    number;
    highScore:     number;
    inMarket:      number;
    enriched:      number;
    uniqueSessions: number;
    vdpViews:      number;
    leadForms:     number;
    audienceCount: number;
  };
  userEmail: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CREDIT_COLOR: Record<string, string> = {
  excellent: "bg-emerald-100 text-emerald-700",
  good:      "bg-blue-100 text-blue-700",
  fair:      "bg-amber-100 text-amber-700",
  poor:      "bg-red-100 text-red-700",
  unknown:   "bg-slate-100 text-slate-500",
};

const STATUS_COLOR: Record<string, string> = {
  new:          "bg-blue-100 text-blue-700",
  contacted:    "bg-amber-100 text-amber-700",
  converted:    "bg-green-100 text-green-700",
  disqualified: "bg-gray-100 text-gray-500",
};

const AUDIENCE_STATUS_ICON: Record<string, React.ReactNode> = {
  draft:    <Clock className="w-3.5 h-3.5 text-slate-400" />,
  building: <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />,
  ready:    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  syncing:  <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />,
  error:    <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
};

function ScoreBar({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color = s >= 70 ? "bg-emerald-500" : s >= 40 ? "bg-amber-400" : "bg-slate-300";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${s}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{s}</span>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1.5 text-xs">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : (label ?? "Copy")}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Tab: Leads
// ---------------------------------------------------------------------------

function LeadsTab({
  leads,
  dealershipId,
  onScore,
}: {
  leads: ConquestLead[];
  dealershipId: string;
  onScore: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [creditFilter, setCreditFilter] = useState("");
  const [isPending, startTransition] = useTransition();
  const [scoring, setScoring] = useState(false);

  const filtered = leads.filter((l) => {
    const name = `${l.first_name ?? ""} ${l.last_name ?? ""}`.toLowerCase();
    const q = filter.toLowerCase();
    if (q && !name.includes(q) && !(l.email ?? "").toLowerCase().includes(q)) return false;
    if (creditFilter && l.credit_tier !== creditFilter) return false;
    return true;
  });

  async function handleScore() {
    setScoring(true);
    try {
      await fetch("/api/conquest/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      });
      startTransition(() => onScore());
    } finally {
      setScoring(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Import + Score controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Import Leads</CardTitle>
            <p className="text-xs text-muted-foreground">
              DriveCentric, LotLogix, Experian, or standard CSV
            </p>
          </CardHeader>
          <CardContent>
            <CsvUploader
              type="customers"
              uploadUrl="/api/conquest/upload"
              label="Drop conquest leads CSV here"
              description="Supports DriveCentric exports — no cleaning required"
              requiredColumns={["Customer (or first_name+last_name)", "Cell Phone (or phone)"]}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Score & Enrich</CardTitle>
            <p className="text-xs text-muted-foreground">
              Re-score all leads using credit tier, in-market signal, and vehicle interest
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Scoring weights: credit tier (30pts), in-market signal (25pts), vehicle interest (20pts), recency (15pts), contact info (10pts)
            </p>
            <Button
              onClick={handleScore}
              disabled={scoring || isPending}
              className="gap-2 w-full sm:w-auto"
            >
              {scoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {scoring ? "Scoring…" : "Run Batch Score"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or email…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <select
          value={creditFilter}
          onChange={(e) => setCreditFilter(e.target.value)}
          className="h-8 text-sm border border-input rounded-md px-2 bg-background"
        >
          <option value="">All credit tiers</option>
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
          <option value="unknown">Unknown</option>
        </select>
        <span className="text-xs text-muted-foreground ml-1">
          {filtered.length} of {leads.length} leads
        </span>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No leads match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/50">
                    {["Name", "Contact", "Score", "Credit", "Vehicle Interest", "Status", "Platforms", "Added"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {lead.in_market_signal && (
                            <span title="In-market signal" className="text-amber-500">
                              <Zap className="w-3 h-3" />
                            </span>
                          )}
                          {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {lead.email && <p>{lead.email}</p>}
                        {lead.phone && <p>{lead.phone}</p>}
                        {!lead.email && !lead.phone && "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBar score={lead.score} />
                      </td>
                      <td className="px-4 py-3">
                        {lead.credit_tier ? (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CREDIT_COLOR[lead.credit_tier] ?? ""}`}>
                            {lead.credit_tier}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {[lead.make_interest, lead.model_interest].filter(Boolean).join(" ") || lead.source || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[lead.status] ?? "bg-slate-100 text-slate-500"}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {lead.retargeted_google && (
                            <span title="Pushed to Google" className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">G</span>
                          )}
                          {lead.retargeted_meta && (
                            <span title="Pushed to Meta" className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">M</span>
                          )}
                          {!lead.retargeted_google && !lead.retargeted_meta && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Audiences
// ---------------------------------------------------------------------------

function AudiencesTab({
  audiences,
  dealershipId,
  onRefresh,
}: {
  audiences: ConquestAudience[];
  dealershipId: string;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [pushing, setPushing]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // New audience form state
  const [newName, setNewName]     = useState("");
  const [newDesc, setNewDesc]     = useState("");
  const [minScore, setMinScore]   = useState("50");
  const [creditTiers, setCreditTiers] = useState<string[]>(["excellent", "good"]);
  const [inMarketOnly, setInMarketOnly] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const criteria: Record<string, unknown> = {};
      if (creditTiers.length > 0) criteria.credit_tiers = creditTiers;
      if (minScore)               criteria.min_score    = parseInt(minScore);
      if (inMarketOnly)           criteria.in_market    = true;

      const res = await fetch("/api/conquest/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined, criteria }),
      });
      if (res.ok) {
        setNewName(""); setNewDesc(""); setMinScore("50");
        setCreditTiers(["excellent", "good"]); setInMarketOnly(false);
        startTransition(() => onRefresh());
      }
    } finally {
      setCreating(false);
    }
  }

  async function handlePush(audienceId: string, platforms: Array<"google" | "meta">) {
    setPushing(audienceId);
    try {
      await fetch(`/api/conquest/audiences/${audienceId}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms }),
      });
      startTransition(() => onRefresh());
    } finally {
      setPushing(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Create audience */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Audience Segment
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Define criteria — AutoCDP will pull matching leads and sync to your ad platforms.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder="Audience name (e.g. Prime SUV In-Market)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-sm"
            />
            <Input
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-medium text-muted-foreground">Min Score</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                className="w-20 h-8 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inMarketOnly}
                onChange={(e) => setInMarketOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs">In-market only</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {["excellent","good","fair","poor"].map((tier) => (
              <button
                key={tier}
                onClick={() => setCreditTiers((prev) =>
                  prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
                )}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  creditTiers.includes(tier)
                    ? CREDIT_COLOR[tier] + " border-transparent"
                    : "border-border text-muted-foreground"
                }`}
              >
                {tier}
              </button>
            ))}
            <span className="text-xs text-muted-foreground self-center">credit tiers</span>
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="gap-2"
          >
            {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? "Building…" : "Create & Build Audience"}
          </Button>
        </CardContent>
      </Card>

      {/* Audience list */}
      <div className="space-y-3">
        {audiences.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No audiences yet. Create one above.
          </div>
        ) : (
          audiences.map((aud) => (
            <Card key={aud.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {AUDIENCE_STATUS_ICON[aud.status]}
                      <span className="font-medium text-sm">{aud.name}</span>
                      {aud.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-xs">{aud.description}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      <span><span className="font-medium text-foreground">{aud.lead_count}</span> leads</span>
                      <span><span className="font-medium text-foreground">{aud.enriched_count}</span> enriched</span>
                      <span><span className="font-medium text-foreground">{aud.in_market_count}</span> in-market</span>
                      {aud.google_synced_at && (
                        <span className="text-blue-600">G synced {new Date(aud.google_synced_at).toLocaleDateString()}</span>
                      )}
                      {aud.meta_synced_at && (
                        <span className="text-indigo-600">M synced {new Date(aud.meta_synced_at).toLocaleDateString()}</span>
                      )}
                      {aud.build_error && (
                        <span className="text-red-500">Error: {aud.build_error.slice(0, 60)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {aud.status === "ready" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePush(aud.id, ["google"])}
                          disabled={pushing === aud.id}
                          className="text-xs gap-1"
                        >
                          {pushing === aud.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Google
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePush(aud.id, ["meta"])}
                          disabled={pushing === aud.id}
                          className="text-xs gap-1"
                        >
                          {pushing === aud.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Meta
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handlePush(aud.id, ["google", "meta"])}
                          disabled={pushing === aud.id}
                          className="text-xs gap-1"
                        >
                          {pushing === aud.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Push All
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Retargeting
// ---------------------------------------------------------------------------

function RetargetingTab({
  pixelSnippet,
  retargetingAudiences,
  stats,
}: {
  pixelSnippet: string;
  retargetingAudiences: RetargetingAudience[];
  stats: Props["stats"];
}) {
  return (
    <div className="space-y-5">
      {/* Pixel stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Unique Sessions (30d)", value: stats.uniqueSessions, icon: Globe },
          { label: "VDP Views (30d)",       value: stats.vdpViews,       icon: Radio },
          { label: "Lead Form Touches",     value: stats.leadForms,      icon: Target },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">{s.value.toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-100">
                <s.icon className="w-4 h-4 text-slate-600" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pixel embed */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="w-4 h-4 text-blue-500" />
            Retargeting Pixel
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Paste this snippet before the <code className="text-xs bg-slate-100 px-1 rounded">&lt;/body&gt;</code> tag
            on every page of your dealer website. Captures VDP views, lead form activity, and phone clicks.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <pre className="text-xs bg-slate-950 text-green-400 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {pixelSnippet}
            </pre>
            <div className="absolute top-3 right-3">
              <CopyButton text={pixelSnippet} label="Copy snippet" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> No cookies — sessionStorage only</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> No PII transmitted — session IDs only</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> CCPA / GDPR compatible</span>
          </div>
        </CardContent>
      </Card>

      {/* Retargeting audience buckets */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pixel Audience Buckets</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pixel-based audiences are auto-built from your website visitor data. Push to ad platforms to retarget shoppers.
          </p>
        </CardHeader>
        <CardContent>
          {retargetingAudiences.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Pixel audiences are created automatically once the pixel is installed and events start flowing.
            </div>
          ) : (
            <div className="space-y-2">
              {retargetingAudiences.map((aud) => (
                <div key={aud.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{aud.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {aud.session_count.toLocaleString()} sessions · {aud.matched_crm} matched CRM · {aud.rule_type.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {AUDIENCE_STATUS_ICON[aud.status]}
                    {aud.google_audience_id && (
                      <Badge variant="outline" className="text-[10px]">Google</Badge>
                    )}
                    {aud.meta_audience_id && (
                      <Badge variant="outline" className="text-[10px]">Meta</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Campaigns
// ---------------------------------------------------------------------------

function CampaignsTab({
  audiences,
  dealershipId,
}: {
  audiences: ConquestAudience[];
  dealershipId: string;
}) {
  const [selectedAudience, setSelectedAudience] = useState(audiences[0]?.id ?? "");
  const [hooks, setHooks] = useState<Array<{ leadId: string; hook: string; channel: string; offerAngle: string }>>([]);
  const [loading, setLoading] = useState(false);

  const readyAudiences = audiences.filter((a) => a.status === "ready" && a.lead_count > 0);

  async function generateHooks() {
    if (!selectedAudience) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/conquest/audiences/${selectedAudience}/hooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxLeads: 20 }),
      });
      if (res.ok) {
        const data = await res.json() as { hooks: typeof hooks };
        setHooks(data.hooks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            AI Outreach Hook Generator
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Generate personalized outreach hooks for each lead in an audience — tailored to their vehicle interest, credit tier, and in-market signal.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {readyAudiences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Build and push an audience first.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <select
                  value={selectedAudience}
                  onChange={(e) => setSelectedAudience(e.target.value)}
                  className="h-9 text-sm border border-input rounded-md px-2 bg-background flex-1 max-w-xs"
                >
                  {readyAudiences.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.lead_count} leads)</option>
                  ))}
                </select>
                <Button onClick={generateHooks} disabled={loading || !selectedAudience} className="gap-2">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {loading ? "Generating…" : "Generate Hooks"}
                </Button>
              </div>
              {hooks.length > 0 && (
                <div className="space-y-2 mt-2">
                  {hooks.map((h, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg border text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{h.channel}</Badge>
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">{h.offerAngle}</Badge>
                      </div>
                      <p className="text-gray-800 leading-relaxed">{h.hook}</p>
                      <div className="flex justify-end">
                        <CopyButton text={h.hook} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Platform sync summary */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Platform Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          {audiences.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audiences created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Audience", "Leads", "Google", "Meta", "Status"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {audiences.map((aud) => (
                    <tr key={aud.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 font-medium text-sm">{aud.name}</td>
                      <td className="px-3 py-2.5 text-sm">{aud.lead_count.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {aud.google_audience_id
                          ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Synced</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {aud.meta_audience_id
                          ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Synced</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {AUDIENCE_STATUS_ICON[aud.status]}
                          <span className="text-xs">{aud.status}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Tab = "leads" | "audiences" | "retargeting" | "campaigns";

export function ConquestClient({
  dealershipId,
  dealershipName,
  pixelSnippet,
  leads,
  audiences,
  retargetingAudiences,
  stats,
  userEmail,
}: Props) {
  const [tab, setTab] = useState<Tab>("leads");

  const typedLeads     = leads             as unknown as ConquestLead[];
  const typedAudiences = audiences         as unknown as ConquestAudience[];
  const typedRetargeting = retargetingAudiences as unknown as RetargetingAudience[];

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "leads",      label: "Leads",      icon: <Users className="w-4 h-4" /> },
    { id: "audiences",  label: "Audiences",  icon: <Target className="w-4 h-4" /> },
    { id: "retargeting",label: "Retargeting",icon: <Radio className="w-4 h-4" /> },
    { id: "campaigns",  label: "Campaigns",  icon: <Send className="w-4 h-4" /> },
  ];

  const statCards = [
    { label: "Total Leads",    value: stats.totalLeads,     icon: Users,       color: "text-blue-600 bg-blue-50" },
    { label: "High Score 70+", value: stats.highScore,      icon: TrendingUp,  color: "text-emerald-600 bg-emerald-50" },
    { label: "In-Market",      value: stats.inMarket,       icon: Zap,         color: "text-amber-600 bg-amber-50" },
    { label: "Pixel Sessions", value: stats.uniqueSessions, icon: Globe,       color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <>
      <Header
        title="Conquest"
        subtitle={`${dealershipName} — targeting & retargeting engine`}
        userEmail={userEmail}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-5 flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{s.value.toLocaleString()}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {tab === "leads" && (
          <LeadsTab
            leads={typedLeads}
            dealershipId={dealershipId}
            onScore={() => window.location.reload()}
          />
        )}
        {tab === "audiences" && (
          <AudiencesTab
            audiences={typedAudiences}
            dealershipId={dealershipId}
            onRefresh={() => window.location.reload()}
          />
        )}
        {tab === "retargeting" && (
          <RetargetingTab
            pixelSnippet={pixelSnippet}
            retargetingAudiences={typedRetargeting}
            stats={stats}
          />
        )}
        {tab === "campaigns" && (
          <CampaignsTab
            audiences={typedAudiences}
            dealershipId={dealershipId}
          />
        )}
      </main>
    </>
  );
}
