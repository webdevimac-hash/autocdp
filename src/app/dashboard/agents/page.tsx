"use client";

import { useState, useEffect, Fragment } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database, Target, Pencil, TrendingUp, Cpu,
  Play, Loader2, CheckCircle, AlertCircle, Zap, Sparkles,
  Network, Bot, Lightbulb,
} from "lucide-react";
import { HandwritingPreview } from "@/components/direct-mail/handwriting-preview";
import { cn } from "@/lib/utils";

const AGENTS = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    tagline: "Plans & coordinates the full campaign pipeline",
    description: "Coordinates all agents end-to-end. Interprets the campaign goal, determines execution sequence, and delegates to each specialist with precision.",
    icon: Cpu,
    model: "claude-opus-4-7",
    iconGradient: "from-violet-100 to-violet-50",
    iconColor: "text-violet-600",
    featureCard: "feature-card-violet",
    chipClass: "chip-violet",
    borderColor: "#8B5CF6",
    bgFrom: "#FAF5FF",
    dotColor: "bg-violet-500",
    capabilities: ["Goal parsing", "Task delegation", "Pipeline sequencing"],
  },
  {
    id: "data",
    name: "Data Agent",
    tagline: "Scores, segments, and surfaces customer intelligence",
    description: "Analyzes every customer record in your DMS. Scores churn risk, estimates lifetime value, and surfaces actionable segments for any campaign goal.",
    icon: Database,
    model: "claude-sonnet-4-6",
    iconGradient: "from-sky-100 to-sky-50",
    iconColor: "text-sky-600",
    featureCard: "feature-card-sky",
    chipClass: "chip-sky",
    borderColor: "#0EA5E9",
    bgFrom: "#F0F9FF",
    dotColor: "bg-sky-500",
    capabilities: ["Churn scoring", "LTV estimation", "Segment analysis"],
  },
  {
    id: "targeting",
    name: "Targeting Agent",
    tagline: "Selects the highest-propensity audience",
    description: "Selects the optimal customer audience using propensity modeling and multi-factor scoring — so every piece of mail goes to someone likely to respond.",
    icon: Target,
    model: "claude-sonnet-4-6",
    iconGradient: "from-indigo-100 to-indigo-50",
    iconColor: "text-indigo-600",
    featureCard: "feature-card-indigo",
    chipClass: "chip-indigo",
    borderColor: "#6366F1",
    bgFrom: "#EEF2FF",
    dotColor: "bg-indigo-500",
    capabilities: ["Propensity scoring", "Audience sizing", "Exclusion logic"],
  },
  {
    id: "creative",
    name: "Creative Agent",
    tagline: "Writes hyper-personalized copy per customer",
    description: "Writes a unique, personalized message for each recipient using their full service history, vehicle context, and visit cadence. Every word earns its place.",
    icon: Pencil,
    model: "claude-sonnet-4-6",
    iconGradient: "from-emerald-100 to-emerald-50",
    iconColor: "text-emerald-600",
    featureCard: "feature-card-emerald",
    chipClass: "chip-emerald",
    borderColor: "#10B981",
    bgFrom: "#ECFDF5",
    dotColor: "bg-emerald-500",
    capabilities: ["1:1 personalization", "Tone matching", "Offer integration"],
  },
  {
    id: "optimization",
    name: "Optimization Agent",
    tagline: "Learns from every campaign to sharpen the next",
    description: "Analyzes campaign results and extracts anonymized learnings that improve targeting, creative, and timing recommendations for every future campaign.",
    icon: TrendingUp,
    model: "claude-sonnet-4-6",
    iconGradient: "from-amber-100 to-amber-50",
    iconColor: "text-amber-600",
    featureCard: "feature-card-amber",
    chipClass: "chip-amber",
    borderColor: "#F59E0B",
    bgFrom: "#FFFBEB",
    dotColor: "bg-amber-500",
    capabilities: ["Response tracking", "Template scoring", "A/B learning"],
  },
];

interface TestResult {
  customerName: string;
  channel: string;
  subject?: string;
  content: string;
  reasoning?: string;
  confidence: number;
}

// -1 = never run, 0-4 = agent index currently running, 5 = all done
type RunStep = -1 | 0 | 1 | 2 | 3 | 4 | 5;

function getAgentStatus(idx: number, step: RunStep) {
  if (step === -1) return "idle";
  if (step === 5) return "done";
  if (idx < step) return "done";
  if (idx === step) return "running";
  return "pending";
}

export default function AgentsPage() {
  const [running, setRunning] = useState(false);
  const [runningStep, setRunningStep] = useState<RunStep>(-1);
  const [result, setResult] = useState<{ insights: string; messages: TestResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState(
    "Win back customers who haven't visited in 6–18 months with a personalized direct mail offer."
  );

  useEffect(() => {
    if (!running) return;
    const timers = AGENTS.map((_, i) =>
      setTimeout(() => setRunningStep(i as RunStep), i * 1600)
    );
    return () => timers.forEach(clearTimeout);
  }, [running]);

  async function runTest() {
    setRunning(true);
    setError(null);
    setResult(null);
    setRunningStep(0);

    try {
      const res = await fetch("/api/agents/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, channel: "direct_mail", maxCustomers: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent run failed");
      setResult({ insights: data.dataInsights, messages: data.previewMessages });
      setRunningStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setRunningStep(-1);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Header title="AI Agents" subtitle="5-agent swarm powering AutoCDP" />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">

        {/* ── Swarm overview strip ─────────────────────────────── */}
        <div
          className="rounded-[var(--radius)] overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #0B1526 0%, #0F1E35 100%)" }}
        >
          <div className="dark-grid absolute inset-0 opacity-60 pointer-events-none" />
          <div className="relative px-5 sm:px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">

              {/* Title */}
              <div className="flex items-center gap-3 sm:w-44 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white/60" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white leading-tight">5-Agent Swarm</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {runningStep === -1 ? (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        <span className="text-[10px] text-slate-500">All agents idle</span>
                      </>
                    ) : runningStep === 5 ? (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-medium">Run complete</span>
                      </>
                    ) : (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-[10px] text-indigo-300 font-medium">Pipeline running…</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Pipeline nodes */}
              <div className="flex-1 flex items-center min-w-0">
                {AGENTS.map((agent, i) => (
                  <Fragment key={agent.id}>
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500"
                        style={
                          runningStep === 5 || i < runningStep
                            ? { borderColor: "#34d399", background: "rgba(16, 185, 129, 0.15)" }
                            : runningStep === i
                            ? { borderColor: agent.borderColor, background: `${agent.borderColor}18`, boxShadow: `0 0 14px ${agent.borderColor}50` }
                            : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }
                        }
                      >
                        {runningStep === 5 || i < runningStep ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        ) : runningStep === i ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: agent.borderColor }} />
                        ) : (
                          <agent.icon className="w-3 h-3 text-white/25" />
                        )}
                      </div>
                      <span className="text-[8px] text-white/25 mt-1 font-medium hidden sm:block tracking-wide">
                        {agent.name.split(" ")[0].toUpperCase()}
                      </span>
                    </div>
                    {i < AGENTS.length - 1 && (
                      <div
                        className="h-px flex-1 mx-2 transition-all duration-700"
                        style={{
                          background:
                            runningStep === 5 || i < (runningStep as number) - 1
                              ? "rgba(52, 211, 153, 0.4)"
                              : "rgba(255,255,255,0.07)",
                        }}
                      />
                    )}
                  </Fragment>
                ))}
              </div>

              {/* Quick stats */}
              <div className="flex gap-5 sm:gap-6 shrink-0 border-t border-white/8 sm:border-0 pt-4 sm:pt-0">
                {[
                  { label: "Pipeline", value: "~8s avg" },
                  { label: "Network", value: "40+ dealers" },
                  { label: "Accuracy", value: "94.2%" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-[9px] text-white/30 font-semibold uppercase tracking-widest">{s.label}</p>
                    <p className="text-[13px] font-semibold text-white mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Agent cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {AGENTS.map((agent, agentIdx) => {
            const status = getAgentStatus(agentIdx, runningStep);
            const isRunning = status === "running";
            const isDone = status === "done";

            return (
              <div
                key={agent.id}
                className={cn(
                  `feature-card ${agent.featureCard} rounded-[var(--radius)] border shadow-card p-5 relative overflow-hidden transition-all duration-500`
                )}
                style={{
                  background: `linear-gradient(145deg, ${agent.bgFrom} 0%, #FFFFFF 55%)`,
                  borderColor: isRunning ? agent.borderColor : undefined,
                  boxShadow: isRunning
                    ? `0 0 0 1.5px ${agent.borderColor}40, 0 8px 24px -4px ${agent.borderColor}22`
                    : undefined,
                }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[var(--radius)] transition-opacity duration-500"
                  style={{
                    background: agent.borderColor,
                    opacity: status === "idle" || status === "pending" ? 0.3 : 1,
                  }}
                />

                {/* Status — top right */}
                <div className="absolute top-4 right-4">
                  {isRunning && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ background: agent.borderColor }}
                      />
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: agent.borderColor }}
                      >
                        Running
                      </span>
                    </div>
                  )}
                  {isDone && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Done</span>
                    </div>
                  )}
                  {!isRunning && !isDone && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {status === "pending" ? "Pending" : "Idle"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Icon + Name */}
                <div className="flex items-start gap-3 mb-3 pr-20">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shrink-0 transition-all duration-300",
                      agent.iconGradient,
                      isRunning && "shadow-md"
                    )}
                    style={isRunning ? { boxShadow: `0 0 0 2px ${agent.borderColor}30` } : {}}
                  >
                    {isRunning ? (
                      <Loader2 className={cn("w-5 h-5 animate-spin", agent.iconColor)} />
                    ) : isDone ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <agent.icon className={cn("w-5 h-5", agent.iconColor)} />
                    )}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-[13px] font-semibold text-slate-900 leading-tight">{agent.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{agent.tagline}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 leading-relaxed mb-3.5">{agent.description}</p>

                {/* Capability chips */}
                <div className="flex flex-wrap gap-1.5 mb-3.5">
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className={cn("chip", agent.chipClass)}
                      style={{ fontSize: "10px", padding: "2px 7px" }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between">
                  <code className="text-[10px] text-slate-400 font-mono">{agent.model}</code>
                  {isRunning && (
                    <div
                      className="flex items-center gap-1.5 text-[10px] font-mono"
                      style={{ color: agent.borderColor }}
                    >
                      <div
                        className="w-1 h-1 rounded-full animate-ping"
                        style={{ background: agent.borderColor }}
                      />
                      processing…
                    </div>
                  )}
                  {isDone && (
                    <span className="text-[10px] font-semibold text-emerald-500">✓ complete</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Network Intelligence card */}
          <div
            className="feature-card feature-card-violet rounded-[var(--radius)] border border-slate-200 shadow-card p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(145deg, #F5F3FF 0%, #FFFFFF 55%)" }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[var(--radius)]"
              style={{ background: "#8B5CF6", opacity: 0.35 }}
            />

            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 flex items-center justify-center shrink-0">
                <Network className="w-5 h-5 text-violet-600" />
              </div>
              <div className="pt-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-slate-900">Network Intelligence</p>
                  <span className="chip chip-violet" style={{ fontSize: "9px", padding: "1px 6px" }}>LIVE</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Cross-dealer learning layer</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Anonymized learnings from the AutoCDP network flow into every optimization cycle — your campaigns get smarter with every dealer that runs.
            </p>

            <div className="space-y-2 mb-4">
              {[
                { label: "Dealerships contributing", value: "40+", color: "#8B5CF6" },
                { label: "Customer records analyzed", value: "2.3M", color: "#6366F1" },
                { label: "Template patterns learned", value: "1,247", color: "#7C3AED" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">{item.label}</span>
                  <span className="text-[11px] font-bold" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full w-[68%] rounded-full"
                style={{ background: "linear-gradient(90deg, #8B5CF6, #6366F1)" }}
              />
            </div>

            <div className="pt-3 border-t border-slate-100/80 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-semibold text-slate-500">Network active — updates every 24h</span>
            </div>
          </div>
        </div>

        {/* ── Tabs: Test runner + Direct Mail ─────────────────── */}
        <Tabs defaultValue="test">
          <TabsList>
            <TabsTrigger value="test">
              <Zap className="w-3.5 h-3.5 mr-1.5" />Test Run
            </TabsTrigger>
            <TabsTrigger value="mail">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />Direct Mail Preview
            </TabsTrigger>
          </TabsList>

          {/* ── Test Run ── */}
          <TabsContent value="test" className="space-y-4 mt-4">
            <div className="inst-panel">
              <div className="inst-panel-header">
                <div>
                  <div className="inst-panel-title">Run Agent Swarm Test</div>
                  <div className="inst-panel-subtitle">
                    Triggers the full orchestrator → data → targeting → creative pipeline. Preview before any mail is sent.
                  </div>
                </div>
                {runningStep === 5 && (
                  <span className="chip chip-emerald">
                    <CheckCircle className="w-2.5 h-2.5" /> Pipeline complete
                  </span>
                )}
                {running && (
                  <span className="chip chip-indigo">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Running
                  </span>
                )}
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-2 uppercase tracking-wide">
                    Campaign Goal
                  </label>
                  <textarea
                    className="w-full border border-slate-200 rounded-[var(--radius)] p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors h-24 bg-slate-50/50 placeholder:text-slate-400 text-slate-900"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    disabled={running}
                  />
                </div>

                <Button onClick={runTest} disabled={running} className="h-10 px-6">
                  {running ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Agents…</>
                  ) : (
                    <><Play className="mr-2 h-4 w-4" /> Run Agent Swarm</>
                  )}
                </Button>

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-[var(--radius)]">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Agent run failed</p>
                      <p className="text-xs text-red-600 mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="space-y-5 pt-1">
                    {/* Agent activity log */}
                    <div className="inst-panel">
                      <div className="inst-panel-header">
                        <p className="inst-panel-title">Agent Activity Log</p>
                        <span className="chip chip-emerald">
                          <CheckCircle className="w-2.5 h-2.5" /> All agents complete
                        </span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {AGENTS.map((agent) => (
                          <div key={agent.id} className="px-5 py-3 flex items-center gap-3">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: `${agent.borderColor}15` }}
                            >
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[12px] font-semibold text-slate-700">{agent.name}</span>
                              <span className="text-[11px] text-slate-400 ml-2">completed successfully</span>
                            </div>
                            <code className="text-[10px] text-slate-400 font-mono shrink-0">{agent.model}</code>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Data insights */}
                    {result.insights && (
                      <div className="p-5 bg-sky-50 border border-sky-100 rounded-[var(--radius)]">
                        <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-2">
                          Data Agent Insights
                        </p>
                        <p className="text-sm text-sky-900 leading-relaxed">{result.insights}</p>
                      </div>
                    )}

                    {/* Generated messages */}
                    <div className="space-y-3">
                      <p className="text-[13px] font-semibold text-slate-900">
                        Generated Messages ({result.messages.length})
                      </p>
                      {result.messages.map((msg, i) => (
                        <div
                          key={i}
                          className="border border-slate-200 rounded-[var(--radius)] overflow-hidden shadow-card"
                        >
                          <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                            <p className="text-[13px] font-semibold text-slate-900">{msg.customerName}</p>
                            <div className="flex items-center gap-2">
                              <span className="chip chip-indigo capitalize">{msg.channel}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {Math.round(msg.confidence * 100)}% confidence
                              </span>
                            </div>
                          </div>
                          <div className="p-5 space-y-3">
                            {msg.subject && (
                              <p className="text-xs text-slate-400">
                                Subject:{" "}
                                <span className="text-slate-600 font-medium">{msg.subject}</span>
                              </p>
                            )}
                            <p className="text-sm text-slate-700 leading-relaxed">{msg.content}</p>
                            {msg.reasoning && (
                              <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                  <span className="font-semibold text-slate-600">Why this approach: </span>
                                  {msg.reasoning}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Direct Mail Preview ── */}
          <TabsContent value="mail" className="mt-4">
            <div className="inst-panel">
              <div className="inst-panel-header">
                <div>
                  <div className="inst-panel-title">Direct Mail Preview</div>
                  <div className="inst-panel-subtitle">
                    Handwriting engine renders a unique piece for each customer. PostGrid + USPS First Class delivers in 2–3 days.
                  </div>
                </div>
                <span className="ai-badge">
                  <Sparkles className="w-2.5 h-2.5" />AI
                </span>
              </div>
              <div className="p-6">
                <HandwritingPreview />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
