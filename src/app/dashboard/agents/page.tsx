"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot, Database, Target, Pencil, TrendingUp, Cpu,
  Play, Loader2, CheckCircle, AlertCircle, Zap, Sparkles,
} from "lucide-react";
import { HandwritingPreview } from "@/components/direct-mail/handwriting-preview";

const AGENTS = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    description: "Coordinates all agents end-to-end. Plans campaign execution sequence and delegates to specialists.",
    icon: Cpu,
    model: "claude-opus-4-7",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    border: "border-violet-100",
    cardBg: "bg-gradient-to-br from-violet-50/60 to-white",
  },
  {
    id: "data",
    name: "Data Agent",
    description: "Analyzes customer records, scores churn risk, estimates lifetime value, and identifies segments.",
    icon: Database,
    model: "claude-sonnet-4-6",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    border: "border-sky-100",
    cardBg: "bg-gradient-to-br from-sky-50/60 to-white",
  },
  {
    id: "targeting",
    name: "Targeting Agent",
    description: "Selects the optimal customer audience using propensity scoring and segment analysis.",
    icon: Target,
    model: "claude-sonnet-4-6",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    border: "border-indigo-100",
    cardBg: "bg-gradient-to-br from-indigo-50/60 to-white",
  },
  {
    id: "creative",
    name: "Creative Agent",
    description: "Writes hyper-personalized messages for each customer using visit history and vehicle context.",
    icon: Pencil,
    model: "claude-sonnet-4-6",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    border: "border-emerald-100",
    cardBg: "bg-gradient-to-br from-emerald-50/60 to-white",
  },
  {
    id: "optimization",
    name: "Optimization Agent",
    description: "Learns from campaign outcomes. Extracts anonymized patterns for cross-dealer global learnings.",
    icon: TrendingUp,
    model: "claude-sonnet-4-6",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    border: "border-amber-100",
    cardBg: "bg-gradient-to-br from-amber-50/60 to-white",
  },
];

interface TestResult {
  customerName: string;
  channel: string;
  subject?: string;
  content: string;
  confidence: number;
}

export default function AgentsPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ insights: string; messages: TestResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState("Win back customers who haven't visited in 6–18 months with a personalized direct mail offer.");

  async function runTest() {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/agents/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, channel: "direct_mail", maxCustomers: 3 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent run failed");

      setResult({
        insights: data.dataInsights,
        messages: data.previewMessages,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Header title="AI Agents" subtitle="5-agent swarm powering AutoCDP" />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1400px]">

        {/* Agent cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AGENTS.map((agent) => (
            <div
              key={agent.id}
              className={`rounded-xl border ${agent.border} ${agent.cardBg} p-5 hover:shadow-card-md transition-all duration-200`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${agent.iconBg}`}>
                    <agent.icon className={`w-5 h-5 ${agent.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                    <code className="text-[10px] text-slate-400">{agent.model}</code>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  idle
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{agent.description}</p>
            </div>
          ))}

          {/* Network learning chip */}
          <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-indigo-50/40 p-5 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-700">Network Intelligence</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">
              Anonymized learnings from the AutoCDP dealership network flow into every optimization cycle — your campaigns get smarter with every dealer that runs.
            </p>
            <div className="mt-4 flex items-center gap-1.5">
              <div className="h-1.5 flex-1 bg-violet-100 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-violet-400 rounded-full" />
              </div>
              <span className="text-[10px] text-violet-500 font-medium">Network active</span>
            </div>
          </div>
        </div>

        {/* Test runner */}
        <Tabs defaultValue="test">
          <TabsList>
            <TabsTrigger value="test"><Zap className="w-3.5 h-3.5 mr-1.5" />Test Run</TabsTrigger>
            <TabsTrigger value="mail"><Pencil className="w-3.5 h-3.5 mr-1.5" />Direct Mail Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="test" className="space-y-4 mt-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Run Agent Swarm Test</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Triggers the full orchestrator → data → targeting → creative pipeline against your real customer data. Preview results before sending any mail.
                </p>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-2">Campaign Goal</label>
                  <textarea
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-colors h-24 bg-slate-50/50 placeholder:text-slate-400 text-slate-900"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </div>

                <Button
                  onClick={runTest}
                  disabled={running}
                  className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-sm"
                >
                  {running ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Agents…</>
                  ) : (
                    <><Play className="mr-2 h-4 w-4" /> Run Agent Swarm</>
                  )}
                </Button>

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Agent run failed</p>
                      <p className="text-xs text-red-600 mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="space-y-5 pt-2">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">Agents completed successfully</span>
                    </div>

                    {result.insights && (
                      <div className="p-5 bg-sky-50 border border-sky-100 rounded-xl">
                        <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider mb-2">Data Agent Insights</p>
                        <p className="text-sm text-sky-900 leading-relaxed">{result.insights}</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-900">Generated Messages ({result.messages.length})</p>
                      {result.messages.map((msg, i) => (
                        <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900">{msg.customerName}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 capitalize">
                                {msg.channel}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {Math.round(msg.confidence * 100)}% confidence
                              </span>
                            </div>
                          </div>
                          <div className="p-5">
                            {msg.subject && (
                              <p className="text-xs text-slate-400 mb-2">Subject: <span className="text-slate-600 font-medium">{msg.subject}</span></p>
                            )}
                            <p className="text-sm text-slate-700 leading-relaxed">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mail" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Direct Mail Preview</h2>
                <p className="text-xs text-slate-400 mt-0.5">Preview how handwritten-style mail will appear to recipients.</p>
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
