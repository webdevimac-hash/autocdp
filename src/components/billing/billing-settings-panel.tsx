"use client";

import { useState } from "react";
import {
  CreditCard, Building2, CheckCircle, Loader2, ChevronDown,
  Mail, DollarSign, ShieldAlert, AlertCircle,
} from "lucide-react";
import type { BillingSettings, Invoice } from "@/lib/billing/invoices";

interface BillingSettingsPanelProps {
  initial: BillingSettings;
  canEdit: boolean;
  invoices: Invoice[];
  dealershipId: string;
}

const STATUS_STYLES: Record<string, string> = {
  paid:    "chip-emerald",
  sent:    "chip-indigo",
  draft:   "chip-slate",
  overdue: "chip-red",
};

export function BillingSettingsPanel({ initial, canEdit, invoices }: BillingSettingsPanelProps) {
  const [settings, setSettings] = useState<BillingSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null);
  const [invoiceList, setInvoiceList] = useState<Invoice[]>(invoices);

  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const res = await fetch("/api/billing/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error ?? "Save failed");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function generateInvoice() {
    setGenerating(true);
    setGenError("");
    setGeneratedInvoice(null);
    const now = new Date();
    try {
      const res = await fetch("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: now.getFullYear(), month: now.getMonth() + 1 }),
      });
      const d = await res.json() as Invoice;
      if (!res.ok) { setGenError((d as { error?: string }).error ?? "Failed"); return; }
      setGeneratedInvoice(d);
      setInvoiceList((prev) => {
        const exists = prev.some((i) => i.id === d.id);
        return exists ? prev : [d, ...prev];
      });
    } catch {
      setGenError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function markPaid(invoiceId: string) {
    setMarkingPaid(invoiceId);
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid", payment_method: settings.payment_method_preference }),
      });
      if (res.ok) {
        const updated = await res.json() as Invoice;
        setInvoiceList((prev) => prev.map((i) => i.id === invoiceId ? updated : i));
      }
    } finally {
      setMarkingPaid(null);
    }
  }

  const isACH = settings.payment_method_preference === "ach";

  return (
    <div className="space-y-5">

      {/* ── Recent Invoices ─────────────────────────────────────── */}
      <div className="inst-panel">
        <div className="inst-panel-header">
          <div>
            <div className="inst-panel-title">Invoices</div>
            <div className="inst-panel-subtitle">Monthly statements — sent to your controller on generation</div>
          </div>
          {canEdit && (
            <button
              onClick={generateInvoice}
              disabled={generating}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Generate This Month
            </button>
          )}
        </div>

        {genError && (
          <div className="mx-5 mb-3 p-3 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {genError}
          </div>
        )}
        {generatedInvoice && (
          <div className="mx-5 mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            Invoice {generatedInvoice.invoice_number} created — ${(generatedInvoice.subtotal_cents / 100).toFixed(2)} due by{" "}
            {generatedInvoice.due_date ? new Date(generatedInvoice.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Net 15"}.
            {generatedInvoice.controller_email && ` Emailed to ${generatedInvoice.controller_email}.`}
          </div>
        )}

        {invoiceList.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            No invoices yet. Generate your first invoice above.
          </div>
        ) : (
          <table className="inst-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoiceList.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-mono text-xs text-slate-600">{inv.invoice_number}</td>
                  <td className="text-slate-600 text-xs">
                    {new Date(inv.billing_year, inv.billing_month - 1).toLocaleString("en-US", { month: "short", year: "numeric" })}
                  </td>
                  <td className="font-semibold text-slate-900 tabular-nums">${(inv.subtotal_cents / 100).toFixed(2)}</td>
                  <td>
                    <span className={`chip ${STATUS_STYLES[inv.status] ?? "chip-slate"}`}>{inv.status}</span>
                  </td>
                  <td className="text-slate-400 text-xs">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                  </td>
                  <td>
                    {canEdit && inv.status !== "paid" && (
                      <button
                        onClick={() => markPaid(inv.id)}
                        disabled={markingPaid === inv.id}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 disabled:opacity-60"
                      >
                        {markingPaid === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Mark Paid
                      </button>
                    )}
                    {inv.status === "paid" && (
                      <span className="text-xs text-slate-400">
                        {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Paid"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Payment method ──────────────────────────────────────── */}
      <div className="inst-panel">
        <div className="inst-panel-header">
          <div>
            <div className="inst-panel-title">Payment Method</div>
            <div className="inst-panel-subtitle">How invoices are settled</div>
          </div>
        </div>
        <div className="p-5 space-y-4">

          {/* Card / ACH toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => canEdit && setSettings((s) => ({ ...s, payment_method_preference: "card" }))}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                !isACH
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              } ${!canEdit ? "cursor-default opacity-70" : "cursor-pointer"}`}
            >
              <CreditCard className={`w-5 h-5 shrink-0 ${!isACH ? "text-indigo-600" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-semibold ${!isACH ? "text-indigo-900" : "text-slate-700"}`}>Credit / Debit Card</p>
                <p className="text-xs text-slate-500 mt-0.5">Charged automatically on due date</p>
              </div>
              {!isACH && <div className="ml-auto w-4 h-4 rounded-full bg-indigo-600 border-2 border-indigo-600 shrink-0" />}
            </button>

            <button
              onClick={() => canEdit && setSettings((s) => ({ ...s, payment_method_preference: "ach" }))}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                isACH
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              } ${!canEdit ? "cursor-default opacity-70" : "cursor-pointer"}`}
            >
              <Building2 className={`w-5 h-5 shrink-0 ${isACH ? "text-indigo-600" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-semibold ${isACH ? "text-indigo-900" : "text-slate-700"}`}>ACH Bank Transfer</p>
                <p className="text-xs text-slate-500 mt-0.5">Lower fees · 2–5 business days</p>
              </div>
              {isACH && <div className="ml-auto w-4 h-4 rounded-full bg-indigo-600 border-2 border-indigo-600 shrink-0" />}
            </button>
          </div>

          {/* ACH details */}
          {isACH && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Bank Account Details</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Bank name</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={settings.ach_bank_name ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, ach_bank_name: e.target.value }))}
                    placeholder="e.g. Chase"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Account last 4</label>
                  <input
                    type="text"
                    maxLength={4}
                    disabled={!canEdit}
                    value={settings.ach_account_last4 ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, ach_account_last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    placeholder="1234"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Routing last 4</label>
                  <input
                    type="text"
                    maxLength={4}
                    disabled={!canEdit}
                    value={settings.ach_routing_last4 ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, ach_routing_last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    placeholder="5678"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Full ACH integration via Stripe Plaid is coming in Phase 2.
                These details are displayed on invoices and used for payment reference.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Invoice settings ────────────────────────────────────── */}
      <div className="inst-panel">
        <div className="inst-panel-header">
          <div>
            <div className="inst-panel-title">Invoice Settings</div>
            <div className="inst-panel-subtitle">Controller notifications and print run gates</div>
          </div>
        </div>
        <div className="p-5 space-y-4">

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Controller email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                disabled={!canEdit}
                value={settings.invoice_controller_email ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, invoice_controller_email: e.target.value }))}
                placeholder="controller@dealership.com"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Receives invoice copies and spend alerts when campaigns exceed the threshold below.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Spend alert threshold</label>
            <div className="relative w-48">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                min={0}
                step={50}
                disabled={!canEdit}
                value={(settings.invoice_threshold_cents / 100).toFixed(0)}
                onChange={(e) => setSettings((s) => ({ ...s, invoice_threshold_cents: Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100)) }))}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Controller receives an email when any single campaign exceeds this amount.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <button
              role="switch"
              aria-checked={settings.invoice_require_payment_before_print}
              disabled={!canEdit}
              onClick={() => setSettings((s) => ({ ...s, invoice_require_payment_before_print: !s.invoice_require_payment_before_print }))}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                settings.invoice_require_payment_before_print ? "bg-indigo-600" : "bg-slate-200"
              } ${!canEdit ? "opacity-60 cursor-default" : ""}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                settings.invoice_require_payment_before_print ? "translate-x-4" : "translate-x-0"
              }`} />
            </button>
            <div>
              <p className="text-sm font-medium text-slate-800">Require payment before print runs</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                When enabled, direct mail campaigns are blocked if any invoice is past due.
                The controller must settle the outstanding balance first.
              </p>
            </div>
          </div>

          {settings.invoice_require_payment_before_print && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Print runs will be blocked if any invoice is overdue. The controller receives an email immediately when a run is submitted while a balance is outstanding.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save / feedback */}
      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Payment Settings
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
              <CheckCircle className="w-4 h-4" /> Saved
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" /> {saveError}
            </span>
          )}
        </div>
      )}

      {!canEdit && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <ChevronDown className="w-3.5 h-3.5" />
          Owner or admin role required to modify payment settings.
        </p>
      )}
    </div>
  );
}
