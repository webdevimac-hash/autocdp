"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2, AlertTriangle, Clock, Send, Users, DollarSign, FileText } from "lucide-react";
import type { CampaignSnapshot } from "@/lib/campaign-approval";

type ApprovalStatus = "loading" | "ready" | "not_found" | "expired" | "already_acted" | "submitting" | "done_approved" | "done_rejected" | "error";

interface ApprovalData {
  id: string;
  status: string;
  expires_at: string;
  campaign_snapshot: CampaignSnapshot;
  requested_by_email: string | null;
  gm_name: string | null;
  created_at: string;
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

  async function act(action: "approve" | "reject") {
    setPageStatus("submitting");
    try {
      const res = await fetch(`/api/campaign/approve/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) {
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

        {/* ── Loading ───────────────────────────────────── */}
        {pageStatus === "loading" && (
          <Card>
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading campaign details…</span>
            </div>
          </Card>
        )}

        {/* ── Not found ─────────────────────────────────── */}
        {pageStatus === "not_found" && (
          <StatusCard icon={<XCircle className="w-10 h-10 text-red-400" />}
            title="Link not found" color="red"
            message="This approval link doesn't exist or has already been used. Contact your team for a new link." />
        )}

        {/* ── Expired ───────────────────────────────────── */}
        {pageStatus === "expired" && (
          <StatusCard icon={<Clock className="w-10 h-10 text-amber-400" />}
            title="Link expired" color="amber"
            message="This approval link has expired (24-hour limit). Ask your team to submit a new approval request." />
        )}

        {/* ── Already acted ─────────────────────────────── */}
        {pageStatus === "already_acted" && approval && (
          <StatusCard
            icon={approval.status === "approved" || approval.status === "executed"
              ? <CheckCircle className="w-10 h-10 text-emerald-400" />
              : <XCircle className="w-10 h-10 text-slate-400" />}
            title={`Campaign already ${approval.status}`}
            color={approval.status === "approved" || approval.status === "executed" ? "emerald" : "slate"}
            message={`This campaign was ${approval.status} on ${new Date(approval.approved_at ?? approval.rejected_at ?? approval.created_at).toLocaleString()}. No further action needed.`}
          />
        )}

        {/* ── Error ─────────────────────────────────────── */}
        {pageStatus === "error" && (
          <StatusCard icon={<AlertTriangle className="w-10 h-10 text-red-400" />}
            title="Something went wrong" color="red" message={errorMsg} />
        )}

        {/* ── Submitting ────────────────────────────────── */}
        {pageStatus === "submitting" && (
          <Card>
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Approving and executing campaign…</p>
              <p className="text-xs text-slate-400">This may take up to 30 seconds.</p>
            </div>
          </Card>
        )}

        {/* ── Approved + executed ───────────────────────── */}
        {pageStatus === "done_approved" && execResult && (
          <Card>
            <div className="text-center py-8 px-6">
              <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Campaign Approved &amp; Sent</h2>
              <p className="text-slate-500 text-sm mb-6">{execResult.message}</p>
              <div className="grid grid-cols-2 gap-3 text-left">
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
              <p className="text-xs text-slate-400 mt-6">
                Your approval has been recorded with a full audit trail. You can close this tab.
              </p>
            </div>
          </Card>
        )}

        {/* ── Rejected ──────────────────────────────────── */}
        {pageStatus === "done_rejected" && (
          <StatusCard icon={<XCircle className="w-10 h-10 text-slate-400" />}
            title="Campaign rejected" color="slate"
            message="You've rejected this campaign. The requester has been notified. No messages will be sent." />
        )}

        {/* ── Ready to act ──────────────────────────────── */}
        {pageStatus === "ready" && snap && approval && (
          <div className="space-y-4">
            <Card>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-px bg-slate-100 rounded-t-xl overflow-hidden">
                <StatCell icon={<Users className="w-4 h-4" />} label="Recipients" value={`${snap.recipientCount}`} />
                <StatCell icon={<Send className="w-4 h-4" />} label="Channel" value={snap.channelLabel} />
                <StatCell icon={<DollarSign className="w-4 h-4" />} label="Est. Cost" value={snap.estimatedCost} />
              </div>

              {/* Campaign details */}
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
                <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                  Expires: {new Date(approval.expires_at).toLocaleString()}
                </div>
              </div>
            </Card>

            {/* Reject form (shown conditionally) */}
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
                  className="py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-colors"
                >
                  <CheckCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Approve &amp; Send
                </button>
              </div>
            )}

            <p className="text-center text-xs text-slate-400 px-4">
              By approving, your name, email, IP address, and timestamp are permanently recorded in the audit log.
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
