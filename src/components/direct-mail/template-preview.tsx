"use client";

import { useState } from "react";
import { buildPreviewQRImageUrl } from "@/lib/qrcode-gen";
import type { MailTemplateType, DesignStyle, LayoutSpec } from "@/types";

// ── Accent color system ───────────────────────────────────────

export type AccentColor = "indigo" | "yellow" | "orange" | "pink" | "green";

export interface AccentConfig {
  header: string;
  offerBg: string;
  offerBorder: string;
  offerText: string;
  letterBorder: string;
  highlightGlow: string;
  isHighlight: boolean;
}

const ACCENT: Record<AccentColor, AccentConfig> = {
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

// ── Address types ─────────────────────────────────────────────

interface AddressRecord {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

type PreviewMode = "design" | "realistic";

function addrToLines(a: AddressRecord | null | undefined): { line1: string; line2: string } {
  if (!a) return { line1: "", line2: "" };
  const line1 = a.street ?? "";
  const parts: string[] = [];
  if (a.city) parts.push(a.city);
  const stateZip = [a.state, a.zip].filter(Boolean).join(" ");
  if (stateZip) parts.push(stateZip);
  const line2 = parts.join(", ");
  return { line1, line2 };
}

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
    <div style={{ fontSize: `${fontSize}px`, lineHeight, color: "#1a1f36", fontFamily: "'Caveat', cursive", textShadow: "0 0.5px 0 rgba(26,31,54,0.12)" }}>
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

function OfferStrip({ offer, accent }: { offer: string; accent: AccentConfig }) {
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

// ── USPS Indicia ──────────────────────────────────────────────

function USPSIndicia({ city, state, accentColor }: { city?: string | null; state?: string | null; accentColor: string }) {
  const location = [city, state].filter(Boolean).join(", ").toUpperCase() || "ANYTOWN, USA";
  return (
    <div style={{
      width: "92px",
      height: "76px",
      border: "1.5px solid #CBD5E1",
      borderRadius: "4px",
      background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "2px",
      flexShrink: 0,
      padding: "6px 5px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Wavy USPS cancellation marks */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12, pointerEvents: "none" }} viewBox="0 0 92 76" preserveAspectRatio="none">
        {[14, 26, 38, 50, 62].map((y) => (
          <path key={y} d={`M-5,${y} C8,${y - 4} 20,${y + 4} 32,${y} S56,${y - 4} 68,${y} S80,${y + 4} 100,${y}`} stroke="#334155" strokeWidth="1.6" fill="none" />
        ))}
      </svg>
      <div style={{ fontSize: "5.5px", fontWeight: 800, color: accentColor, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif", position: "relative" }}>PRESORTED</div>
      <div style={{ fontSize: "5.5px", fontWeight: 800, color: accentColor, letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif", position: "relative" }}>FIRST-CLASS MAIL</div>
      <div style={{ width: "72px", height: "1px", background: "#E2E8F0", margin: "2px 0" }} />
      <div style={{ fontSize: "5px", color: "#475569", fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em", fontWeight: 600, position: "relative" }}>U.S. POSTAGE PAID</div>
      <div style={{ fontSize: "4.5px", color: "#94A3B8", fontFamily: "'Inter', sans-serif", letterSpacing: "0.04em", position: "relative" }}>PERMIT NO. 1234</div>
      <div style={{ width: "72px", height: "1px", background: "#E2E8F0", margin: "1px 0" }} />
      <div style={{ fontSize: "4.5px", color: "#94A3B8", fontFamily: "'Inter', sans-serif", letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.3, position: "relative" }}>{location}</div>
    </div>
  );
}

// ── IMB Barcode ───────────────────────────────────────────────

const IMB_PATTERN = [0,3,1,2,0,3,2,1,3,0,1,2,3,0,2,1,3,2,0,1,2,3,1,0,3,2,1,0,3,1,2,0,3,2,1,3,0,2,1,3,0,2,1,3,2,0,1,3,2,0,1,3,2,1,0,3,1,2,3,0,1,2,3,0,2];

function IMBBarcode() {
  return (
    <div style={{ display: "flex", gap: "1.5px", alignItems: "center", height: "22px" }}>
      {IMB_PATTERN.map((type, i) => {
        let height: number;
        let alignSelf: string;
        if (type === 0) { height = 18; alignSelf = "center"; }
        else if (type === 1) { height = 13; alignSelf = "flex-start"; }
        else if (type === 2) { height = 9; alignSelf = "flex-end"; }
        else { height = 14; alignSelf = "center"; }
        return (
          <div key={i} style={{
            width: "1.8px",
            height: `${height}px`,
            background: "#475569",
            borderRadius: "0.5px",
            alignSelf,
            flexShrink: 0,
          }} />
        );
      })}
    </div>
  );
}

// ── Mode Toggle ───────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: PreviewMode; onChange: (m: PreviewMode) => void }) {
  return (
    <div style={{
      display: "inline-flex",
      background: "#F0EBE3",
      borderRadius: "8px",
      padding: "2px",
      gap: "1px",
    }}>
      <button
        onClick={() => onChange("design")}
        style={{
          padding: "6px 14px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
          fontFamily: "'Inter', sans-serif",
          fontSize: "11px",
          fontWeight: 600,
          background: mode === "design" ? "white" : "transparent",
          color: mode === "design" ? "#1e293b" : "#6B7280",
          boxShadow: mode === "design" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
          transition: "all 0.15s ease",
        }}
      >
        ✎ Handwriting
      </button>
      <button
        onClick={() => onChange("realistic")}
        style={{
          padding: "6px 14px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
          fontFamily: "'Inter', sans-serif",
          fontSize: "11px",
          fontWeight: 600,
          background: mode === "realistic" ? "white" : "transparent",
          color: mode === "realistic" ? "#1e293b" : "#6B7280",
          boxShadow: mode === "realistic" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
          transition: "all 0.15s ease",
        }}
      >
        ✦ Final Preview
      </button>
    </div>
  );
}

// ── Realistic Postcard Front ──────────────────────────────────

function RealPostcardFront({
  content, dealershipName, offer, qrPreviewUrl, logoUrl, accent, dealershipAddress, dealershipPhone,
}: {
  content: string;
  dealershipName: string;
  offer?: string | null;
  qrPreviewUrl: string;
  logoUrl?: string | null;
  accent: AccentConfig;
  dealershipAddress?: AddressRecord | null;
  dealershipPhone?: string | null;
}) {
  const addrLines = addrToLines(dealershipAddress);

  return (
    <div style={{
      maxWidth: "520px",
      minHeight: "310px",
      position: "relative",
      background: "#FEFCF3",
      backgroundImage: [
        "repeating-linear-gradient(89.4deg, transparent, transparent 4px, rgba(155,135,100,0.022) 4px, rgba(155,135,100,0.022) 5px)",
        "repeating-linear-gradient(90.6deg, transparent, transparent 7px, rgba(155,135,100,0.013) 7px, rgba(155,135,100,0.013) 8px)",
        "repeating-linear-gradient(transparent, transparent 29px, rgba(218,209,189,0.5) 29px, rgba(218,209,189,0.5) 30px)",
      ].join(", "),
      backgroundPositionY: "0, 0, 46px",
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: "0 2px 4px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.05)",
      width: "100%",
    }}>
      {/* Header strip */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 14px 7px",
        borderBottom: `2px solid ${accent.header}`,
        background: "rgba(254,252,243,0.96)",
      }}>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={dealershipName}
            style={{ height: "18px", width: "auto", maxWidth: "64px", objectFit: "contain", display: "block" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "8px",
          fontWeight: 700,
          color: accent.header,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          {dealershipName}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: "6px",
          color: "#94A3B8",
          fontFamily: "'Inter', sans-serif",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          PERSONALIZED DIRECT MAIL
        </span>
      </div>

      {/* Content area */}
      <div style={{
        padding: "11px 14px 88px 14px",
        position: "relative",
      }}>
        <HandwrittenContent text={content} fontSize={15} lineHeight={1.85} />
        {offer && <OfferStrip offer={offer} accent={accent} />}

        {/* QR code — absolute positioned above footer */}
        <div style={{
          position: "absolute",
          bottom: "38px",
          right: "12px",
          textAlign: "center",
          background: "rgba(255,255,255,0.94)",
          padding: "5px 5px 4px",
          borderRadius: "7px",
          border: "1px solid rgba(0,0,0,0.09)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrPreviewUrl}
            alt="Tracking QR"
            width={66}
            height={66}
            style={{
              display: "block",
              borderRadius: "4px",
              border: "1px solid #E5DFC8",
            }}
          />
          <div style={{
            fontSize: "6px",
            color: "#8A8070",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            letterSpacing: "0.08em",
            marginTop: "3px",
            textAlign: "center",
            textTransform: "uppercase",
          }}>
            SCAN FOR OFFER
          </div>
        </div>
      </div>

      {/* Footer strip */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "5px 14px",
        borderTop: "1px solid #EDE8D8",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(254,252,243,0.97)",
      }}>
        {dealershipPhone ? (
          <span style={{ fontFamily: "'Caveat', cursive", fontSize: "12px", color: "#64748B" }}>{dealershipPhone}</span>
        ) : <span />}
        {addrLines.line1 ? (
          <span style={{ fontSize: "7px", fontFamily: "'Inter', sans-serif", color: "#9CA3AF" }}>
            {addrLines.line1}{addrLines.line2 ? ` · ${addrLines.line2}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Realistic Postcard Back ───────────────────────────────────

function RealPostcardBack({
  dealershipName, customerName, logoUrl, accent, dealershipAddress, dealershipPhone, customerAddress,
}: {
  dealershipName: string;
  customerName?: string;
  logoUrl?: string | null;
  accent: AccentConfig;
  dealershipAddress?: AddressRecord | null;
  dealershipPhone?: string | null;
  customerAddress?: AddressRecord | null;
}) {
  const dAddrLines = addrToLines(dealershipAddress);
  const cAddrLines = addrToLines(customerAddress);

  return (
    <div style={{
      maxWidth: "520px",
      minHeight: "310px",
      background: "#FEFCF3",
      backgroundImage: [
        "repeating-linear-gradient(89.4deg, transparent, transparent 4px, rgba(155,135,100,0.022) 4px, rgba(155,135,100,0.022) 5px)",
        "repeating-linear-gradient(90.6deg, transparent, transparent 7px, rgba(155,135,100,0.013) 7px, rgba(155,135,100,0.013) 8px)",
      ].join(", "),
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: "0 2px 4px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.05)",
      display: "flex",
      flexDirection: "column",
      width: "100%",
    }}>
      {/* Top zone: return address (left) + postage indicia (right) */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "12px 14px 10px",
        borderBottom: "1px solid rgba(218,209,189,0.5)",
      }}>
        {/* Return address */}
        <div style={{ fontFamily: "'Inter', sans-serif", lineHeight: 1.55 }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={dealershipName}
              style={{ height: "14px", width: "auto", maxWidth: "52px", objectFit: "contain", display: "block", marginBottom: "3px" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div style={{ fontSize: "8.5px", fontWeight: 800, color: "#1F2937" }}>{dealershipName}</div>
          {dAddrLines.line1 && <div style={{ fontSize: "7.5px", color: "#6B7280" }}>{dAddrLines.line1}</div>}
          {dAddrLines.line2 && <div style={{ fontSize: "7.5px", color: "#6B7280" }}>{dAddrLines.line2}</div>}
          {dealershipPhone && <div style={{ fontSize: "7.5px", color: "#6B7280", marginTop: "1px" }}>{dealershipPhone}</div>}
        </div>

        {/* Postage indicia */}
        <USPSIndicia city={dealershipAddress?.city} state={dealershipAddress?.state} accentColor={accent.header} />
      </div>

      {/* USPS mandate: left/right zone divider */}
      <div style={{ flex: 1, display: "flex", position: "relative", minHeight: "150px" }}>
        {/* Vertical USPS divider line */}
        <div style={{
          position: "absolute",
          top: "10px",
          bottom: "10px",
          left: "46%",
          width: "1px",
          background: "repeating-linear-gradient(180deg, #9CA3AF 0, #9CA3AF 5px, transparent 5px, transparent 10px)",
        }} />

        {/* Left: indeterminate message zone (ruled lines, blank) */}
        <div style={{
          width: "44%",
          padding: "10px 10px 8px 14px",
          backgroundImage: "repeating-linear-gradient(transparent, transparent 20px, rgba(218,209,189,0.35) 20px, rgba(218,209,189,0.35) 21px)",
          backgroundPositionY: "30px",
        }}>
          <div style={{ fontSize: "5.5px", color: "#C4B69A", fontFamily: "'Inter', sans-serif", letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 700 }}>
            MESSAGE AREA
          </div>
        </div>

        {/* Right: delivery address zone */}
        <div style={{ flex: 1, padding: "10px 14px 8px 18px" }}>
          <div style={{
            fontSize: "6.5px",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            color: "#9CA3AF",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: "6px",
          }}>
            DELIVER TO
          </div>
          {/* Address outlined box */}
          <div style={{
            border: "1px solid rgba(0,0,0,0.09)",
            borderRadius: "3px",
            padding: "7px 10px 8px",
            background: "rgba(255,255,255,0.55)",
          }}>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: "17px", color: "#1F2937", fontWeight: 700, lineHeight: 1.3 }}>
              {customerName ?? "Customer Name"}
            </div>
            {cAddrLines.line1 ? (
              <>
                <div style={{ fontFamily: "'Caveat', cursive", fontSize: "13px", color: "#4B5563", marginTop: "1px" }}>{cAddrLines.line1}</div>
                <div style={{ fontFamily: "'Caveat', cursive", fontSize: "12px", color: "#6B7280" }}>{cAddrLines.line2}</div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "'Caveat', cursive", fontSize: "13px", color: "#C4B69A", marginTop: "1px" }}>123 Delivery Address</div>
                <div style={{ fontFamily: "'Caveat', cursive", fontSize: "12px", color: "#C4B69A" }}>City, ST 00000</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* IMB Barcode zone */}
      <div style={{
        padding: "5px 14px 10px",
        borderTop: "1px solid rgba(218,209,189,0.5)",
      }}>
        <div style={{ fontSize: "5px", color: "#C4B69A", fontFamily: "'Inter', sans-serif", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: "3px", fontWeight: 700 }}>
          INTELLIGENT MAIL BARCODE
        </div>
        <IMBBarcode />
      </div>
    </div>
  );
}

// ── Realistic Letter Preview ──────────────────────────────────

function RealLetterPreview({
  content, dealershipName, templateType, logoUrl, accent, customerName, customerAddress, dealershipAddress, dealershipPhone,
}: {
  content: string;
  dealershipName: string;
  templateType: MailTemplateType;
  logoUrl?: string | null;
  accent: AccentConfig;
  customerName?: string;
  customerAddress?: AddressRecord | null;
  dealershipAddress?: AddressRecord | null;
  dealershipPhone?: string | null;
}) {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const is8511 = templateType === "letter_8.5x11";
  const logoHeight = is8511 ? 28 : 20;
  const cAddrLines = addrToLines(customerAddress);
  const dAddrLines = addrToLines(dealershipAddress);

  return (
    <div style={{
      maxWidth: is8511 ? "440px" : "340px",
      background: "#FFFFFF",
      backgroundImage: [
        "repeating-linear-gradient(89.4deg, transparent, transparent 4px, rgba(155,135,100,0.012) 4px, rgba(155,135,100,0.012) 5px)",
        "repeating-linear-gradient(90.6deg, transparent, transparent 7px, rgba(155,135,100,0.008) 7px, rgba(155,135,100,0.008) 8px)",
      ].join(", "),
      borderRadius: "4px",
      overflow: "hidden",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.14)",
      width: "100%",
    }}>
      {/* Letterhead */}
      <div style={{
        padding: "18px 22px 0px",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: accent.letterBorder,
          paddingBottom: "12px",
          marginBottom: "0",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={dealershipName}
                  style={{ height: `${logoHeight}px`, width: "auto", maxWidth: "84px", objectFit: "contain", display: "block" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 700, color: "#1E2937" }}>
                {dealershipName}
              </span>
            </div>
            {dAddrLines.line1 && <div style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", color: "#6B7280" }}>{dAddrLines.line1}</div>}
            {dAddrLines.line2 && <div style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", color: "#6B7280" }}>{dAddrLines.line2}</div>}
            {dealershipPhone && <div style={{ fontSize: "8px", fontFamily: "'Inter', sans-serif", color: "#6B7280" }}>{dealershipPhone}</div>}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", color: "#94A3B8", textAlign: "right", fontWeight: 500 }}>
            {today}
          </div>
        </div>
      </div>

      {/* Recipient block */}
      {cAddrLines.line1 && (
        <div style={{ padding: "10px 22px 0px" }}>
          <div style={{ fontSize: "13px", fontFamily: "'Inter', sans-serif", fontWeight: 700, color: "#374151" }}>{customerName}</div>
          <div style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", color: "#6B7280" }}>{cAddrLines.line1}</div>
          {cAddrLines.line2 && <div style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", color: "#6B7280" }}>{cAddrLines.line2}</div>}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: "12px 22px 0" }}>
        <HandwrittenContent
          text={content}
          fontSize={is8511 ? 14 : 13}
          lineHeight={1.85}
        />
      </div>

      {/* Signature area */}
      <div style={{ padding: "10px 22px 18px" }}>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: is8511 ? 17 : 15, color: "#374151", lineHeight: 1.2 }}>
          Sincerely,
        </div>
        <div style={{
          fontFamily: "'Caveat', cursive",
          fontSize: is8511 ? 22 : 19,
          color: "#1F2937",
          fontWeight: 700,
          marginTop: "8px",
          letterSpacing: "0.01em",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          paddingBottom: "4px",
          display: "inline-block",
          minWidth: "100px",
        }}>
          {dealershipName.split(" ")[0]}
        </div>
        <div style={{ fontSize: "7.5px", fontFamily: "'Inter', sans-serif", color: "#9CA3AF", marginTop: "3px" }}>
          {dealershipName} — Service Department
        </div>
      </div>
    </div>
  );
}

// ── Postcard back side (design mode) ─────────────────────────

function PostcardBack({
  dealershipName, customerName, accent, logoUrl,
}: {
  dealershipName: string;
  customerName?: string;
  accent: AccentConfig;
  logoUrl?: string | null;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        background: "#FEFCF3",
        border: "1px solid #D1C9B0",
        borderRadius: "12px",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 10px 24px -4px rgba(0,0,0,0.10)",
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
  customerAddress, dealershipAddress, dealershipPhone,
}: {
  content: string;
  dealershipName: string;
  customerName?: string;
  offer?: string | null;
  qrPreviewUrl: string;
  logoUrl?: string | null;
  accent: AccentConfig;
  customerAddress?: AddressRecord | null;
  dealershipAddress?: AddressRecord | null;
  dealershipPhone?: string | null;
}) {
  const [showBack, setShowBack] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("design");

  return (
    <div className="space-y-2.5">
      {/* Mode toggle */}
      <div className="flex justify-center">
        <ModeToggle mode={previewMode} onChange={setPreviewMode} />
      </div>

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

      {previewMode === "design" ? (
        <div className="relative flex justify-center">
          {/* Drop shadow layer */}
          <div
            className="absolute -bottom-1.5 rounded-b-xl blur-sm -z-10"
            style={{ left: "16px", right: "16px", height: "14px", background: "rgba(15, 23, 42, 0.10)" }}
          />

          {!showBack ? (
            /* FRONT — design mode */
            <div
              className="rounded-xl border border-slate-200 overflow-hidden"
              style={{
                width: "100%",
                maxWidth: "420px",
                background: "#FEFCF3",
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 30px, #EDE8D8 30px, #EDE8D8 31px)",
                backgroundPositionY: "52px",
                padding: "16px 20px 88px 20px",
                position: "relative",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 10px 24px -4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)",
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
                  width={72}
                  height={72}
                  style={{ display: "block", borderRadius: "6px", border: "1px solid #D1C9B0", boxShadow: "0 1px 3px rgba(0,0,0,0.10)" }}
                />
                <div style={{
                  fontSize: "7px", color: "#8A8070", marginTop: "4px",
                  fontFamily: "'Inter', sans-serif", fontWeight: 700, letterSpacing: "0.06em",
                }}>
                  SCAN FOR OFFER
                </div>
              </div>
            </div>
          ) : (
            /* BACK — design mode */
            <PostcardBack
              dealershipName={dealershipName}
              customerName={customerName}
              accent={accent}
              logoUrl={logoUrl}
            />
          )}
        </div>
      ) : (
        /* Realistic mode */
        <div style={{
          background: "linear-gradient(145deg, #EAE5DE 0%, #E0D9D0 100%)",
          padding: "24px 20px 28px",
          borderRadius: 14,
        }}>
          <div className="text-center mb-3">
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#8B7265", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>
              ✉ Realistic preview · Matches PostGrid output
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 520, transform: "rotate(-0.4deg)", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18))" }}>
              {!showBack ? (
                <RealPostcardFront
                  content={content}
                  dealershipName={dealershipName}
                  offer={offer}
                  qrPreviewUrl={qrPreviewUrl}
                  logoUrl={logoUrl}
                  accent={accent}
                  dealershipAddress={dealershipAddress}
                  dealershipPhone={dealershipPhone}
                />
              ) : (
                <RealPostcardBack
                  dealershipName={dealershipName}
                  customerName={customerName}
                  logoUrl={logoUrl}
                  accent={accent}
                  dealershipAddress={dealershipAddress}
                  dealershipPhone={dealershipPhone}
                  customerAddress={customerAddress}
                />
              )}
            </div>
          </div>
          {/* Recipient label below the card */}
          {customerName && (
            <p className="text-center mt-3" style={{ fontSize: 9, color: "#9B8E83", fontFamily: "'Inter', sans-serif" }}>
              Will be mailed to: <strong style={{ color: "#6B5E54" }}>{customerName}</strong>
              {customerAddress?.street ? ` · ${customerAddress.street}, ${[customerAddress.city, customerAddress.state].filter(Boolean).join(", ")}` : ""}
            </p>
          )}
        </div>
      )}

      <div className="text-center">
        <span className="chip chip-slate text-[10px]">
          {previewMode === "realistic"
            ? (showBack ? "✦ Mailing side · USPS First Class · PostGrid prints this exact layout" : "✦ Front · Handwritten by Claude · Printed by PostGrid")
            : (showBack ? "↑ Mailing side · Back has address + USPS indicia" : "↑ Front · Shows handwritten message + offer")}
        </span>
      </div>
    </div>
  );
}

// ── Letter Preview ────────────────────────────────────────────

function LetterPreview({
  content, dealershipName, templateType, logoUrl, accent,
  customerName, customerAddress, dealershipAddress, dealershipPhone,
}: {
  content: string;
  dealershipName: string;
  templateType: MailTemplateType;
  logoUrl?: string | null;
  accent: AccentConfig;
  customerName?: string;
  customerAddress?: AddressRecord | null;
  dealershipAddress?: AddressRecord | null;
  dealershipPhone?: string | null;
}) {
  const aspectRatio = templateType === "letter_8.5x11" ? "8.5/11" : "6/9";
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const [previewMode, setPreviewMode] = useState<PreviewMode>("design");

  return (
    <div className="space-y-2.5">
      {/* Mode toggle */}
      <div className="flex justify-center">
        <ModeToggle mode={previewMode} onChange={setPreviewMode} />
      </div>

      {previewMode === "design" ? (
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
      ) : (
        <div style={{ background: "linear-gradient(145deg, #EAE5DE 0%, #E0D9D0 100%)", padding: "24px 20px 28px", borderRadius: 14 }}>
          <div className="text-center mb-3">
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#8B7265", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>
              ✉ Realistic preview · Matches PostGrid output
            </span>
          </div>
          <div className="flex justify-center">
            <div style={{ transform: "rotate(-0.3deg)", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18))" }}>
              <RealLetterPreview
                content={content}
                dealershipName={dealershipName}
                templateType={templateType}
                logoUrl={logoUrl}
                accent={accent}
                customerName={customerName}
                customerAddress={customerAddress}
                dealershipAddress={dealershipAddress}
                dealershipPhone={dealershipPhone}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Multi-Panel Preview ───────────────────────────────────────

function MultiPanelPreview({
  content, dealershipName, customerName, offer, qrPreviewUrl, logoUrl, layoutSpec, accent,
}: {
  content: string; dealershipName: string; customerName?: string; offer?: string | null;
  qrPreviewUrl: string; logoUrl?: string | null; layoutSpec?: LayoutSpec; accent: AccentConfig;
}) {
  const [showBack, setShowBack] = useState(false);
  const front = layoutSpec?.panels?.find((p) => p.role === "front") ?? layoutSpec?.panels?.[0];
  const cs = layoutSpec?.colorScheme;
  const imgZone = front?.imageZone;
  const heroBg = cs?.primary ?? accent.header;
  const accentHex = cs?.accent ?? accent.offerBorder;
  const headline = front?.headline ?? dealershipName;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-1.5">
        {["Front", "Back (Mailing Side)"].map((label, i) => (
          <button key={label} onClick={() => setShowBack(i === 1)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
              showBack === (i === 1) ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:border-slate-300"
            }`}>{label}</button>
        ))}
      </div>
      <div className="flex justify-center">
        {!showBack ? (
          <div className="w-full rounded-xl border border-slate-200 shadow-xl overflow-hidden" style={{ maxWidth: "420px", background: "#fff" }}>
            {/* Hero image strip */}
            <div style={{
              height: "160px", background: `${heroBg}22`,
              backgroundImage: imgZone?.imageUrl ? `url('${imgZone.imageUrl}')` : undefined,
              backgroundSize: "cover", backgroundPosition: "center",
              display: "flex", alignItems: "flex-end", position: "relative",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                background: `linear-gradient(to bottom, transparent 40%, ${heroBg}aa 100%)`,
              }} />
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={dealershipName}
                  style={{ position: "absolute", top: 10, left: 14, height: "20px", width: "auto", maxWidth: "70px", objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div style={{ position: "relative", zIndex: 1, padding: "0 16px 12px", color: "#fff", fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: "16px", lineHeight: 1.2 }}>
                {headline}
              </div>
            </div>
            {/* Message zone */}
            <div style={{ padding: "14px 18px 16px" }}>
              <HandwrittenContent text={content} fontSize={15} lineHeight={1.8} />
              {offer && (
                <div style={{
                  marginTop: "10px", padding: "7px 11px",
                  background: `${accentHex}18`, borderLeft: `3px solid ${accentHex}`,
                  borderRadius: "2px 5px 5px 2px", fontSize: "11px", fontWeight: 700,
                  fontFamily: "'Inter', sans-serif", color: heroBg,
                }}>{offer}</div>
              )}
              <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  background: accentHex, color: "#fff", fontFamily: "'Inter', sans-serif",
                  fontWeight: 800, fontSize: "10px", padding: "6px 14px", borderRadius: "3px",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}>{front?.cta ?? "Schedule Now"}</div>
                <div style={{ textAlign: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrPreviewUrl} alt="QR" width={48} height={48} style={{ borderRadius: "4px", border: "1px solid #e2e8f0" }} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <PostcardBack dealershipName={dealershipName} customerName={customerName} accent={accent} logoUrl={logoUrl} />
        )}
      </div>
      <div className="text-center">
        <span className="chip chip-slate text-[10px]">Multi-Panel · Hero image + personalized message</span>
      </div>
    </div>
  );
}

// ── Premium Fluorescent Preview ───────────────────────────────

function PremiumFluorescentPreview({
  content, dealershipName, customerName, offer, qrPreviewUrl, logoUrl, layoutSpec,
}: {
  content: string; dealershipName: string; customerName?: string; offer?: string | null;
  qrPreviewUrl: string; logoUrl?: string | null; layoutSpec?: LayoutSpec;
}) {
  const [showBack, setShowBack] = useState(false);
  const front = layoutSpec?.panels?.find((p) => p.role === "front") ?? layoutSpec?.panels?.[0];
  const cs = layoutSpec?.colorScheme;
  const bg = cs?.background ?? "#0F172A";
  const accent = cs?.accent ?? "#FFE500";
  const textCol = cs?.text ?? "#F1F5F9";
  const isNeon = cs?.accentIsNeon !== false;
  const headline = front?.headline ?? "We've saved a spot for you.";
  const subheadline = front?.subheadline;

  // Fake accent config for the back
  const backAccent: AccentConfig = {
    header: accent, offerBg: `${accent}22`, offerBorder: accent,
    offerText: bg, letterBorder: `2px solid ${accent}`, highlightGlow: "", isHighlight: true,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-1.5">
        {["Front", "Back (Mailing Side)"].map((label, i) => (
          <button key={label} onClick={() => setShowBack(i === 1)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
              showBack === (i === 1) ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:border-slate-300"
            }`}>{label}</button>
        ))}
      </div>
      <div className="flex justify-center">
        {!showBack ? (
          <div className="w-full rounded-xl shadow-xl overflow-hidden" style={{ maxWidth: "420px", background: bg, position: "relative" }}>
            {/* Top accent bar */}
            <div style={{ height: "5px", background: accent }} />
            <div style={{ padding: "16px 20px 20px" }}>
              {/* Dealership name */}
              <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: "14px", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: "8px" }}>
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={dealershipName}
                    style={{ height: "14px", width: "auto", maxWidth: "50px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                {dealershipName}
              </div>
              {/* Headline */}
              <div style={{ fontSize: "22px", fontWeight: 900, color: textCol, lineHeight: 1.1, marginBottom: subheadline ? "5px" : "14px", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.01em" }}>
                {headline}
              </div>
              {subheadline && (
                <div style={{ fontSize: "12px", color: `${textCol}99`, marginBottom: "14px", fontFamily: "'Inter', sans-serif", lineHeight: 1.4 }}>{subheadline}</div>
              )}
              {/* Accent divider */}
              <div style={{ width: "28px", height: "3px", background: accent, borderRadius: "2px", marginBottom: "14px" }} />
              {/* Message */}
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: "15px", lineHeight: 1.75, color: `${textCol}dd`, marginBottom: "14px" }}>
                <HandwrittenContent text={content} fontSize={15} lineHeight={1.75} />
              </div>
              {/* Offer badge */}
              {offer && (
                <div style={{
                  display: "inline-block", background: accent, color: isNeon ? "#000" : "#fff",
                  fontFamily: "'Inter', sans-serif", fontSize: "10px", fontWeight: 800,
                  padding: "5px 12px", borderRadius: "3px", letterSpacing: "0.04em",
                  textTransform: "uppercase", marginBottom: "14px",
                }}>{offer}</div>
              )}
              {/* CTA row */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  background: accent, color: isNeon ? "#000" : "#fff",
                  fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "10px",
                  padding: "8px 16px", borderRadius: "3px", letterSpacing: "0.04em", textTransform: "uppercase",
                }}>{front?.cta ?? "Book Your Appointment"}</div>
                <div style={{ textAlign: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrPreviewUrl} alt="QR" width={48} height={48}
                    style={{ borderRadius: "4px", border: `1.5px solid ${accent}44` }} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <PostcardBack dealershipName={dealershipName} customerName={customerName} accent={backAccent} logoUrl={logoUrl} />
        )}
      </div>
      <div className="text-center">
        <span className="chip chip-slate text-[10px]">
          Premium Fluorescent · {isNeon ? "Neon ink accents" : "Bold graphic design"} · {accent}
        </span>
      </div>
    </div>
  );
}

// ── Complex Fold Preview ──────────────────────────────────────

function ComplexFoldPreview({
  dealershipName, customerName, offer, qrPreviewUrl, logoUrl, layoutSpec,
}: {
  dealershipName: string; customerName?: string; offer?: string | null;
  qrPreviewUrl: string; logoUrl?: string | null; layoutSpec?: LayoutSpec;
}) {
  const [activePanel, setActivePanel] = useState<"cover" | "inner-left" | "inner-right">("cover");
  const cover = layoutSpec?.panels?.find((p) => p.role === "cover") ?? layoutSpec?.panels?.[0];
  const innerLeft = layoutSpec?.panels?.find((p) => p.role === "inner-left") ?? layoutSpec?.panels?.[1];
  const innerRight = layoutSpec?.panels?.find((p) => p.role === "inner-right") ?? layoutSpec?.panels?.[2];
  const cs = layoutSpec?.colorScheme;
  const bg = cs?.background ?? "#0F172A";
  const accent = cs?.accent ?? "#2563EB";
  const isNeon = cs?.accentIsNeon ?? false;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-1">
        {([["cover", "Cover"], ["inner-left", "Inner (Story)"], ["inner-right", "Inner (Offer)"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActivePanel(id)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all border ${
              activePanel === id ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:border-slate-300"
            }`}>{label}</button>
        ))}
      </div>
      <div className="flex justify-center">
        <div className="w-full rounded-xl border border-slate-200 shadow-xl overflow-hidden" style={{ maxWidth: "420px", minHeight: "300px" }}>
          {activePanel === "cover" && (
            <div style={{ background: bg, padding: "24px 22px", minHeight: "300px", position: "relative" }}>
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={dealershipName}
                  style={{ height: "16px", width: "auto", maxWidth: "60px", objectFit: "contain", filter: "brightness(0) invert(1)", marginBottom: "16px" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: "12px", fontFamily: "'Inter', sans-serif" }}>{dealershipName}</div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: "8px", fontFamily: "'Inter', sans-serif" }}>
                {cover?.headline ?? "We'd love to see you again."}
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", fontFamily: "'Inter', sans-serif" }}>
                {cover?.subheadline ?? "A personal note from your service team."}
              </div>
              <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "10px", background: accent }} />
            </div>
          )}
          {activePanel === "inner-left" && (
            <div style={{ background: "#FAFAFA", padding: "20px 22px", minHeight: "300px" }}>
              <div style={{ fontSize: "9px", color: "#94a3b8", marginBottom: "6px", fontFamily: "'Inter', sans-serif" }}>
                {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", marginBottom: "12px", fontFamily: "'Inter', sans-serif" }}>
                Dear {customerName ?? "Valued Customer"},
              </div>
              <HandwrittenContent text={innerLeft?.body ?? "We appreciate your loyalty and wanted to reach out personally..."} fontSize={15} lineHeight={1.8} />
            </div>
          )}
          {activePanel === "inner-right" && (
            <div style={{ background: "#fff", padding: "20px 22px", minHeight: "300px" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b", marginBottom: "10px", fontFamily: "'Inter', sans-serif" }}>
                {innerRight?.headline ?? "Ready when you are."}
              </div>
              {offer && (
                <div style={{
                  background: `${accent}15`, border: `2px solid ${accent}`, borderRadius: "4px",
                  padding: "9px 12px", marginBottom: "12px", fontSize: "11px", fontWeight: 700, color: accent, fontFamily: "'Inter', sans-serif",
                }}>{offer}</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrPreviewUrl} alt="QR" width={72} height={72} style={{ borderRadius: "4px", border: "1.5px solid #e2e8f0" }} />
                  <div style={{ fontSize: "7px", color: "#94a3b8", marginTop: "3px", textAlign: "center", fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em" }}>SCAN TO BOOK</div>
                </div>
                <div>
                  <div style={{
                    background: accent, color: isNeon ? "#000" : "#fff",
                    fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: "10px",
                    padding: "7px 14px", borderRadius: "3px", letterSpacing: "0.04em",
                    textTransform: "uppercase", marginBottom: "10px",
                  }}>{innerRight?.cta ?? "Book Now"}</div>
                  <div style={{ fontSize: "9px", color: "#64748b", lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }}>
                    <strong style={{ color: "#1e293b" }}>{dealershipName}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="text-center">
        <span className="chip chip-slate text-[10px]">Tri-fold · {layoutSpec?.foldInstructions ? "Custom fold" : "C-fold"} · 3 panels</span>
      </div>
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
  designStyle?: DesignStyle;
  layoutSpec?: LayoutSpec;
  customerAddress?: { street?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
  dealershipAddress?: { street?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
  dealershipPhone?: string | null;
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
  designStyle = "standard",
  layoutSpec,
  customerAddress,
  dealershipAddress,
  dealershipPhone,
}: TemplatePreviewProps) {
  const qrUrl = qrPropUrl ?? buildPreviewQRImageUrl(
    `${typeof window !== "undefined" ? window.location.origin : ""}/track/preview`,
    80
  );
  const accent = ACCENT[accentColor];

  if (!content && designStyle === "standard") {
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

  if (designStyle === "multi-panel") {
    return (
      <div className="flex justify-center">
        <div className="w-full" style={{ maxWidth: "420px" }}>
          <MultiPanelPreview
            content={content}
            dealershipName={dealershipName}
            customerName={customerName}
            offer={offer}
            qrPreviewUrl={qrUrl}
            logoUrl={logoUrl}
            layoutSpec={layoutSpec}
            accent={accent}
          />
        </div>
      </div>
    );
  }

  if (designStyle === "premium-fluorescent") {
    return (
      <div className="flex justify-center">
        <div className="w-full" style={{ maxWidth: "420px" }}>
          <PremiumFluorescentPreview
            content={content}
            dealershipName={dealershipName}
            customerName={customerName}
            offer={offer}
            qrPreviewUrl={qrUrl}
            logoUrl={logoUrl}
            layoutSpec={layoutSpec}
          />
        </div>
      </div>
    );
  }

  if (designStyle === "complex-fold") {
    return (
      <div className="flex justify-center">
        <div className="w-full" style={{ maxWidth: "420px" }}>
          <ComplexFoldPreview
            dealershipName={dealershipName}
            customerName={customerName}
            offer={offer}
            qrPreviewUrl={qrUrl}
            logoUrl={logoUrl}
            layoutSpec={layoutSpec}
          />
        </div>
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
            customerAddress={customerAddress}
            dealershipAddress={dealershipAddress}
            dealershipPhone={dealershipPhone}
          />
        </div>
      ) : (
        <LetterPreview
          content={content}
          dealershipName={dealershipName}
          templateType={templateType}
          logoUrl={logoUrl}
          accent={accent}
          customerName={customerName}
          customerAddress={customerAddress}
          dealershipAddress={dealershipAddress}
          dealershipPhone={dealershipPhone}
        />
      )}
    </div>
  );
}
