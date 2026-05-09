"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle, XCircle, Loader2, AlertTriangle, Clock,
  Send, Users, DollarSign, FileText, KeyRound, ShieldCheck,
} from "lucide-react";
import type { CampaignSnapshot } from "@/lib/campaign-approval";

type ApprovalStatus =
  | "loading" | "ready" | "not_found" | "expired" | "already_acted"
  | "submitting" | "done_approved" | "done_rejected" | "error";

interface ApprovalData {
  id: string;
  status: string;
  expires_at: string;
  campaign_snapshot: CampaignSnapshot;
  requested_by_email: string | null;
  gm_name: string | null;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  alreadyActed?: boolean;
}

export default function ApprovalPage() {
  const { token } = useParams<{ token: string }>();

  const [pageStatus, setPageStatus] = useState<ApprovalStatus>("loading");
  const [approval, setApproval] = useState<ApprovalData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [notes, setNotes] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [execResult, setExecResult] = useState<{ successCount: number; failedCount: number; message: string } | null>(null);

  // 2FA state
  const [codeDigits, setCodeDigits] = useState(["", "", "", "", "", ""]);
  const [confirmed, setConfirmed] = useState(false);
  const [codeError, setCodeError] = useState("");
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    fetch(`/api/campaign/approve/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          if (r.status === 410) { setPageStatus("expired"); return; }
          if (r.status === 404) { setPageStatus("not_found"); return; }
          setErrorMsg(d.error ?? "Error loading approval");
          setPageStatus("error");
          return;
        }
        if (d.alreadyActed) {
          setApproval(d);
          setPageStatus("already_acted");
          return;
        }
        setApproval(d);
        setPageStatus("ready");
      })
      .catch(() => { setErrorMsg("Network error"); setPageStatus("error"); });
  }, [token]);

  function handleDigitChange(i: number, val: string) {
    const digit = val.replace(/\D/, "").slice(-1);
    const next = [...codeDigits];
    next[i] = digit;
    setCodeDigits(next);
    setCodeError("");
    if (digit && i < 5) digitRefs.current[i + 1]?.focus();
  }

  function handleDigitKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !codeDigits[i] && i > 0) digitRefs.current[i - 1]?.focus();
  }

  function handleDigitPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setCodeDigits(pasted.split(""));
      setCodeError("");
      digitRefs.current[5]?.focus();
    }
  }

  const confirmationCode = codeDigits.join("");
  const canApprove = confirmationCode.length === 6 && confirmed;

  async function act(action: "approve" | "reject") {
    setPageStatus("submitting");
    setCodeError("");
    try {
      const res = await fetch(`/api/campaign/approve/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: notes.trim() || undefined,
          confirmationCode: action === "approve" ? confirmationCode : undefined,
          userAgent: navigator.userAgent,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        // Return to "ready" so the GM can correct the code
        if (res.status === 400 && d.error?.toLowerCase().includes("code")) {
          setCodeError(d.error);
          setCodeDigits(["", "", "", "", "", ""]);
          digitRefs.current[0]?.focus();
          setPageStatus("ready");
          return;
        }
        setErrorMsg(d.error ?? "Request failed");
        setPageStatus("error");
        return;
      }
      if (action === "approve") {
        setExecResult({ successCount: d.successCount, failedCount: d.failedCount, message: d.message });
        setPageStatus("done_approved");
      } else {
        setPageStatus("done_rejected");
      }
    } catch {
      setErrorMsg("Network error — please try again.");
      setPageStatus("error");
    }
  }

  const snap = approval?.campaign_snapshot;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">AutoCDP</p>
          <h1 className="text-2xl font-bold text-slate-900">Campaign Approval</h1>
          {snap && <p className="text-sm text-slate-500 mt-1">{snap.dealershipName}</p>}
        </div>

        {pageStatus === "loading" && (
          <Card>
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading campaign details…</span>
            </div>
          </Card>
        )}

        {pageStatus === "not_found" && (
          <StatusCard icon={<XCircle className="w-10 h-10 text-red-400" />}
            title="Link not found" color="red"
            message="This approval link doesn't exist or has already been used. Contact your team for a new link." />
        )}

        {pageStatus === "expired" && (
          <StatusCard icon={<Clock className="w-10 h-10 text-amber-400" />}
            title="Link expired" color="amber"
            message="This approval link has expired (24-hour limit). Ask your team to submit a new approval request." />
        )}

        {pageStatus === "already_acted" && approval && (
          <StatusCard
            icon={approval.status === "approved" || approval.status === "executed"
              ? <CheckCircle className="w-10 h-10 text-emerald-400" />
              : <XCircle className="w-10 h-10 text-slate-400" />}
            title={`Campaign already ${approval.status}`}
            color={approval.status === "approved" || approval.status === "executed" ? "emerald" : "slate"}
            message={`This campaign was ${approval.status} on ${new Date(
              approval.approved_at ?? approval.rejected_at ?? approval.created_at
            ).toLocaleString()}. No further action needed.`}
          />
        )}

        {pageStatus === "error" && (
          <StatusCard icon={<AlertTriangle className="w-10 h-10 text-red-400" />}
            title="Something went wrong" color="red" message={errorMsg} />
        )}

        {pageStatus === "submitting" && (
          <Card>
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Approving and executing campaign…</p>
              <p className="text-xs text-slate-400">This may take up to 30 seconds.</p>
            </div>
          </Card>
        )}

        {pageStatus === "done_approved" && execResult && (
          <Card>
            <div className="text-center py-8 px-6">
              <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Campaign Approved &amp; Sent</h2>
              <p className="text-slate-500 text-sm mb-6">{execResult.message}</p>
              <div className="grid grid-cols-2 gap-3 text-left mb-6">
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <p className="text-2xl font-bold text-emerald-700">{execResult.successCount}</p>
                  <p className="text-xs font-medium text-emerald-600">Sent successfully</p>
                </div>
                {execResult.failedCount > 0 && (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <p className="text-2xl font-bold text-amber-700">{execResult.failedCount}</p>
                    <p className="text-xs font-medium text-amber-600">Failed</p>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                  <p className="text-xs font-semibold text-slate-700">Audit record created</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your name, email, IP address, confirmation code verification, explicit consent,
                  browser info, and exact timestamp are permanently recorded.
                </p>
              </div>
            </div>
          </Card>
        )}

        {pageStatus === "done_rejected" && (
          <StatusCard icon={<XCircle className="w-10 h-10 text-slate-400" />}
            title="Campaign rejected" color="slate"
            message="You've rejected this campaign. The requester has been notified. No messages will be sent." />
        )}

        {pageStatus === "ready" && snap && approval && (
          <div className="space-y-4">
            <Card>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-px bg-slate-100 rounded-t-xl overflow-hidden">
                <StatCell icon={<Users className="w-4 h-4" />} label="Recipients" value={`${snap.recipientCount}`} />
                <StatCell icon={<Send className="w-4 h-4" />} label="Channel" value={snap.channelLabel} />
                <StatCell icon={<DollarSign className="w-4 h-4" />} label="Est. Cost" value={snap.estimatedCost} />
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Requested by</p>
                  <p className="text-sm font-medium text-slate-800">{snap.requestedByEmail}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Campaign Goal</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{snap.campaignGoal}</p>
                </div>
                {snap.templateType && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Template</p>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                      <FileText className="w-3 h-3" />{snap.templateType.replace(/_/g, " ")}
                    </span>
                  </div>
                )}
                {snap.memoriesSummary && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Governance</p>
                    <p className="text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg">{snap.memoriesSummary}</p>
                  </div>
                )}
                <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                  Expires: {new Date(approval.expires_at).toLocaleString()}
                </div>
              </div>
            </Card>

            {/* ── Confirmation code ──────────────────────────────── */}
            <Card>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-500 shrink-0" />
                  <p className="text-sm font-semibold text-slate-800">Enter the 6-digit code from your email</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This code was included in the approval request email sent to you.
                  It confirms you received the request and authorizes this specific campaign.
                </p>

                {/* Digit inputs */}
                <div className="flex gap-2 justify-center" onPaste={handleDigitPaste}>
                  {codeDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { digitRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                      className={`w-11 h-12 text-center text-xl font-bold border-2 rounded-lg focus:outline-none transition-colors ${
                        codeError
                          ? "border-red-400 bg-red-50 text-red-700"
                          : d
                          ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                          : "border-slate-200 bg-white text-slate-900 focus:border-indigo-400"
                      }`}
                    />
                  ))}
                </div>

                {codeError && (
                  <p className="text-xs text-red-600 text-center font-medium">{codeError}</p>
                )}

                {/* Explicit consent checkbox */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors">
                    I have reviewed the campaign details above and authorize AutoCDP to send this
                    campaign to <strong className="text-slate-900">{snap.recipientCount} customer{snap.recipientCount !== 1 ? "s" : ""}</strong>{" "}
                    at an estimated cost of <strong className="text-slate-900">{snap.estimatedCost}</strong>.
                    I understand this action is permanent and will be logged with my identity.
                  </span>
                </label>
              </div>
            </Card>

            {/* Reject form */}
            {showRejectForm && (
              <Card>
                <div className="p-5 space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Reason for rejection (optional)</p>
                  <textarea
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-300 bg-slate-50"
                    placeholder="Tell the team why this campaign was rejected…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => act("reject")}
                      className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
                    >
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {/* Action buttons */}
            {!showRejectForm && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="py-3.5 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm hover:border-red-200 hover:text-red-700 hover:bg-red-50 transition-all"
                >
                  <XCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Reject
                </button>
                <button
                  onClick={() => act("approve")}
                  disabled={!canApprove}
                  className={`py-3.5 rounded-xl font-semibold text-sm shadow-sm transition-all ${
                    canApprove
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Approve &amp; Send
                </button>
              </div>
            )}

            {!canApprove && !showRejectForm && (
              <p className="text-center text-xs text-slate-400">
                {confirmationCode.length < 6
                  ? "Enter the 6-digit code from your email to enable approval."
                  : "Check the consent box above to enable approval."}
              </p>
            )}

            <p className="text-center text-xs text-slate-400 px-4">
              By approving, your name, email, IP address, confirmation code, device info,
              and timestamp are permanently recorded in the audit log.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-base font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatusCard({ icon, title, message, color }: {
  icon: React.ReactNode;
  title: string;
  message: string;
  color: "emerald" | "amber" | "red" | "slate";
}) {
  const bg = { emerald: "bg-emerald-50", amber: "bg-amber-50", red: "bg-red-50", slate: "bg-slate-50" }[color];
  return (
    <div className={`rounded-xl border border-slate-200 p-8 text-center ${bg}`}>
      <div className="flex justify-center mb-4">{icon}</div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
    </div>
  );
}
