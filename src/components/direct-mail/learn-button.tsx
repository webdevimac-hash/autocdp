"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, Loader2, CheckCircle } from "lucide-react";

interface LearnButtonProps {
  mailPieceIds?: string[];   // specific pieces to analyze; omit = last 30d
  lookbackDays?: number;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
}

export function LearnButton({
  mailPieceIds,
  lookbackDays = 30,
  label = "Learn from Campaign",
  variant = "outline",
  size = "sm",
}: LearnButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleLearn() {
    setLoading(true);
    setDone(false);

    try {
      const res = await fetch("/api/mail/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailPieceIds: mailPieceIds?.length ? mailPieceIds : undefined,
          lookbackDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Optimization failed");

      setDone(true);

      if (data.status === "skipped") {
        toast({
          title: "Not enough data yet",
          description: data.insights ?? "Send more mail pieces to enable pattern extraction.",
        });
      } else {
        toast({
          title:
            data.patternsWritten > 0
              ? `${data.patternsWritten} new pattern${data.patternsWritten === 1 ? "" : "s"} learned`
              : "Analysis complete",
          description: data.insights ?? "Optimization agent ran successfully.",
        });
      }

      // Reset the done indicator after 4s
      setTimeout(() => setDone(false), 4000);
    } catch (err) {
      toast({
        title: "Optimization failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLearn}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : done ? (
        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <BrainCircuit className="w-3.5 h-3.5" />
      )}
      {loading ? "Learning…" : done ? "Done" : label}
    </Button>
  );
}
