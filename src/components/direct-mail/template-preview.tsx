"use client";

import { useState } from "react";
import { buildPreviewQRImageUrl } from "@/lib/qrcode-gen";
import type { MailTemplateType } from "@/types";

// ── Accent color system ───────────────────────────────────────

export type AccentColor = "indigo" | "yellow" | "orange" | "pink" | "green";

const ACCENT: Record<AccentColor, {
  header: string;
  offerBg: string;
  offerBorder: string;
  offerText: string;
  letterBorder: string;
  highlightGlow: string;
  isHighlight: boolean;
}> = {
  indigo: {
    header: "#6366F1",
    offerBg: "#EEF2FF",
    offerBorder: "#6366F1",
    offerText: "#3730A3",
    letterBorder: "2px solid #6366F1",
    highlightGlow: "",
    isHighlight: false,
  },
  yellow: {
    header: "#CA8A04",
    offerBg: "#FEF08A",
    offerBorder: "#CA8A04",
    offerText: "#713F12",
    letterBorder: "2px solid #EAB308",
    highlightGlow: "0 0 0 2px #FEF08A88",
    isHighlight: true,
  },
  orange: {
    header: "#EA580C",
    offerBg: "#FED7AA",
    offerBorder: "#EA580C",
    offerText: "#7C2D12",
    letterBorder: "2px solid #F97316",
    highlightGlow: "0 0 0 2px #FED7AA88",
    isHighlight: true,
  },
  pink: {
    header: "#DB2777",
    offerBg: "#FBCFE8",
    offerBorder: "#DB2777",
    offerText: "#831843",
    letterBorder: "2px solid #EC4899",
    highlightGlow: "0 0 0 2px #FBCFE888",
    isHighlight: true,
  },
  green: {
    header: "#16A34A",
    offerBg: "#BBF7D0",
    offerBorder: "#16A34A",
    offerText: "#14532D",
    letterBorder: "2px solid #22C55E",
    highlightGlow: "",
    isHighlight: false,
  },
};

// ── Handwriting engine ─────────────────────────────────────────
// 19-element arrays (prime) across 6 variation dimensions.
// Multi-factor seed mixes char position + code + line + paragraph.

const ROT   = [-1.6,-1.0,-0.6,-0.3,-0.1, 0.1, 0.3, 0.6, 0.9, 1.2, 1.5,-0.8,-0.4, 0.2, 0.5, 0.8,-0.5, 0.4,-0.9] as const;
const TY    = [-1.4,-0.9,-0.5,-0.2, 0.1, 0.4, 0.7, 1.0, 1.3,-1.1,-0.7,-0.3, 0.1, 0.5, 0.8,-0.6,-0.2, 0.6,-0.4] as const;
const OPQ   = [0.72,0.76,0.80,0.84,0.88,0.91,0.94,0.97,1.00,0.98,0.95,0.91,0.86,0.82,0.78,0.74,0.93,0.87,0.96] as const;
const SX    = [0.95,0.97,0.98,0.99,1.00,1.01,1.02,1.03,0.96,0.98,1.00,1.02,0.97,0.99,1.01,0.96,1.03,0.98,1.01] as const;
const SY    = [0.96,0.98,0.99,1.00,1.01,1.02,0.97,0.99,1.01,0.98,1.00,1.02,0.97,0.99,1.01,0.96,1.00,0.98,1.02] as const;
const SPC   = [-0.4,-0.2,-0.1, 0.0, 0.1, 0.2, 0.3,-0.3, 0.15,-0.15, 0.25,-0.25, 0.05,-0.05, 0.2,-0.1, 0.0, 0.15,-0.2] as const;
// Per-line vertical drift: makes paragraph lines naturally float up/down like a real hand
const LDRIFT = [-0.7,-0.3, 0.1, 0.5,-0.6,-0.1, 0.4,-0.4, 0.2,-0.5, 0.3,-0.2, 0.6,-0.3, 0.0, 0.4,-0.7, 0.1,-0.4] as const;

type LookupArr = readonly number[];
function pick(arr: LookupArr, n: number): number {
  return arr[((n % arr.length) + arr.length) % arr.length];
}
function seed(gci: number, code: number, li: number, pi: number): number {
  return (gci * 31 + code * 17 + li * 7 + pi * 3) | 0;
}

function charVariant(gci: number, code: number, li: number, pi: number) {
  const s = seed(gci, code, li, pi);
  return {
    rot:    pick(ROT, s),
    ty:     pick(TY,  s + 3),
    opacity:pick(OPQ, s + 5),
    sx:     pick(SX,  s + 7),
    sy:     pick(SY,  s + 11),
    spc:    pick(SPC, s + 13),
  };
}

interface LineInfo { text: string; charOffset: number; lineIdx: number; paraIdx: number; }
interface ParaInfo { lines: LineInfo[]; paraIdx: number; }

function buildParaLayout(text: string): ParaInfo[] {
  const paragraphs = text.split(/\n\n+/);
  let gci = 0;
  return paragraphs.map((para, pi) => {
    const lines: LineInfo[] = para.split("\n").map((line, li) => {
      const info: LineInfo = { text: line, charOffset: gci, lineIdx: li, paraIdx: pi };
      gci += line.length + 1;
      return info;
    });
    gci += 2;
    return { lines, paraIdx: pi };
  });
}

function HandwrittenLine({ text, charOffset, lineIdx, paraIdx }: LineInfo) {
  if (!text) return <span>&nbsp;</span>;
  const drift = pick(LDRIFT, lineIdx * 11 + paraIdx * 7);
  return (
    <span style={{ display: "inline-block", transform: `translateY(${drift}px)` }}>
      {text.split("").map((char, i) => {
        const code = char.charCodeAt(0);
        const v = charVariant(charOffset + i, code, lineIdx, paraIdx);
        return (
          <span
            key={charOffset + i}
            style={{
              display: "inline-block",
              transform: `rotate(${v.rot}deg) translateY(${v.ty}px) scaleX(${v.sx}) scaleY(${v.sy})`,
              transformOrigin: "bottom center",
              opacity: v.opacity,
              letterSpacing: char === " " ? "0" : `${v.spc}px`,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </span>
  );
}

function HandwrittenContent({
  text, fontSize = 17, lineHeight = 1.8,
}: {
  text: string; fontSize?: number; lineHeight?: number;
}) {
  const paras = buildParaLayout(text);
  return (
    <div style={{ fontSize: `${fontSize}px`, lineHeight, color: "#1e293b", fontFamily: "'Caveat', cursive" }}>
      {paras.map((para, pi) => (
        <div key={pi} style={{ marginBottom: pi < paras.length - 1 ? `${fontSize * 0.65}px` : 0 }}>
          {para.lines.map((line, li) => (
            <div key={li}>
              {line.text ? <HandwrittenLine {...line} /> : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Offer strip ───────────────────────────────────────────────

function OfferStrip({ offer, accent }: { offer: string; accent: ReturnType<typeof ACCENT[AccentColor]> }) {
  return (
    <div
      style={{
        marginTop: "12px",
        padding: accent.isHighlight ? "8px 12px" : "7px 11px",
        background: accent.isHighlight
          ? `linear-gradient(105deg, ${accent.offerBg} 0%, ${accent.offerBg}cc 50%, ${accent.offerBg} 100%)`
          : accent.offerBg,
        borderLeft: `4px solid ${accent.offerBorder}`,
        borderRadius: accent.isHighlight ? "2px 6px 6px 2px" : "4px",
        fontSize: "11px",
        color: accent.offerText,
        fontFamily: "'Inter', sans-serif",
        fontWeight: accent.isHighlight ? 700 : 500,
        letterSpacing: "0.01em",
        boxShadow: accent.highlightGlow || undefined,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {accent.isHighlight && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg, ${accent.offerBorder}22 0%, transparent 40%, ${accent.offerBorder}11 100%)`,
          pointerEvents: "none",
        }} />
      )}
      <span style={{ position: "relative" }}>{offer}</span>
    </div>
  );
}

// ── Postcard back side ────────────────────────────────────────

function PostcardBack({
  dealershipName, customerName, accent, logoUrl,
}: {
  dealershipName: string;
  customerName?: string;
  accent: ReturnType<typeof ACCENT[AccentColor]>;
  logoUrl?: string | null;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Top strip: indicia + return address */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "14px 16px 10px",
        borderBottom: "1px solid #f1f5f9",
      }}>
        {/* Return address (left) */}
        <div style={{ fontFamily: "'Caveat', cursive", lineHeight: 1.55 }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={dealershipName}
              style={{ height: "16px", width: "auto", maxWidth: "56px", objectFit: "contain", display: "block", marginBottom: "3px" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div style={{ fontSize: "11px", color: "#475569", fontWeight: 600 }}>{dealershipName}</div>
          <div style={{ fontSize: "10px", color: "#94a3b8" }}>Service Department</div>
        </div>

        {/* Postage / indicia (right) */}
        <div style={{
          width: "72px",
          height: "52px",
          border: "1px solid #CBD5E1",
          borderRadius: "4px",
          background: "#F8FAFC",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2px",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: "6px", fontWeight: 700, color: accent.header, letterSpacing: "0.12em", textTransform: "uppercase" }}>FIRST CLASS</div>
          <div style={{ fontSize: "5.5px", color: "#94a3b8", letterSpacing: "0.06em" }}>U.S. POSTAGE</div>
          <div style={{ fontSize: "5.5px", color: "#94a3b8" }}>PAID</div>
          <div style={{ width: "28px", height: "1px", background: "#CBD5E1", margin: "1px 0" }} />
          <div style={{ fontSize: "5px", color: "#94a3b8", letterSpacing: "0.06em" }}>PERMIT NO. 1</div>
        </div>
      </div>

      {/* Vertical divider line (USPS-style message/address divide) */}
      <div style={{
        height: "1px",
        margin: "0 16px",
        background: "repeating-linear-gradient(90deg, #CBD5E1 0, #CBD5E1 6px, transparent 6px, transparent 12px)",
      }} />

      {/* Address area */}
      <div style={{ padding: "12px 16px 16px" }}>
        <div style={{ fontSize: "7.5px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.10em", marginBottom: "8px", textTransform: "uppercase" }}>
          DELIVER TO:
        </div>
        <div style={{ fontFamily: "'Caveat', cursive", lineHeight: 1.65 }}>
          <div style={{ fontSize: "16px", color: "#1e293b", fontWeight: 700 }}>
            {customerName ?? "Customer Name"}
          </div>
          <div style={{ fontSize: "13px", color: "#475569" }}>123 Street Address</div>
          <div style={{ fontSize: "12px", color: "#64748B" }}>City, ST 00000</div>
        </div>

        {/* USPS Intelligent Mail Barcode (decorative) */}
        <div style={{ marginTop: "12px", display: "flex", gap: "1.5px", alignItems: "flex-end", height: "20px" }}>
          {Array.from({ length: 65 }, (_, i) => {
            const h = [8, 14, 20, 14][i % 4];
            return (
              <div key={i} style={{
                width: "2px",
                height: `${h}px`,
                background: "#94a3b8",
                borderRadius: "1px",
              }} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Postcard 6x9 Preview ──────────────────────────────────────

function Postcard6x9Preview({
  content, dealershipName, customerName, offer, qrPreviewUrl, logoUrl, accent,
}: {
  content: string;
  dealershipName: string;
  customerName?: string;
  offer?: string | null;
  qrPreviewUrl: string;
  logoUrl?: string | null;
  accent: ReturnType<typeof ACCENT[AccentColor]>;
}) {
  const [showBack, setShowBack] = useState(false);

  return (
    <div className="space-y-3">
      {/* Front/Back toggle */}
      <div className="flex items-center justify-center gap-1.5">
        <button
          onClick={() => setShowBack(false)}
          className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
            !showBack
              ? "bg-slate-900 text-white border-slate-900"
              : "text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          Front
        </button>
        <button
          onClick={() => setShowBack(true)}
          className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
            showBack
              ? "bg-slate-900 text-white border-slate-900"
              : "text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          Back (Mailing Side)
        </button>
      </div>

      <div className="relative flex justify-center">
        {/* Drop shadow layer */}
        <div
          className="absolute -bottom-1.5 rounded-b-xl blur-sm -z-10"
          style={{ left: "16px", right: "16px", height: "14px", background: "rgba(15, 23, 42, 0.10)" }}
        />

        {!showBack ? (
          /* FRONT */
          <div
            className="rounded-xl border border-slate-200 shadow-xl overflow-hidden"
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#ffffff",
              backgroundImage:
                "repeating-linear-gradient(transparent, transparent 30px, #f1f5f9 30px, #f1f5f9 31px)",
              backgroundPositionY: "52px",
              padding: "16px 20px 80px 20px",
              position: "relative",
            }}
          >
            {/* Dealership header with logo */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderBottom: `1px solid ${accent.header}33`,
              paddingBottom: "8px",
              marginBottom: "14px",
            }}>
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={dealershipName}
                  style={{ height: "22px", width: "auto", maxWidth: "68px", objectFit: "contain", display: "block" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "9px",
                fontWeight: 700,
                color: accent.header,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
              }}>
                {dealershipName}
              </span>
            </div>

            {/* Handwritten message */}
            <HandwrittenContent text={content} fontSize={16} lineHeight={1.85} />

            {/* Offer callout */}
            {offer && <OfferStrip offer={offer} accent={accent} />}

            {/* QR code — bottom right */}
            <div style={{ position: "absolute", bottom: "14px", right: "14px", textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrPreviewUrl}
                alt="Tracking QR"
                width={56}
                height={56}
                style={{ display: "block", borderRadius: "5px", border: "1px solid #E2E8F0" }}
              />
              <div style={{
                fontSize: "7px", color: "#94a3b8", marginTop: "3px",
                fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.04em",
              }}>
                SCAN FOR OFFER
              </div>
            </div>
          </div>
        ) : (
          /* BACK */
          <PostcardBack
            dealershipName={dealershipName}
            customerName={customerName}
            accent={accent}
            logoUrl={logoUrl}
          />
        )}
      </div>

      <div className="text-center">
        <span className="chip chip-slate text-[10px]">
          {showBack ? "↑ Mailing side · Back has address + USPS indicia" : "↑ Front · Shows handwritten message + offer"}
        </span>
      </div>
    </div>
  );
}

// ── Letter Preview ────────────────────────────────────────────

function LetterPreview({
  content, dealershipName, templateType, logoUrl, accent,
}: {
  content: string;
  dealershipName: string;
  templateType: MailTemplateType;
  logoUrl?: string | null;
  accent: ReturnType<typeof ACCENT[AccentColor]>;
}) {
  const aspectRatio = templateType === "letter_8.5x11" ? "8.5/11" : "6/9";
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div
      className="rounded-xl border border-slate-200 shadow-xl bg-white overflow-hidden"
      style={{
        width: "100%",
        maxWidth: templateType === "letter_8.5x11" ? "480px" : "360px",
        aspectRatio,
        padding: templateType === "letter_8.5x11" ? "24px 28px" : "18px 20px",
        position: "relative",
      }}
    >
      {/* Letterhead */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        borderBottom: accent.letterBorder,
        paddingBottom: "8px",
        marginBottom: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={dealershipName}
              style={{ height: "30px", width: "auto", maxWidth: "84px", objectFit: "contain", display: "block" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <span style={{
            fontFamily: "'Inter', sans-serif", fontSize: "15px", fontWeight: 700, color: "#1E2937",
          }}>
            {dealershipName}
          </span>
        </div>
        <div style={{
          fontFamily: "'Inter', sans-serif", fontSize: "8px", color: "#94A3B8",
          textAlign: "right", fontWeight: 500,
        }}>
          {today}
        </div>
      </div>

      {/* Body */}
      <HandwrittenContent
        text={content}
        fontSize={templateType === "letter_8.5x11" ? 14 : 13}
        lineHeight={1.85}
      />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────

interface TemplatePreviewProps {
  templateType: MailTemplateType;
  content: string;
  dealershipName: string;
  customerName?: string;
  vehicle?: string | null;
  offer?: string | null;
  qrPreviewUrl?: string;
  logoUrl?: string | null;
  accentColor?: AccentColor;
}

export function TemplatePreview({
  templateType,
  content,
  dealershipName,
  customerName,
  offer,
  qrPreviewUrl: qrPropUrl,
  logoUrl,
  accentColor = "indigo",
}: TemplatePreviewProps) {
  const qrUrl = qrPropUrl ?? buildPreviewQRImageUrl(
    `${typeof window !== "undefined" ? window.location.origin : ""}/track/preview`,
    80
  );
  const accent = ACCENT[accentColor];

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-[var(--radius)]">
        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-card">
          <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-[13px] font-semibold text-slate-600">Generate copy to preview your mail piece</p>
        <p className="text-xs text-slate-400 mt-0.5">AI-personalized content appears here</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      {templateType === "postcard_6x9" ? (
        <div className="w-full" style={{ maxWidth: "420px" }}>
          <Postcard6x9Preview
            content={content}
            dealershipName={dealershipName}
            customerName={customerName}
            offer={offer}
            qrPreviewUrl={qrUrl}
            logoUrl={logoUrl}
            accent={accent}
          />
        </div>
      ) : (
        <LetterPreview
          content={content}
          dealershipName={dealershipName}
          templateType={templateType}
          logoUrl={logoUrl}
          accent={accent}
        />
      )}
    </div>
  );
}
