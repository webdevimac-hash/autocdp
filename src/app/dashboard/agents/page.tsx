"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot, Database, Target, Pencil, TrendingUp, Cpu,
  Play, Loader2, CheckCircle, AlertCircle, Zap,
} from "lucide-react";
import { HandwritingPreview } from "@/components/direct-mail/handwriting-preview";

const AGENTS = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    description: "Coordinates all agents end-to-end. Plans campaign execution sequence and delegates to specialists.",
    icon: Cpu,
    model: "claude-opus-4-7",
    color: "text-purple-600 bg-purple-50 border-purple-200",
    status: "idle",
  },
  {
    id: "data",
    name: "Data Agent",
    description: "Analyzes customer records, scores churn risk, estimates lifetime value, and identifies segments.",
    icon: Database,
    model: "claude-sonnet-4-6",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    status: "idle",
  },
  {
    id: "targeting",
    name: "Targeting Agent",
    description: "Selects the optimal customer audience using propensity scoring and segment analysis.",
    icon: Target,
    model: "claude-sonnet-4-6",
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    status: "idle",
  },
  {
    id: "creative",
    name: "Creative Agent",
    description: "Writes hyper-personalized messages for each customer using visit history and vehicle context.",
    icon: Pencil,
    model: "claude-sonnet-4-6",
    color: "text-green-600 bg-green-50 border-green-200",
    status: "idle",
  },
  {
    id: "optimization",
    name: "Optimization Agent",
    description: "Learns from campaign outcomes. Extracts anonymized patterns for cross-dealer global learnings.",
    icon: TrendingUp,
    model: "claude-sonnet-4-6",
    color: "text-amber-600 bg-amber-50 border-amber-200",
    status: "idle",
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

      <main className="flex-1 p-6 space-y-6">
        {/* Agent cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AGENTS.map((agent) => (
            <Card key={agent.id} className={`border shadow-sm ${agent.color}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-white/70">
                    <agent.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{agent.name}</CardTitle>
                    <code className="text-[10px] opacity-70">{agent.model}</code>
                  </div>
                  <Badge variant="secondary" className="ml-auto text-[10px] bg-white/60">
                    {agent.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs leading-relaxed">
                  {agent.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Test runner */}
        <Tabs defaultValue="test">
          <TabsList>
            <TabsTrigger value="test"><Zap className="w-3.5 h-3.5 mr-1.5" />Test Run</TabsTrigger>
            <TabsTrigger value="mail"><Pencil className="w-3.5 h-3.5 mr-1.5" />Direct Mail Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="test" className="space-y-4 mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Run Agent Swarm Test</CardTitle>
                <CardDescription>
                  Triggers the full orchestrator → data → targeting → creative pipeline against
                  your real customer data. Preview results before sending any mail.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Campaign Goal</label>
                  <textarea
                    className="w-full border rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring h-20"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </div>
                <Button onClick={runTest} disabled={running} className="w-full sm:w-auto">
                  {running ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Agents...</>
                  ) : (
                    <><Play className="mr-2 h-4 w-4" /> Run Agent Swarm</>
                  )}
                </Button>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-700">Agent run failed</p>
                      <p className="text-xs text-red-600 mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Agents completed successfully</span>
                    </div>

                    {result.insights && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Data Agent Insights</p>
                        <p className="text-sm text-blue-900">{result.insights}</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <p className="text-sm font-medium">Generated Messages ({result.messages.length})</p>
                      {result.messages.map((msg, i) => (
                        <div key={i} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{msg.customerName}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">{msg.channel}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {Math.round(msg.confidence * 100)}% confidence
                              </span>
                            </div>
                          </div>
                          {msg.subject && (
                            <p className="text-xs text-muted-foreground">Subject: {msg.subject}</p>
                          )}
                          <p className="text-sm bg-slate-50 rounded p-3 border text-gray-700 leading-relaxed">
                            {msg.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mail" className="mt-4">
            <HandwritingPreview />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
