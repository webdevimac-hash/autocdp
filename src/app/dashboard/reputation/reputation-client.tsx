"use client";

/**
 * Reputation Client — Google Business Profile Hub
 *
 * Tabs:
 *  - Overview: rating distribution, KPI cards, quick actions
 *  - Reviews:  list with star filter, AI Reply modal, inline edit, delete reply
 *  - Posts:    list of GBP updates, AI-generate + publish modal
 *  - Q&A:      list of questions with AI Answer modal
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Star, MessageSquare, Plus, Sparkles, RefreshCw,
  ChevronDown, ChevronRight, CheckCircle, Clock, Trash2,
  AlertCircle, X, ThumbsUp, Send, FileText, HelpCircle,
  ExternalLink, Zap, Building2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GbpReview {
  id:               string;
  gbp_review_id:    string;
  reviewer_name:    string | null;
  rating:           string;
  rating_int:       number;
  comment:          string | null;
  create_time:      string | null;
  reply_comment:    string | null;
  reply_is_ai:      boolean;
  reply_status:     "none" | "draft" | "posted" | "deleted";
}

interface GbpPost {
  id:                  string;
  topic_type:          string;
  summary:             string;
  call_to_action_type: string | null;
  call_to_action_url:  string | null;
  state:               string;
  is_ai_generated:     boolean;
  create_time:         string | null;
  created_at:          string;
}

interface GbpQuestion {
  id:            string;
  question_text: string;
  author_name:   string | null;
  question_time: string | null;
  upvote_count:  number;
  answer_text:   string | null;
  answer_author: string | null;
  answer_time:   string | null;
  answer_is_ai:  boolean;
  answer_status: "unanswered" | "draft" | "posted";
}

interface Stats {
  total:      number;
  avgRating:  number;
  pending:    number;
  unanswered: number;
  postsLive:  number;
}

interface Props {
  dealershipId:   string;
  dealershipName: string;
  isConnected:    boolean;
  connectionMeta: Record<string, unknown> | null;
  reviews:        Record<string, unknown>[];
  posts:          Record<string, unknown>[];
  questions:      Record<string, unknown>[];
  stats:          Stats;
}

type Tab = "overview" | "reviews" | "posts" | "qanda";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function starLabel(r: string): number {
  return { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[r] ?? 0;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StarRow({ n, filled = false }: { n: number; filled?: boolean }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= n ? "fill-amber-400 text-amber-400" : filled ? "fill-slate-200 text-slate-200" : "text-slate-300"}`}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Not-connected empty state
// ---------------------------------------------------------------------------

function ConnectPrompt({ dealershipName }: { dealershipName: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
          <Star className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Connect Google Business Profile</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Link your GBP account for {dealershipName} to pull reviews, auto-respond with AI, publish posts, and answer Q&A — all from one place.
          </p>
        </div>
        <div className="space-y-3">
          <a
            href="/api/integrations/gbp/auth"
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Connect Google Business Profile
          </a>
          <p className="text-xs text-slate-400">
            Requires a Google account with access to your GBP location.
          </p>
        </div>
        <div className="border border-slate-200 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">What you&apos;ll get</p>
          {[
            "Pull all Google reviews automatically",
            "AI-generated professional replies (one-click)",
            "Auto-publish business updates & offers",
            "Answer customer Q&A with Claude",
            "Daily sync cron keeps everything current",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, tone = "slate" }: {
  label: string; value: string | number; sub?: string;
  tone?: "slate" | "amber" | "emerald" | "rose" | "blue";
}) {
  const colours: Record<string, string> = {
    slate:   "bg-white border-slate-200",
    amber:   "bg-amber-50 border-amber-200",
    emerald: "bg-emerald-50 border-emerald-200",
    rose:    "bg-rose-50 border-rose-200",
    blue:    "bg-blue-50 border-blue-200",
  };
  const valueColours: Record<string, string> = {
    slate:   "text-slate-900",
    amber:   "text-amber-700",
    emerald: "text-emerald-700",
    rose:    "text-rose-700",
    blue:    "text-blue-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colours[tone]}`}>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColours[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rating distribution bar
// ---------------------------------------------------------------------------

function RatingBar({ distribution, total }: {
  distribution: Record<number, number>;
  total: number;
}) {
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star] ?? 0;
        const pct   = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 w-4 text-right">{star}</span>
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-slate-400 w-6 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reply Modal
// ---------------------------------------------------------------------------

function ReplyModal({
  review,
  onClose,
  onPosted,
}: {
  review: GbpReview;
  onClose: () => void;
  onPosted: (reviewId: string, text: string, isAi: boolean) => void;
}) {
  const [text, setText]               = useState(review.reply_comment ?? "");
  const [generating, setGenerating]   = useState(false);
  const [posting, startPost]          = useTransition();
  const [error, setError]             = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/reputation/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true, draftOnly: true }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setText(data.reply ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setGenerating(false);
    }
  }

  function handlePost() {
    startPost(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/reputation/reviews/${review.id}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json() as { reply?: string; isAi?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Post failed");
        onPosted(review.id, data.reply ?? text, data.isAi ?? false);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  }

  const ratingInt = starLabel(review.rating);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">Reply to Review</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRow n={ratingInt} />
              <span className="text-sm text-slate-500">{review.reviewer_name ?? "Anonymous"}</span>
              <span className="text-xs text-slate-400">· {fmtDate(review.create_time)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Review text */}
        <div className="px-5 pt-4">
          {review.comment ? (
            <blockquote className="text-sm text-slate-600 italic bg-slate-50 rounded-lg p-3 border-l-4 border-slate-200">
              &ldquo;{review.comment}&rdquo;
            </blockquote>
          ) : (
            <p className="text-sm text-slate-400 italic">No written comment — star rating only.</p>
          )}
        </div>

        {/* Reply editor */}
        <div className="p-5 flex-1 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Your Reply</label>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {generating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {generating ? "Generating…" : "AI Generate"}
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Write a professional reply, or click AI Generate to let Claude craft one…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{text.length} / 4096 chars</span>
            {text.length > 4096 && <span className="text-rose-500">Too long — GBP limit is 4096 chars</span>}
          </div>
          {error && (
            <p className="text-sm text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2 px-4 rounded-lg text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={!text.trim() || posting || text.length > 4096}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {posting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {posting ? "Posting…" : "Post Reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Post Modal
// ---------------------------------------------------------------------------

function CreatePostModal({
  dealershipId,
  onClose,
  onCreated,
}: {
  dealershipId: string;
  onClose: () => void;
  onCreated: (post: GbpPost) => void;
}) {
  const [mode, setMode]             = useState<"prompt" | "manual">("prompt");
  const [prompt, setPrompt]         = useState("");
  const [summary, setSummary]       = useState("");
  const [ctaType, setCtaType]       = useState("LEARN_MORE");
  const [ctaUrl, setCtaUrl]         = useState("");
  const [draftOnly, setDraftOnly]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [posting, startPost]        = useTransition();
  const [preview, setPreview]       = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/reputation/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, draftOnly: true }),
      });
      const data = await res.json() as { post?: { summary?: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPreview(data.post?.summary ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setGenerating(false);
    }
  }

  function handlePublish() {
    startPost(async () => {
      setError(null);
      try {
        const body = mode === "prompt"
          ? { prompt, draftOnly }
          : { manual: true, summary, callToActionType: ctaType, callToActionUrl: ctaUrl, draftOnly };

        const res = await fetch("/api/reputation/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json() as { post?: Record<string, unknown>; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed");
        onCreated(data.post as unknown as GbpPost);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Create GBP Post</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(["prompt", "manual"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${
                  mode === m
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {m === "prompt" ? "✨ AI Generate" : "✏️ Write Manually"}
              </button>
            ))}
          </div>

          {mode === "prompt" ? (
            <div className="space-y-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Describe what you want to post. E.g. 'Monthly service special — 10% off oil changes this weekend only'"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating}
                className="flex items-center gap-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Generating…" : "Preview with AI"}
              </button>
              {preview !== null && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Preview</p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={6}
                placeholder="Write your post content (max 1500 chars)…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">Call to Action</label>
                  <select
                    value={ctaType}
                    onChange={(e) => setCtaType(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {["LEARN_MORE", "SHOP_NOW", "BOOK", "CALL"].map((t) => (
                      <option key={t} value={t}>{t.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">CTA URL</label>
                  <input
                    type="url"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Draft toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={draftOnly}
              onChange={(e) => setDraftOnly(e.target.checked)}
              className="rounded"
            />
            Save as draft (don&apos;t publish to GBP yet)
          </label>

          {error && (
            <p className="text-sm text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2 px-4 rounded-lg text-sm transition-colors">Cancel</button>
          <button
            onClick={handlePublish}
            disabled={posting || (mode === "prompt" ? !prompt.trim() : !summary.trim())}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {posting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {posting ? "Publishing…" : draftOnly ? "Save Draft" : "Publish Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Answer Modal
// ---------------------------------------------------------------------------

function AnswerModal({
  question,
  onClose,
  onAnswered,
}: {
  question: GbpQuestion;
  onClose: () => void;
  onAnswered: (questionId: string, text: string) => void;
}) {
  const [text, setText]             = useState(question.answer_text ?? "");
  const [generating, setGenerating] = useState(false);
  const [posting, startPost]        = useTransition();
  const [error, setError]           = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/qanda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", questionId: question.id, generate: true }),
      });
      const data = await res.json() as { answer?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setText(data.answer ?? "");
      onAnswered(question.id, data.answer ?? "");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setGenerating(false);
    }
  }

  function handlePost() {
    startPost(async () => {
      setError(null);
      try {
        const res = await fetch("/api/reputation/qanda", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "answer", questionId: question.id, text }),
        });
        const data = await res.json() as { answer?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed");
        onAnswered(question.id, data.answer ?? text);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">Answer Question</h3>
            <p className="text-xs text-slate-400 mt-0.5">{question.author_name ?? "Anonymous"} · {fmtDate(question.question_time)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <blockquote className="text-sm text-slate-700 italic bg-blue-50 rounded-lg p-3 border-l-4 border-blue-300">
            &ldquo;{question.question_text}&rdquo;
          </blockquote>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Your Answer</label>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generating ? "Generating & Posting…" : "AI Answer & Post"}
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Write your answer, or click AI Answer & Post to auto-generate…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && (
            <p className="text-sm text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2 px-4 rounded-lg text-sm transition-colors">Cancel</button>
          <button
            onClick={handlePost}
            disabled={!text.trim() || posting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {posting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {posting ? "Posting…" : "Post Answer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReputationClient({
  dealershipId,
  dealershipName,
  isConnected,
  connectionMeta,
  reviews: rawReviews,
  posts: rawPosts,
  questions: rawQuestions,
  stats,
}: Props) {
  const router = useRouter();
  const [tab, setTab]                   = useState<Tab>("overview");
  const [reviews, setReviews]           = useState<GbpReview[]>(rawReviews as unknown as GbpReview[]);
  const [posts, setPosts]               = useState<GbpPost[]>(rawPosts as unknown as GbpPost[]);
  const [questions, setQuestions]       = useState<GbpQuestion[]>(rawQuestions as unknown as GbpQuestion[]);
  const [localStats, setLocalStats]     = useState<Stats>(stats);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [replyFilter, setReplyFilter]   = useState<"all" | "pending" | "posted">("all");
  const [replyTarget, setReplyTarget]   = useState<GbpReview | null>(null);
  const [answerTarget, setAnswerTarget] = useState<GbpQuestion | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [syncing, startSync]            = useTransition();

  if (!isConnected) return <ConnectPrompt dealershipName={dealershipName} />;

  // Derived
  const ratingDistribution: Record<number, number> = {};
  for (const r of reviews) {
    const n = r.rating_int ?? starLabel(r.rating);
    ratingDistribution[n] = (ratingDistribution[n] ?? 0) + 1;
  }

  const filteredReviews = reviews.filter((r) => {
    const rn = r.rating_int ?? starLabel(r.rating);
    if (ratingFilter !== null && rn !== ratingFilter) return false;
    if (replyFilter === "pending" && r.reply_status !== "none") return false;
    if (replyFilter === "posted"  && r.reply_status !== "posted") return false;
    return true;
  });

  function handleSync() {
    startSync(async () => {
      await fetch("/api/reputation/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      await fetch("/api/reputation/qanda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      router.refresh();
    });
  }

  function handleReplyPosted(reviewId: string, text: string, isAi: boolean) {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, reply_comment: text, reply_is_ai: isAi, reply_status: "posted" }
          : r
      )
    );
    setLocalStats((s) => ({ ...s, pending: Math.max(0, s.pending - 1) }));
  }

  function handleReplyDeleted(reviewId: string) {
    setReviews((prev) =>
      prev.map((r) => r.id === reviewId ? { ...r, reply_comment: null, reply_status: "deleted" } : r)
    );
  }

  async function handleDeleteReply(reviewId: string) {
    await fetch(`/api/reputation/reviews/${reviewId}/reply`, { method: "DELETE" });
    handleReplyDeleted(reviewId);
  }

  function handlePostCreated(post: GbpPost) {
    setPosts((prev) => [post, ...prev]);
    setLocalStats((s) => ({ ...s, postsLive: s.postsLive + (post.state === "live" ? 1 : 0) }));
  }

  function handleAnswered(questionId: string, text: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, answer_text: text, answer_status: "posted" }
          : q
      )
    );
    setLocalStats((s) => ({ ...s, unanswered: Math.max(0, s.unanswered - 1) }));
  }

  const locationName = (connectionMeta?.location_name as string | undefined) ?? "Connected";

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "reviews",  label: "Reviews",  count: reviews.length },
    { id: "posts",    label: "Posts",    count: posts.length },
    { id: "qanda",    label: "Q&A",      count: questions.length },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <h1 className="text-xl font-semibold text-slate-900">Reputation</h1>
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                GBP Connected
              </span>
            </div>
            <p className="text-sm text-slate-500">{locationName} · {dealershipName}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open GBP
            </a>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                  tab === t.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-6 max-w-4xl">
            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard label="Total Reviews" value={localStats.total} tone="slate" />
              <KpiCard
                label="Avg Rating"
                value={localStats.avgRating > 0 ? `${localStats.avgRating} ★` : "—"}
                tone="amber"
              />
              <KpiCard
                label="Pending Replies"
                value={localStats.pending}
                tone={localStats.pending > 0 ? "rose" : "slate"}
                sub={localStats.pending > 0 ? "Need response" : "All replied"}
              />
              <KpiCard
                label="Unanswered Q&A"
                value={localStats.unanswered}
                tone={localStats.unanswered > 0 ? "amber" : "slate"}
              />
              <KpiCard label="Live Posts" value={localStats.postsLive} tone="blue" />
            </div>

            {/* Rating distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Rating Distribution</h3>
                <RatingBar distribution={ratingDistribution} total={localStats.total} />
              </div>

              {/* Quick actions */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => { setReplyFilter("pending"); setTab("reviews"); }}
                    className="flex items-center justify-between w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="w-4 h-4 text-rose-500" />
                      <span className="text-sm text-slate-700">Reply to pending reviews</span>
                    </div>
                    <span className={`text-xs font-semibold ${localStats.pending > 0 ? "text-rose-600" : "text-slate-400"}`}>
                      {localStats.pending} pending
                    </span>
                  </button>
                  <button
                    onClick={() => setShowPostModal(true)}
                    className="flex items-center justify-between w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-slate-700">Publish a new GBP post</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                  <button
                    onClick={() => setTab("qanda")}
                    className="flex items-center justify-between w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-amber-500" />
                      <span className="text-sm text-slate-700">Answer open questions</span>
                    </div>
                    <span className={`text-xs font-semibold ${localStats.unanswered > 0 ? "text-amber-600" : "text-slate-400"}`}>
                      {localStats.unanswered} unanswered
                    </span>
                  </button>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center justify-between w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <Zap className="w-4 h-4 text-violet-500" />
                      <span className="text-sm text-slate-700">Sync from Google now</span>
                    </div>
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${syncing ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Recent reviews preview */}
            {reviews.slice(0, 3).length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">Recent Reviews</h3>
                  <button onClick={() => setTab("reviews")} className="text-xs text-blue-600 hover:text-blue-800">View all →</button>
                </div>
                <div className="space-y-3">
                  {reviews.slice(0, 3).map((r) => (
                    <ReviewRow
                      key={r.id}
                      review={r}
                      onReply={setReplyTarget}
                      onDelete={handleDeleteReply}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS ──────────────────────────────────────────────────────── */}
        {tab === "reviews" && (
          <div className="space-y-4 max-w-4xl">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filter:</span>
              {/* Rating filter */}
              {[null, 5, 4, 3, 2, 1].map((n) => (
                <button
                  key={n ?? "all"}
                  onClick={() => setRatingFilter(n)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    ratingFilter === n
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {n === null ? "All Stars" : (
                    <><Star className="w-3 h-3 fill-current" />{n}</>
                  )}
                </button>
              ))}
              <div className="h-4 w-px bg-slate-200 mx-1" />
              {/* Reply status filter */}
              {(["all", "pending", "posted"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setReplyFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    replyFilter === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-400">{filteredReviews.length} reviews</span>
            </div>

            {filteredReviews.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <Star className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No reviews match your filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReviews.map((r) => (
                  <ReviewRow key={r.id} review={r} onReply={setReplyTarget} onDelete={handleDeleteReply} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── POSTS ────────────────────────────────────────────────────────── */}
        {tab === "posts" && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{posts.length} posts</p>
              <button
                onClick={() => setShowPostModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Post
              </button>
            </div>

            {posts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm mb-4">No posts yet. Publish your first GBP update.</p>
                <button
                  onClick={() => setShowPostModal(true)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                  <Sparkles className="w-4 h-4" />
                  AI Generate Post
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            p.state === "live"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : p.state === "draft"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-50 text-slate-500 border-slate-200"
                          }`}>
                            {p.state.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-400">{p.topic_type}</span>
                          {p.is_ai_generated && (
                            <span className="flex items-center gap-0.5 text-xs text-violet-500">
                              <Sparkles className="w-3 h-3" /> AI
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-800 line-clamp-3">{p.summary}</p>
                        {p.call_to_action_type && (
                          <p className="text-xs text-blue-600 mt-1.5">
                            CTA: {p.call_to_action_type.replace("_", " ")}
                            {p.call_to_action_url && (
                              <a href={p.call_to_action_url} target="_blank" rel="noopener noreferrer" className="ml-1 hover:underline">
                                {p.call_to_action_url.replace(/^https?:\/\//, "")}
                              </a>
                            )}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{fmtDate(p.create_time ?? p.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Q&A ──────────────────────────────────────────────────────────── */}
        {tab === "qanda" && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {questions.length} questions · {localStats.unanswered} unanswered
              </p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                Sync Q&A
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No Q&A found. Sync from GBP to pull questions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q) => (
                  <div key={q.id} className={`bg-white border rounded-xl p-4 ${
                    q.answer_status === "unanswered"
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-slate-200"
                  }`}>
                    <div className="flex items-start gap-3">
                      <HelpCircle className={`w-4 h-4 mt-0.5 shrink-0 ${
                        q.answer_status === "unanswered" ? "text-amber-500" : "text-slate-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-slate-500 font-medium">{q.author_name ?? "Anonymous"}</span>
                          <span className="text-xs text-slate-400">· {fmtDate(q.question_time)}</span>
                          {q.upvote_count > 0 && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <ThumbsUp className="w-3 h-3" /> {q.upvote_count}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-800 font-medium">{q.question_text}</p>

                        {q.answer_text ? (
                          <div className="mt-2 pl-3 border-l-2 border-emerald-300">
                            <div className="flex items-center gap-1.5 mb-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-xs text-emerald-600 font-medium">Answered</span>
                              {q.answer_is_ai && <span className="text-xs text-violet-500 flex items-center gap-0.5"><Sparkles className="w-3 h-3" /> AI</span>}
                            </div>
                            <p className="text-xs text-slate-600">{q.answer_text}</p>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <button
                              onClick={() => setAnswerTarget(q)}
                              className="flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Answer with AI
                            </button>
                          </div>
                        )}
                      </div>
                      {q.answer_status === "unanswered" && (
                        <span className="shrink-0 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          Unanswered
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {replyTarget && (
        <ReplyModal
          review={replyTarget}
          onClose={() => setReplyTarget(null)}
          onPosted={handleReplyPosted}
        />
      )}
      {showPostModal && (
        <CreatePostModal
          dealershipId={dealershipId}
          onClose={() => setShowPostModal(false)}
          onCreated={handlePostCreated}
        />
      )}
      {answerTarget && (
        <AnswerModal
          question={answerTarget}
          onClose={() => setAnswerTarget(null)}
          onAnswered={handleAnswered}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review row (used in both Overview and Reviews tabs)
// ---------------------------------------------------------------------------

function ReviewRow({
  review,
  onReply,
  onDelete,
  compact = false,
}: {
  review: GbpReview;
  onReply: (r: GbpReview) => void;
  onDelete: (id: string) => Promise<void>;
  compact?: boolean;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const rn = review.rating_int ?? starLabel(review.rating);

  const borderColour =
    rn >= 4 ? "border-slate-200" :
    rn === 3 ? "border-amber-200 bg-amber-50/20" :
    "border-rose-200 bg-rose-50/20";

  return (
    <div className={`bg-white border rounded-xl p-4 ${borderColour}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-xs font-bold text-slate-600">
          {(review.reviewer_name ?? "?")[0]?.toUpperCase() ?? "?"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-800">{review.reviewer_name ?? "Anonymous"}</span>
            <StarRow n={rn} />
            <span className="text-xs text-slate-400 ml-auto">{fmtDate(review.create_time)}</span>
          </div>

          {review.comment && (
            <p className={`text-sm text-slate-600 ${compact ? "line-clamp-2" : ""}`}>
              {review.comment}
            </p>
          )}

          {!review.comment && (
            <p className="text-sm text-slate-400 italic">No written comment.</p>
          )}

          {/* Reply section */}
          {review.reply_status === "posted" && review.reply_comment && (
            <div className="mt-2 pl-3 border-l-2 border-blue-300">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle className="w-3 h-3 text-blue-500" />
                <span className="text-xs text-blue-600 font-medium">Your Reply</span>
                {review.reply_is_ai && (
                  <span className="flex items-center gap-0.5 text-xs text-violet-500">
                    <Sparkles className="w-3 h-3" /> AI
                  </span>
                )}
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="ml-1 text-xs text-slate-400 hover:text-slate-600"
                >
                  {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              </div>
              {expanded && (
                <p className="text-xs text-slate-600 mt-1">{review.reply_comment}</p>
              )}
            </div>
          )}

          {review.reply_status === "none" && (
            <div className="flex items-center gap-1 mt-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-amber-600 font-medium">No reply yet</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={() => onReply(review)}
              className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors"
            >
              {review.reply_status === "posted" ? (
                <><MessageSquare className="w-3 h-3" /> Edit Reply</>
              ) : (
                <><Sparkles className="w-3 h-3" /> AI Reply</>
              )}
            </button>
            {review.reply_status === "posted" && (
              <button
                onClick={async () => {
                  setDeleting(true);
                  await onDelete(review.id);
                  setDeleting(false);
                }}
                disabled={deleting}
                className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                {deleting ? "Deleting…" : "Delete Reply"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
