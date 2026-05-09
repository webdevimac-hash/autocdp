"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2, User, Mail, Lock, Upload, CheckCircle,
  ChevronRight, ChevronLeft, Eye, EyeOff, RefreshCw,
  FileText, X, Copy, Check, ArrowLeft,
} from "lucide-react";

// ── CSV parser (handles basic quoted fields) ───────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length < 2) return [];

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) {
        result.push(current); current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  const headers = parseLine(nonEmpty[0]).map((h) => h.trim());
  return nonEmpty.slice(1).map((line) => {
    const vals = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? ""]));
  });
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

type Step = 1 | 2 | 3 | 4;

interface ProfileForm {
  dealershipName: string;
  gmName: string;
  phone: string;
  city: string;
  state: string;
  website: string;
}

interface AccountForm {
  email: string;
  password: string;
}

interface FileInfo {
  file: File;
  rowCount: number;
}

interface ProvisionResult {
  dealershipId: string;
  userId: string;
  slug: string;
}

// ── Step indicator ─────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const steps = [
    { n: 1 as Step, label: "Profile" },
    { n: 2 as Step, label: "Account" },
    { n: 3 as Step, label: "Data" },
    { n: 4 as Step, label: "Create" },
  ];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                s.n < current
                  ? "bg-emerald-500 text-white"
                  : s.n === current
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {s.n < current ? <CheckCircle className="w-4 h-4" /> : s.n}
            </div>
            <span className={`text-[10px] font-semibold mt-1 ${s.n === current ? "text-indigo-600" : "text-slate-400"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px flex-1 mx-1 mb-4 ${s.n < current ? "bg-emerald-300" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Field helpers ──────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "input-base text-sm";

export default function ProvisionPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [profile, setProfile] = useState<ProfileForm>({
    dealershipName: "", gmName: "", phone: "", city: "", state: "", website: "",
  });
  const [account, setAccount] = useState<AccountForm>({
    email: "", password: generatePassword(),
  });
  const [showPassword, setShowPassword] = useState(false);
  const [customerFile, setCustomerFile] = useState<FileInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const custInputRef = useRef<HTMLInputElement>(null);

  // ── Validation ─────────────────────────────────────────────
  const step1Valid = profile.dealershipName.trim().length >= 2;
  const step2Valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) && account.password.length >= 8;

  // ── File handlers ──────────────────────────────────────────
  async function handleCustomerFile(file: File) {
    const text = await file.text();
    const rows = parseCSV(text);
    setCustomerFile({ file, rowCount: rows.length });
  }

  // ── Main create flow ──────────────────────────────────────
  async function handleCreate() {
    setCreating(true);
    setError("");

    try {
      // 1. Provision dealership + auth account
      setStatus("Creating dealership account…");
      const provRes = await fetch("/api/admin/provision-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealershipName: profile.dealershipName.trim(),
          gmName:         profile.gmName.trim()   || undefined,
          phone:          profile.phone.trim()    || undefined,
          website:        profile.website.trim()  || undefined,
          city:           profile.city.trim()     || undefined,
          state:          profile.state.trim()    || undefined,
          clientEmail:    account.email.trim().toLowerCase(),
          clientPassword: account.password,
        }),
      });

      const provData = await provRes.json();
      if (!provRes.ok) throw new Error(provData.error ?? "Provision failed");

      // 2. Upload customer CSV if provided
      if (customerFile) {
        setStatus(`Importing ${customerFile.rowCount.toLocaleString()} customer records…`);
        const text = await customerFile.file.text();
        const rows = parseCSV(text);
        await fetch("/api/onboard/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "customers",
            rows,
            targetDealershipId: provData.dealershipId,
          }),
        });
      }

      setStatus("Done!");
      setResult(provData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Success screen ─────────────────────────────────────────
  if (result) {
    const loginUrl = `${window.location.origin}/login`;
    return (
      <main className="flex-1 p-4 sm:p-6 max-w-[640px]">
        <div className="inst-panel">
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              {profile.dealershipName} is ready
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Account created and data imported. Share these credentials with the dealer.
            </p>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-left space-y-3 mb-6">
              {[
                { label: "Login URL",  value: loginUrl,         key: "url" },
                { label: "Email",      value: account.email,    key: "email" },
                { label: "Password",   value: account.password, key: "pass" },
              ].map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{row.label}</p>
                    <p className="text-[13px] font-mono text-slate-800 truncate">{row.value}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(row.value, row.key)}
                    className="shrink-0 w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                  >
                    {copied === row.key
                      ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                      : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
              ))}
            </div>

            {customerFile && (
              <p className="text-xs text-slate-500 mb-4">
                {customerFile.rowCount.toLocaleString()} customer records imported.
              </p>
            )}

            <div className="flex gap-3">
              <Link
                href="/dashboard/admin"
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Back to Admin
              </Link>
              <button
                onClick={() => {
                  setResult(null);
                  setStep(1);
                  setProfile({ dealershipName: "", gmName: "", phone: "", city: "", state: "", website: "" });
                  setAccount({ email: "", password: generatePassword() });
                  setCustomerFile(null);
                  setStatus("");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                Add Another
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 sm:p-6 max-w-[640px]">

      {/* Back */}
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
      </Link>

      <div className="inst-panel">
        <div className="inst-panel-header">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <div className="inst-panel-title">Add Dealership for Client</div>
              <div className="inst-panel-subtitle">Set up a complete account so they log in and start immediately</div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <StepBar current={step} />

          {/* ── Step 1: Dealership Profile ─────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Dealership Name" required>
                <input
                  className={inputCls}
                  placeholder="Sunrise Motors Group"
                  value={profile.dealershipName}
                  onChange={(e) => setProfile((p) => ({ ...p, dealershipName: e.target.value }))}
                  autoFocus
                />
              </Field>

              <Field label="Primary Contact / GM Name">
                <input
                  className={inputCls}
                  placeholder="John Smith"
                  value={profile.gmName}
                  onChange={(e) => setProfile((p) => ({ ...p, gmName: e.target.value }))}
                />
              </Field>

              <Field label="Phone">
                <input
                  className={inputCls}
                  placeholder="(305) 555-0100"
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input
                    className={inputCls}
                    placeholder="Miami"
                    value={profile.city}
                    onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                  />
                </Field>
                <Field label="State">
                  <input
                    className={inputCls}
                    placeholder="FL"
                    maxLength={2}
                    value={profile.state}
                    onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                  />
                </Field>
              </div>

              <Field label="Website">
                <input
                  className={inputCls}
                  placeholder="https://sunrisemotors.com"
                  value={profile.website}
                  onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                />
              </Field>
            </div>
          )}

          {/* ── Step 2: Client Account ─────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3.5 flex items-start gap-2">
                <User className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-800">
                  This creates the dealer&apos;s login. They&apos;ll use these credentials to access AutoCDP.
                  Share them securely — the email is confirmed automatically.
                </p>
              </div>

              <Field label="Login Email" required>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    className={`${inputCls} pl-9`}
                    type="email"
                    placeholder="gm@sunrisemotors.com"
                    value={account.email}
                    onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                    autoFocus
                  />
                </div>
              </Field>

              <Field label="Temporary Password" required>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      className={`${inputCls} pl-9 pr-9 font-mono`}
                      type={showPassword ? "text" : "password"}
                      value={account.password}
                      onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccount((a) => ({ ...a, password: generatePassword() }))}
                    className="px-3 rounded-[var(--radius)] border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    title="Generate new password"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">Min 8 characters. Auto-generated passwords are strong by default.</p>
              </Field>
            </div>
          )}

          {/* ── Step 3: Upload Data ────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600">
                Optionally upload the dealer&apos;s customer data now. They can also import it themselves later via the Import page.
              </p>

              {/* Customer CSV */}
              <div>
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Customer CSV</p>
                {customerFile ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-lg border border-emerald-200 bg-emerald-50">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-800 truncate">{customerFile.file.name}</p>
                      <p className="text-[10px] text-emerald-600">{customerFile.rowCount.toLocaleString()} rows detected</p>
                    </div>
                    <button
                      onClick={() => setCustomerFile(null)}
                      className="text-emerald-600 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => custInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file?.name.endsWith(".csv")) handleCustomerFile(file);
                    }}
                  >
                    <Upload className="w-6 h-6" />
                    <span className="text-xs font-semibold">Drop CSV here or click to browse</span>
                    <span className="text-[10px]">Supports DMS household, DriveCentric, and generic CRM formats</span>
                  </button>
                )}
                <input
                  ref={custInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCustomerFile(file);
                  }}
                />
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  Inventory and service history can be imported by the dealer after they log in via <strong>Import → Import Data</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Create ────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              {!creating && !result && (
                <>
                  <p className="text-sm text-slate-600 mb-4">Review everything before creating the account.</p>

                  <div className="space-y-3">
                    {[
                      { icon: Building2, label: "Dealership", value: profile.dealershipName, sub: [profile.gmName, profile.city && profile.state ? `${profile.city}, ${profile.state}` : null].filter(Boolean).join(" · ") },
                      { icon: Mail,      label: "Login Email",  value: account.email, sub: null },
                      { icon: Lock,      label: "Password",     value: "•".repeat(account.password.length), sub: null },
                      { icon: FileText,  label: "Customer Data", value: customerFile ? `${customerFile.rowCount.toLocaleString()} rows from ${customerFile.file.name}` : "Skip — import later", sub: null },
                    ].map((row) => {
                      const Icon = row.icon;
                      return (
                        <div key={row.label} className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-100 bg-slate-50">
                          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                            <Icon className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{row.label}</p>
                            <p className="text-[13px] font-semibold text-slate-800">{row.value}</p>
                            {row.sub && <p className="text-[11px] text-slate-400">{row.sub}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {creating && (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin mx-auto mb-4" />
                  <p className="text-sm font-semibold text-slate-700">{status}</p>
                  <p className="text-xs text-slate-400 mt-1">This takes just a moment…</p>
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm font-semibold text-red-700">{error}</p>
                  <button
                    className="text-xs text-red-500 underline mt-1"
                    onClick={() => setError("")}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Navigation buttons ─────────────────────────────── */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => (s - 1) as Step)}
                disabled={creating}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating…" : "Create Dealership"}
                {!creating && <CheckCircle className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
