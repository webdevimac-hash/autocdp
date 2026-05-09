import { createClient } from "@/lib/supabase/server";
import { getActiveDealershipId } from "@/lib/dealership";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import {
  Send, Bot, Upload, Settings, Shield,
  CheckCircle2, XCircle, Clock, Sparkles, Lock, BookOpen,
  KeyRound, ShieldCheck, Monitor,
} from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";

export const metadata = { title: "Audit Log" };

function actionIcon(action: string) {
  if (action.startsWith("campaign.approval.")) return Lock;
  if (action.startsWith("campaign.governance.")) return BookOpen;
  if (action.startsWith("campaign."))  return Send;
  if (action.startsWith("agent."))     return Bot;
  if (action.startsWith("customer."))  return Upload;
  if (action.startsWith("settings."))  return Settings;
  if (action.startsWith("demo_mode.")) return Sparkles;
  return Shield;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    "campaign.sent":                        "Campaign sent",
    "campaign.dry_run":                     "Campaign dry run",
    "campaign.created":                     "Campaign created",
    "campaign.approval.requested":          "GM approval requested",
    "campaign.approval.approved":           "Campaign approved by GM",
    "campaign.approval.rejected":           "Campaign rejected by GM",
    "campaign.approval.code_verified":      "Confirmation code verified",
    "campaign.blocked.invoice_overdue":     "Print run blocked — invoice overdue",
    "campaign.governance.memories_applied": "Governance: guidance applied to run",
    "agent.run.started":                    "Agent run started",
    "agent.run.completed":                  "Agent run completed",
    "agent.run.failed":                     "Agent run failed",
    "customer.imported":                    "Customers imported",
    "data.exported":                        "Data exported",
    "settings.updated":                     "Settings updated",
    "demo_mode.enabled":                    "Demo mode enabled",
    "demo_mode.disabled":                   "Demo mode disabled",
  };
  return map[action] ?? action.replace(/[._]/g, " ");
}

function statusIcon(status: string) {
  if (status === "completed") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  if (status === "failed")    return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />;
}

interface MemoryRef { id: string; title: string; category: string; strength: string }

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
  _source: "audit" | "agent";
  agent_type?: string;
  status?: string;
  output_summary?: string | null;
  error?: string | null;
}

export default async function AuditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dealershipId = await getActiveDealershipId(user.id);
  if (!dealershipId) redirect("/onboarding");

  const [auditRes, agentRes] = await Promise.all([
    supabase
      .from("audit_log")
      .select("id, action, entity_type, entity_id, details, created_at, user_id")
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false })
      .limit(100),

    supabase
      .from("agent_runs")
      .select("id, agent_type, status, created_at, output_summary, error")
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const auditEntries: AuditEntry[] = (auditRes.data ?? []).map((r) => ({
    ...r,
    details: (r.details ?? {}) as Record<string, unknown>,
    _source: "audit" as const,
  }));

  const agentEntries: AuditEntry[] = (agentRes.data ?? []).map((r) => ({
    id: r.id,
    action: `agent.run.${r.status}`,
    entity_type: "agent_run",
    entity_id: null,
    details: {},
    created_at: r.created_at,
    user_id: null,
    _source: "agent" as const,
    agent_type: r.agent_type,
    status: r.status,
    output_summary: r.output_summary,
    error: r.error,
  }));

  const allEntries = [...auditEntries, ...agentEntries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 150);

  return (
    <>
      <Header title="Audit Log" subtitle="Compliance trail — all agent and user actions" userEmail={user?.email} />

      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto space-y-4">

        {allEntries.length === 0 ? (
          <div className="inst-panel px-6 py-16 text-center">
            <Shield className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 mb-1">No events yet</p>
            <p className="text-xs text-slate-400">Events appear here as campaigns are sent and agents run.</p>
          </div>
        ) : (
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div className="inst-panel-title">Events</div>
              <span className="text-xs text-slate-400 font-medium tabular-nums">{allEntries.length} total</span>
            </div>
            <div className="divide-y divide-slate-50">
              {allEntries.map((entry) => {
                const Icon = entry._source === "agent" ? Bot : actionIcon(entry.action);
                const label = entry._source === "agent"
                  ? `${entry.agent_type} agent — ${entry.status}`
                  : actionLabel(entry.action);

                const isGovernance = entry.action === "campaign.governance.memories_applied";
                const isApproval   = entry.action.startsWith("campaign.approval.");

                const memoriesUsed = entry.details.memories_used as MemoryRef[] | undefined;
                const hardCount    = entry.details.hard_constraints as number | undefined;
                const softCount    = entry.details.soft_guidance as number | undefined;
                const totalMem     = entry.details.memories_count as number | undefined;

                const approverNotes = entry.details.notes as string | undefined;
                const gmEmail       = entry.details.gm_email as string | undefined;

                return (
                  <div key={`${entry._source}-${entry.id}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">

                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isGovernance ? "bg-indigo-50" : isApproval ? "bg-amber-50" : "bg-slate-100"
                    }`}>
                      <Icon className={`w-3.5 h-3.5 ${
                        isGovernance ? "text-indigo-500" : isApproval ? "text-amber-600" : "text-slate-500"
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-slate-900 capitalize">{label}</span>
                        {entry._source === "agent" && entry.status && statusIcon(entry.status)}
                        {isGovernance && (
                          <span className="chip chip-indigo text-[10px]">governance</span>
                        )}
                        {isApproval && (
                          <span className="chip chip-amber text-[10px]">approval</span>
                        )}
                      </div>

                      {/* Agent run summary */}
                      {entry._source === "agent" && entry.output_summary && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{entry.output_summary}</p>
                      )}
                      {entry._source === "agent" && entry.error && (
                        <p className="text-xs text-red-500 mt-0.5 line-clamp-1">{entry.error}</p>
                      )}

                      {/* Governance — memories used */}
                      {isGovernance && typeof totalMem === "number" && totalMem > 0 && (
                        <div className="mt-1.5 space-y-1">
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">{totalMem} guidance rule{totalMem !== 1 ? "s" : ""}</span>
                            {" "}active during this run
                            {hardCount ? (
                              <> — <span className="text-indigo-600 font-semibold">{hardCount} hard constraint{hardCount !== 1 ? "s" : ""}</span></>
                            ) : null}
                            {softCount ? (
                              <>, {softCount} soft suggestion{softCount !== 1 ? "s" : ""}</>
                            ) : null}
                          </p>
                          {memoriesUsed && memoriesUsed.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {memoriesUsed.slice(0, 6).map((m) => (
                                <span
                                  key={m.id}
                                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                                    m.strength === "hard"
                                      ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {m.strength === "hard" && <Lock className="w-2.5 h-2.5" />}
                                  {m.title}
                                  <span className="text-slate-400">· {m.category}</span>
                                </span>
                              ))}
                              {memoriesUsed.length > 6 && (
                                <span className="text-[10px] text-slate-400 self-center">+{memoriesUsed.length - 6} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Approval events */}
                      {isApproval && (
                        <div className="mt-1 space-y-1">
                          <div className="text-xs text-slate-400 space-x-2">
                            {gmEmail && <span>GM: {gmEmail}</span>}
                            {entry.details.recipient_count && (
                              <span>· {String(entry.details.recipient_count)} recipients</span>
                            )}
                            {entry.details.channel && (
                              <span>· {String(entry.details.channel).replace(/_/g, " ")}</span>
                            )}
                            {approverNotes && <span>· Notes: {approverNotes}</span>}
                          </div>

                          {/* Non-repudiation evidence — shown only for approved events */}
                          {entry.action === "campaign.approval.approved" && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {entry.details.code_verified && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
                                  <KeyRound className="w-2.5 h-2.5" /> Code verified
                                </span>
                              )}
                              {entry.details.explicit_consent && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                                  <ShieldCheck className="w-2.5 h-2.5" /> Consent confirmed
                                </span>
                              )}
                              {entry.details.approver_ip && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                  IP: {String(entry.details.approver_ip)}
                                </span>
                              )}
                              {entry.details.approver_user_agent && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 max-w-[240px] truncate">
                                  <Monitor className="w-2.5 h-2.5 shrink-0" />
                                  {String(entry.details.approver_user_agent).slice(0, 60)}
                                </span>
                              )}
                            </div>
                          )}

                          {entry.details.memories_count && (
                            <p className="text-xs text-slate-400">
                              {String(entry.details.memories_count)} governance rule{Number(entry.details.memories_count) !== 1 ? "s" : ""}
                              {entry.details.hard_constraints ? ` (${String(entry.details.hard_constraints)} hard)` : ""}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Generic audit details (non-governance, non-approval) */}
                      {entry._source === "audit" && !isGovernance && !isApproval && Object.keys(entry.details).length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {Object.entries(entry.details)
                            .filter(([k, v]) => v != null && !["memories_used"].includes(k))
                            .slice(0, 3)
                            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                            .join(" · ")}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1">
                        {entry.entity_type && !isGovernance && !isApproval && (
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{entry.entity_type}</span>
                        )}
                        {entry._source === "agent" && entry.agent_type && (
                          <span className="chip chip-violet capitalize text-[10px]">{entry.agent_type}</span>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400 shrink-0 pt-0.5">{formatRelativeDate(entry.created_at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400 pb-4">
          Showing up to 150 most recent events · Audit log retained per your data policy
        </p>
      </main>
    </>
  );
}
