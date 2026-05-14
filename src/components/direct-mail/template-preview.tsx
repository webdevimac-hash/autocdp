"use client";

import { useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { buildPreviewQRImageUrl } from "@/lib/qrcode-gen";
import type { MailTemplateType, DesignStyle, LayoutSpec } from "@/types";

// Two-layer paper fiber texture — anisotropic coarse fiber + fine grain
// Layer 1: directional (baseFrequency x≠y) simulates paper pulp grain direction
// Layer 2: fine high-frequency noise simulates individual surface fibers
const PAPER_TEXTURE = [
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='pf'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.62%200.88' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23pf)' opacity='0.062'/%3E%3C/svg%3E")`,
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='pg'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23pg)' opacity='0.024'/%3E%3C/svg%3E")`,
].join(", ");

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

// ── Improved Handwriting Engine ────────────────────────────────
// 3-scale prime-length lookup arrays: line → word → character
// Each scale uses different prime lengths to avoid periodicities

// Line-level drift (19 elements — slow sinusoidal wander)
const L_DRIFT = [-1.0,-0.5,0.0,0.5,-0.8,-0.2,0.6,-0.6,0.3,-0.7,0.7,-0.3,0.9,-0.1,0.5,-0.8,0.2,-0.5,0.8] as const;

// Word-level drift (17 elements — natural word-to-word height variation)
const W_DRIFT_Y = [-1.9,-1.2,-0.5,-0.1,0.2,0.7,1.2,1.8,-1.4,-0.7,-0.2,0.4,1.4,-0.9,0.9,-1.6,0.7] as const;
// Word lean — whole word gently tilts as pen momentum shifts
const W_LEAN    = [-0.55,-0.25,-0.1,0.0,0.1,0.25,0.48,-0.42,0.15,-0.15,0.35,-0.35,0.2,-0.2,0.32,-0.32,0.12] as const;

// Character-level micro-variation (23 elements — fast noise, wider range than before)
const C_ROT  = [-3.2,-2.4,-1.7,-1.0,-0.5,-0.2,0.1,0.5,0.9,1.6,2.3,3.0,-2.8,-1.8,-0.7,0.7,1.8,2.7,-1.1,-0.3,0.3,1.1,-2.0] as const;
const C_TY   = [-2.3,-1.7,-1.0,-0.5,-0.15,0.2,0.6,1.0,1.5,2.1,-1.9,-1.3,-0.6,0.0,0.5,1.0,1.4,-1.5,-0.8,0.3,-0.4,1.2,-0.9] as const;
const C_SX   = [0.93,0.95,0.97,0.985,0.993,1.0,1.007,1.015,1.025,0.96,0.975,0.99,1.01,0.968,0.982,1.005,0.963,1.02,0.978,0.995,1.012,0.972,0.988] as const;
const C_SY   = [0.94,0.96,0.975,0.985,0.993,1.0,1.01,1.022,0.975,0.99,1.005,0.97,0.985,1.0,1.015,0.963,0.995,0.98,1.025,0.972,1.008,0.955,1.018] as const;
// Wider opacity range (0.52–1.00) for more pronounced light/heavy stroke contrast
const C_OPQ  = [0.52,0.60,0.68,0.76,0.83,0.89,0.93,0.97,1.00,0.98,0.94,0.89,0.83,0.76,0.69,0.63,0.92,0.85,0.74,0.80,0.88,0.67,0.96] as const;
const C_SPC  = [-0.55,-0.35,-0.18,0.0,0.10,0.20,0.32,-0.45,0.15,-0.18,0.26,-0.26,0.06,-0.06,0.21,-0.11,0.0,0.16,-0.22,0.08,-0.08,0.28,-0.38] as const;
// Wider pressure range (0.44–1.00) — more dramatic feathering on lifted strokes
const C_PRES = [0.44,0.54,0.63,0.73,0.82,0.88,0.93,0.97,1.00,0.99,0.95,0.90,0.84,0.77,0.70,0.64,0.92,0.85,0.75,0.80,0.88,0.67,0.96] as const;

type LookupArr = readonly number[];
function pick(arr: LookupArr, n: number): number {
  return arr[((n % arr.length) + arr.length) % arr.length];
}
function hseed(gci: number, code: number, li: number, pi: number, extra = 0): number {
  return (gci * 31 + code * 17 + li * 7 + pi * 3 + extra * 13) | 0;
}

// 6-layer ink shadow: nonlinear pressure + per-character jitter + pooling
// Layers: [sharp core, soft bleed x2, vertical drip, wide ambient, ink pool]
function inkShadow(pressure: number, seed = 0): string {
  // Per-character micro-jitter via three independent prime hashes
  const jx = (((seed * 7919 + 13) & 0xff) / 255 - 0.5) * 0.18;   // ±0.18px horiz
  const jy = (((seed * 6271 + 17) & 0xff) / 255 - 0.5) * 0.13;   // ±0.13px vert
  const jp = ((seed * 5003 + 23) & 0xff) / 255;                    // 0–1 pooling factor
  const bleedRadius = (0.55 - 0.28 * pressure).toFixed(2);
  const sharpRadius = (0.18 + 0.22 * pressure).toFixed(2);
  const a1 = (pressure * pressure * 0.28).toFixed(3);
  const a2 = (pressure * 0.14 + (1 - pressure) * 0.09).toFixed(3);
  const a3 = ((1 - pressure) * 0.13 + pressure * 0.06).toFixed(3);
  const a4 = (pressure * 0.09).toFixed(3);
  const a5 = ((1 - pressure) * 0.09).toFixed(3);
  // 6th layer: ink pooling — zero blur, only visible on high-pressure + high-pool chars
  const a6 = (pressure * jp * 0.07).toFixed(3);
  return [
    ` ${(0.30 + jx).toFixed(2)}px  ${(0.22 + jy).toFixed(2)}px ${sharpRadius}px rgba(18,22,52,${a1})`,
    `${(-0.16 + jx * 0.5).toFixed(2)}px  ${(0.10 + jy * 0.5).toFixed(2)}px ${bleedRadius}px rgba(18,22,52,${a2})`,
    ` ${(0.10 + jx * 0.7).toFixed(2)}px ${(-0.16 + jy * 0.7).toFixed(2)}px ${bleedRadius}px rgba(18,22,52,${a3})`,
    ` ${jx.toFixed(2)}px     ${(0.38 + jy).toFixed(2)}px ${sharpRadius}px rgba(18,22,52,${a4})`,
    ` 0px     0px    ${(parseFloat(bleedRadius) * 1.6).toFixed(2)}px rgba(18,22,52,${a5})`,
    ` ${(jx * 0.4).toFixed(2)}px  ${(jy * 0.4).toFixed(2)}px 0px rgba(18,22,52,${a6})`,
  ].join(",");
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

// Word-level wrapper — applies gentle baseline drift and lean per word
function HandwrittenWord({
  text, wordIdx, lineIdx, paraIdx, startCharOffset, isSignature = false,
}: {
  text: string; wordIdx: number; lineIdx: number; paraIdx: number; startCharOffset: number; isSignature?: boolean;
}) {
  const ws = (wordIdx * 7 + lineIdx * 11 + paraIdx * 3) | 0;
  const wordDriftY = pick(W_DRIFT_Y, ws) * (isSignature ? 1.4 : 1.0);
  const wordLean   = pick(W_LEAN, ws + 5) * (isSignature ? 1.7 : 1.0);

  return (
    <span style={{
      display: "inline-block",
      transform: `translateY(${wordDriftY}px) rotate(${wordLean}deg)`,
      transformOrigin: "bottom left",
    }}>
      {text.split("").map((char, i) => {
        const code = char.charCodeAt(0);
        const s = hseed(startCharOffset + i, code, lineIdx, paraIdx);
        const basePressure = pick(C_PRES, s + 9);
        // Pen fatigue: deeper in letter -> strokes feather as pen lifts
        // 0 at start -> max -12% at char 545+
        const fatigue = Math.min(0.12, (startCharOffset + i) * 0.00022);
        const pressure = basePressure * (1 - fatigue);
        return (
          <span
            key={startCharOffset + i}
            style={{
              display: "inline-block",
              transform: `rotate(${pick(C_ROT, s)}deg) translateY(${pick(C_TY, s + 3)}px) scaleX(${pick(C_SX, s + 7)}) scaleY(${pick(C_SY, s + 11)})`,
              transformOrigin: "bottom center",
              opacity: pick(C_OPQ, s + 5),
              letterSpacing: char === " " ? "0" : `${pick(C_SPC, s + 13)}px`,
              textShadow: inkShadow(pressure, s),
            }}
          >
            {char === " " ? " " : char}
          </span>
        );
      })}
    </span>
  );
}

// Line-level renderer — wraps words and applies line-level drift
function HandwrittenLine({ text, charOffset, lineIdx, paraIdx, isSignature = false }: LineInfo & { isSignature?: boolean }) {
  if (!text.trim()) return <span style={{ display: "block", minHeight: "1.4em" }}>&nbsp;</span>;

  const lineDrift = pick(L_DRIFT, lineIdx * 13 + paraIdx * 7) * (isSignature ? 1.3 : 1.0);

  // Split into word/space segments, preserving all whitespace
  const segments: { text: string; isSpace: boolean; charStart: number }[] = [];
  let current = "";
  let charStart = charOffset;
  let segStart = charOffset;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") {
      if (current) {
        segments.push({ text: current, isSpace: false, charStart: segStart });
        charStart += current.length;
        current = "";
      }
      segments.push({ text: " ", isSpace: true, charStart });
      charStart++;
      segStart = charStart;
    } else {
      if (!current) segStart = charStart;
      current += ch;
      charStart++;
    }
  }
  if (current) {
    segments.push({ text: current, isSpace: false, charStart: segStart });
  }

  let wordIdx = 0;

  return (
    <span style={{ display: "inline-block", transform: `translateY(${lineDrift}px)` }}>
      {segments.map((seg, si) => {
        if (seg.isSpace) {
          return (
            <span
              key={`sp-${si}`}
              style={{ display: "inline-block", width: "0.28em" }}
            >
              {" "}
            </span>
          );
        }
        const wi = wordIdx++;
        return (
          <HandwrittenWord
            key={seg.charStart}
            text={seg.text}
            wordIdx={wi}
            lineIdx={lineIdx}
            paraIdx={paraIdx}
            startCharOffset={seg.charStart}
            isSignature={isSignature}
          />
        );
      })}
    </span>
  );
}

function HandwrittenContent({
  text, fontSize = 17, lineHeight = 1.85,
}: {
  text: string; fontSize?: number; lineHeight?: number;
}) {
  const paras = buildParaLayout(text);
  // Last short paragraph (≤2 lines, text has ≥2 paragraphs) is treated as a
  // closing / signature — receives extra pen lean to simulate the natural flourish
  // of ending a handwritten note.
  const lastParaIsSignature =
    paras.length >= 2 && paras[paras.length - 1].lines.length <= 2;
  return (
    <div style={{
      fontSize: `${fontSize}px`,
      lineHeight,
      color: "#1a1f36",
      fontFamily: "'Patrick Hand', 'Caveat', cursive",
    }}>
      {paras.map((para, pi) => {
        const isSig = lastParaIsSignature && pi === paras.length - 1;
        return (
          <div key={pi} style={{ marginBottom: pi < paras.length - 1 ? `${fontSize * 0.7}px` : 0 }}>
            {para.lines.map((line, li) => (
              <div key={li} style={{ display: "block" }}>
                <HandwrittenLine {...line} isSignature={isSig} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Vehicle Photo Zone ─────────────────────────────────────────
// Shows a real vehicle photo when available; falls back to branded SVG placeholder

function VehiclePhotoZone({
  heroBg, height = "140px", dealershipName, showLabel = true, imageUrl,
}: {
  heroBg: string; height?: string; dealershipName?: string; showLabel?: boolean; imageUrl?: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasRealPhoto = !!imageUrl && !imgFailed;

  return (
    <div style={{ width: "100%", height, position: "relative", overflow: "hidden", flexShrink: 0 }}>
      {hasRealPhoto ? (
        // Real vehicle photograph
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt={dealershipName ? `${dealershipName} vehicle` : "Vehicle"}
          onError={() => setImgFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 55%",
            display: "block",
            // Print-like tone: slight desaturation + contrast boost
            filter: "brightness(0.78) contrast(1.10) saturate(1.08)",
          }}
        />
      ) : (
        // SVG placeholder — brand-color gradient + car silhouette
        <div style={{
          width: "100%", height: "100%",
          background: `linear-gradient(135deg, ${heroBg} 0%, ${adjustBrightness(heroBg, -28)} 100%)`,
          position: "relative",
        }}>
          {/* Subtle perspective grid */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.07, pointerEvents: "none" }} viewBox="0 0 520 140" preserveAspectRatio="none">
            {[65, 130, 195, 260, 325, 390, 455].map((x) => (
              <line key={`v${x}`} x1={x} y1="0" x2={x * 0.62 + 100} y2="140" stroke="white" strokeWidth="0.8" />
            ))}
            {[0, 35, 70, 105, 140].map((y) => (
              <line key={`h${y}`} x1="0" y1={y} x2="520" y2={y} stroke="white" strokeWidth="0.8" />
            ))}
          </svg>
          {/* Car silhouette */}
          <svg style={{ position: "absolute", right: "8%", bottom: "0", opacity: 0.21, width: "58%", height: "82%" }} viewBox="0 0 340 130" preserveAspectRatio="xMidYMax meet">
            <path d="M 30 90 L 45 60 Q 68 40 105 36 L 168 34 Q 192 33 210 40 L 258 62 L 295 67 Q 316 70 320 82 L 322 90 L 325 96 L 28 96 Z" fill="white" />
            <circle cx="90" cy="98" r="15" fill="white" />
            <circle cx="90" cy="98" r="8" fill={heroBg} />
            <circle cx="248" cy="98" r="15" fill="white" />
            <circle cx="248" cy="98" r="8" fill={heroBg} />
            <path d="M 115 38 L 103 60 L 175 60 L 172 37 Z" fill={heroBg} opacity="0.55" />
            <path d="M 180 37 L 177 60 L 240 60 L 234 40 Z" fill={heroBg} opacity="0.55" />
            <path d="M 258 62 L 295 67 L 295 75 L 255 75 Z" fill="white" opacity="0.4" />
          </svg>
        </div>
      )}

      {/* Gradient overlay — text readability + depth */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "70%",
        background: hasRealPhoto
          ? "linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.56) 45%, transparent 100%)"
          : `linear-gradient(to top, ${heroBg}f2 0%, ${heroBg}66 50%, transparent 100%)`,
        pointerEvents: "none",
      }} />
      {/* Top shadow for realistic photo depth */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "35%",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* VEHICLE PHOTO label — only on placeholder, not on real photos */}
      {showLabel && !hasRealPhoto && (
        <div style={{
          position: "absolute", top: "8px", left: "10px",
          background: "rgba(0,0,0,0.32)", backdropFilter: "blur(4px)",
          borderRadius: "3px", padding: "2px 6px",
          fontFamily: "'Inter', sans-serif", fontSize: "5.5px",
          fontWeight: 700, color: "rgba(255,255,255,0.76)",
          letterSpacing: "0.12em", textTransform: "uppercase",
        }}>
          VEHICLE PHOTO
        </div>
      )}
      {dealershipName && (
        <div style={{
          position: "absolute", bottom: "6px", left: "10px",
          fontFamily: "'Inter', sans-serif", fontSize: "7px",
          fontWeight: 800, color: "rgba(255,255,255,0.68)",
          letterSpacing: "0.10em", textTransform: "uppercase",
        }}>
          {dealershipName}
        </div>
      )}
    </div>
  );
}

function adjustBrightness(hex: string, amount: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ── Coupon Strip ───────────────────────────────────────────────

function CouponStrip({ offer, accent, expiresText, conditionsText }: { offer: string; accent: AccentConfig; expiresText?: string; conditionsText?: string }) {
  const dollarMatch = offer.match(/\$(\d+(?:\.\d{2})?)/);
  const isFree = /free/i.test(offer);
  const savingsAmount = dollarMatch ? dollarMatch[1].replace(/\.00$/, "") : null;
  return (
    <div style={{ position: "relative" }}>
      {/* Eyebrow label */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px" }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "6.5px", fontWeight: 900, color: accent.header, letterSpacing: "0.12em", textTransform: "uppercase" }}>★ FEATURED OFFER</span>
        <div style={{ flex: 1, height: "1px", background: `linear-gradient(90deg, ${accent.header}44 0%, transparent 100%)` }} />
      </div>
      {/* Coupon body */}
      <div style={{ display: "flex", border: `2px solid ${accent.offerBorder}`, borderRadius: "5px", overflow: "hidden", background: "white", boxShadow: `0 2px 8px ${accent.header}22` }}>
        <div style={{
          background: `linear-gradient(160deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -20)} 100%)`,
          color: "white", padding: "10px 12px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minWidth: "58px", flexShrink: 0, gap: "1px",
        }}>
          {savingsAmount ? (
            <>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", opacity: 0.88 }}>SAVE</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "22px", fontWeight: 900, lineHeight: 1 }}>${savingsAmount}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", opacity: 0.88 }}>OFF</div>
            </>
          ) : isFree ? (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "15px", fontWeight: 900, lineHeight: 1 }}>FREE</div>
          ) : (
            <>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", opacity: 0.88 }}>SAVE</div>
              <svg width="18" height="18" viewBox="0 0 16 16" style={{ marginTop: "2px" }}>
                <path d="M 8 0 L 9.8 5.4 L 15.5 5.4 L 10.9 8.7 L 12.7 14.1 L 8 10.8 L 3.3 14.1 L 5.1 8.7 L 0.5 5.4 L 6.2 5.4 Z" fill="rgba(255,255,255,0.90)" />
              </svg>
            </>
          )}
        </div>
        {/* Perforation divider */}
        <div style={{ width: "2px", background: "repeating-linear-gradient(180deg, white 0px, white 4px, transparent 4px, transparent 8px)", flexShrink: 0 }} />
        <div style={{ flex: 1, padding: "9px 11px", background: accent.offerBg }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10.5px", fontWeight: 800, color: accent.offerText, lineHeight: 1.25 }}>
            {offer}
          </div>
          {expiresText && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", color: "#B45309", marginTop: "3px", fontWeight: 700, letterSpacing: "0.02em" }}>
              🕐 {expiresText}
            </div>
          )}
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "6px", color: "#9CA3AF", marginTop: "3px", letterSpacing: "0.03em", lineHeight: 1.4 }}>
            {conditionsText ?? "Cannot be combined with other offers"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Offer Callout ─────────────────────────────────────────────
// Full-width accent-colored offer banner used on postcards.
// CouponStrip (above) is kept for letter templates where a cut-out coupon is appropriate.

function OfferCallout({ offer, accent, expiresText, conditionsText }: { offer: string; accent: AccentConfig; expiresText?: string; conditionsText?: string }) {
  const dollarMatch = offer.match(/\$(\d+(?:\.\d{2})?)/);
  const isFree = /free/i.test(offer);
  const savingsAmount = dollarMatch ? dollarMatch[1].replace(/\.00$/, "") : null;

  return (
    <div style={{ background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -22)} 100%)` }}>
      {/* Eyebrow — "★ EXCLUSIVE OFFER" */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.22)",
        padding: "6px 14px 5px",
        fontFamily: "'Inter', sans-serif", fontSize: "7px", fontWeight: 900,
        color: "rgba(255,255,255,0.95)", letterSpacing: "0.24em", textTransform: "uppercase",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>★&nbsp;&nbsp;EXCLUSIVE OFFER</span>
      </div>
      <div style={{ padding: "11px 14px 12px", display: "flex", alignItems: "center", gap: "14px" }}>
      {(savingsAmount || isFree) && (
        <div style={{
          background: "rgba(255,255,255,0.97)",
          borderRadius: "7px", padding: "8px 11px", textAlign: "center",
          flexShrink: 0, minWidth: "64px",
          boxShadow: "0 3px 12px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,1)",
        }}>
          {savingsAmount ? (
            <>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "6.5px", fontWeight: 900, color: accent.header, letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1 }}>SAVE</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "32px", fontWeight: 900, color: accent.header, lineHeight: 1, margin: "2px 0" }}>${savingsAmount}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "6.5px", fontWeight: 900, color: accent.header, letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1 }}>OFF</div>
            </>
          ) : (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "19px", fontWeight: 900, color: accent.header, lineHeight: 1.1 }}>FREE</div>
          )}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "15px", fontWeight: 900, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.01em" }}>{offer}</div>
        {expiresText && (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", color: "rgba(255,255,255,0.85)", marginTop: "5px", fontWeight: 700 }}>🕐 {expiresText}</div>
        )}
        {conditionsText && (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "6px", color: "rgba(255,255,255,0.55)", marginTop: "3px", letterSpacing: "0.03em", lineHeight: 1.4 }}>{conditionsText}</div>
        )}
      </div>
      </div>
    </div>
  );
}

// ── Offer Badge ───────────────────────────────────────────────
// Floating circular badge overlaid on the vehicle photo hero

function OfferBadge({ offer, accent }: { offer: string; accent: AccentConfig }) {
  const dollarMatch = offer.match(/\$(\d+(?:\.\d{2})?)/);
  const isFree = /free/i.test(offer);
  if (!dollarMatch && !isFree) return null;
  const amount = dollarMatch ? dollarMatch[1].replace(/\.00$/, "") : null;
  return (
    <div style={{
      position: "absolute", top: "8px", right: "8px", zIndex: 10,
      width: "90px", height: "90px", borderRadius: "50%",
      background: `radial-gradient(circle at 36% 34%, ${adjustBrightness(accent.header, 24)} 0%, ${accent.header} 44%, ${adjustBrightness(accent.header, -36)} 100%)`,
      boxShadow: `0 10px 32px rgba(0,0,0,0.60), 0 0 0 3px rgba(255,255,255,0.60), 0 0 0 7px ${accent.header}44`,
      border: "3px solid rgba(255,255,255,0.65)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      {amount ? (
        <>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7.5px", fontWeight: 900, color: "rgba(255,255,255,0.90)", letterSpacing: "0.12em", textTransform: "uppercase", lineHeight: 1 }}>SAVE</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "29px", fontWeight: 900, color: "#fff", lineHeight: 1, margin: "2px 0" }}>${amount}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7.5px", fontWeight: 900, color: "rgba(255,255,255,0.90)", letterSpacing: "0.12em", textTransform: "uppercase", lineHeight: 1 }}>OFF</div>
        </>
      ) : (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "18px", fontWeight: 900, color: "#fff", lineHeight: 1 }}>FREE</div>
      )}
    </div>
  );
}

// ── Bold Header Band ──────────────────────────────────────────

function BoldHeaderBand({
  dealershipName, accent, logoUrl, dealershipPhone,
}: {
  dealershipName: string; accent: AccentConfig; logoUrl?: string | null; dealershipPhone?: string | null;
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -20)} 100%)`,
      padding: "10px 14px", position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
      borderBottom: "2px solid rgba(0,0,0,0.18)",
    }}>
      {/* Diagonal sheen stripes */}
      <div style={{ position: "absolute", top: 0, right: "16%", width: "24%", height: "100%", background: "rgba(255,255,255,0.10)", transform: "skewX(-12deg)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, right: "44%", width: "11%", height: "100%", background: "rgba(255,255,255,0.05)", transform: "skewX(-12deg)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl} alt={dealershipName}
            style={{ height: "18px", width: "auto", maxWidth: "60px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        {logoUrl && <div style={{ width: "1px", height: "15px", background: "rgba(255,255,255,0.35)" }} />}
        <span style={{
          fontFamily: "'Inter', sans-serif", fontSize: "10px", fontWeight: 900,
          color: "white", letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {dealershipName}
        </span>
      </div>
      {dealershipPhone && (
        <div style={{
          background: "rgba(255,255,255,0.18)", borderRadius: "4px", padding: "3px 8px",
          fontFamily: "'Inter', sans-serif", fontSize: "8.5px", fontWeight: 800,
          color: "rgba(255,255,255,0.97)", letterSpacing: "0.03em", flexShrink: 0, position: "relative",
        }}>
          {dealershipPhone}
        </div>
      )}
    </div>
  );
}

// ── USPS Indicia ──────────────────────────────────────────────

function USPSIndicia({ city, state, accentColor }: { city?: string | null; state?: string | null; accentColor: string }) {
  const location = [city, state].filter(Boolean).join(", ").toUpperCase() || "ANYTOWN, USA";
  return (
    <div style={{
      width: "92px", height: "76px",
      border: "1.5px solid #CBD5E1", borderRadius: "4px",
      background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "2px", flexShrink: 0, padding: "6px 5px",
      position: "relative", overflow: "hidden",
    }}>
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
            width: "1.8px", height: `${height}px`,
            background: "#475569", borderRadius: "0.5px",
            alignSelf, flexShrink: 0,
          }} />
        );
      })}
    </div>
  );
}

// ── Mode Toggle ───────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: PreviewMode; onChange: (m: PreviewMode) => void }) {
  return (
    <div style={{ display: "inline-flex", background: "#F0EBE3", borderRadius: "8px", padding: "2px", gap: "1px" }}>
      {(["design", "realistic"] as PreviewMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer",
            fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 600,
            background: mode === m ? "white" : "transparent",
            color: mode === m ? "#1e293b" : "#6B7280",
            boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          {m === "design" ? "✎ Preview" : "✦ Print-Ready"}
        </button>
      ))}
    </div>
  );
}

// ── Print-Ready Frame ─────────────────────────────────────────
// Wraps the print-ready card in printer crop marks, a bleed-zone
// dashed indicator, and a PostGrid spec badge.

function PrintReadyFrame({
  children, width = 520,
}: {
  children: ReactNode; width?: number;
}) {
  const markLen = 11;
  const markGap = 5;
  const pad = markLen + markGap + 4;
  const mk: CSSProperties = { position: "absolute", background: "#9B8279" };
  return (
    <div style={{ position: "relative", padding: `${pad}px`, width: "100%", boxSizing: "border-box" }}>
      {/* Bleed-zone dashed indicator */}
      <div style={{
        position: "absolute",
        top: pad - 4, left: pad - 4, right: pad - 4, bottom: pad - 4,
        border: "0.75px dashed rgba(139,114,101,0.42)",
        borderRadius: "1px", pointerEvents: "none",
      }} />
      {/* 8 crop marks — 2 per corner, proper width/height CSS */}
      <div style={{ ...mk, top: pad - 4, left: 0, width: markLen, height: 1 }} />
      <div style={{ ...mk, top: 0, left: pad - 4, width: 1, height: markLen }} />
      <div style={{ ...mk, top: pad - 4, right: 0, width: markLen, height: 1 }} />
      <div style={{ ...mk, top: 0, right: pad - 4, width: 1, height: markLen }} />
      <div style={{ ...mk, bottom: pad - 4, left: 0, width: markLen, height: 1 }} />
      <div style={{ ...mk, bottom: 0, left: pad - 4, width: 1, height: markLen }} />
      <div style={{ ...mk, bottom: pad - 4, right: 0, width: markLen, height: 1 }} />
      <div style={{ ...mk, bottom: 0, right: pad - 4, width: 1, height: markLen }} />
      {/* Spec badge */}
      <div style={{
        position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)",
        fontFamily: "'Inter', sans-serif", fontSize: "7px", fontWeight: 700,
        letterSpacing: "0.09em", color: "#9B8279", textTransform: "uppercase",
        whiteSpace: "nowrap", pointerEvents: "none",
      }}>
        {width >= 480 ? '6″ × 9″' : '8.5″ × 11″'}&nbsp;&middot;&nbsp;300 DPI&nbsp;&middot;&nbsp;PostGrid&nbsp;&middot;&nbsp;1/8″ bleed
      </div>
      {children}
    </div>
  );
}

// ── Realistic Postcard Front ──────────────────────────────────

function RealPostcardFront({
  content, dealershipName, offer, headline, qrPreviewUrl, logoUrl, accent, dealershipAddress, dealershipPhone, vehiclePhotoUrl,
  subHeadline, ctaText, urgencyLine, expiresText, conditionsText,
}: {
  content: string;
  dealershipName: string;
  offer?: string | null;
  headline?: string | null;
  qrPreviewUrl: string;
  logoUrl?: string | null;
  accent: AccentConfig;
  dealershipAddress?: AddressRecord | null;
  dealershipPhone?: string | null;
  vehiclePhotoUrl?: string | null;
  subHeadline?: string | null;
  ctaText?: string | null;
  urgencyLine?: string | null;
  expiresText?: string | null;
  conditionsText?: string | null;
}) {
  const addrLines = addrToLines(dealershipAddress);

  return (
    <div style={{
      maxWidth: "520px",
      background: "#FEFCF3",
      backgroundImage: [
        PAPER_TEXTURE,
        "repeating-linear-gradient(89.4deg, transparent, transparent 4px, rgba(155,135,100,0.022) 4px, rgba(155,135,100,0.022) 5px)",
        "repeating-linear-gradient(90.6deg, transparent, transparent 7px, rgba(155,135,100,0.013) 7px, rgba(155,135,100,0.013) 8px)",
      ].join(", "),
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: "0 2px 4px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.20), 0 0 0 1px rgba(0,0,0,0.05)",
      width: "100%",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Dealer identity bar — always at top */}
      <BoldHeaderBand dealershipName={dealershipName} accent={accent} logoUrl={logoUrl} dealershipPhone={dealershipPhone} />
      {/* Hero vehicle photo — tall, with offer badge + headline overlay */}
      <div style={{ position: "relative" }}>
        <VehiclePhotoZone
          heroBg={accent.header}
          height="220px"
          dealershipName={headline ? undefined : dealershipName}
          imageUrl={vehiclePhotoUrl}
          showLabel={!headline}
        />
        {/* Offer badge — top-right corner */}
        {offer && <OfferBadge offer={offer} accent={accent} />}
        {/* Headline overlay — cinematic gradient, dominant bold text */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "56px 14px 14px",
          background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.60) 50%, transparent 100%)",
          pointerEvents: "none",
        }}>
          {headline && (
            <>
              <div style={{
                fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "36px",
                color: "#fff", lineHeight: 1.02, letterSpacing: "-0.038em",
                textShadow: "0 4px 20px rgba(0,0,0,0.80), 0 1px 4px rgba(0,0,0,0.55)",
              }}>
                {headline}
              </div>
              <div style={{ width: "36px", height: "3px", background: accent.header, borderRadius: "2px", marginTop: "8px", boxShadow: `0 0 8px ${accent.header}` }} />
            </>
          )}
          {subHeadline && (
            <div style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: "12px",
              color: "rgba(255,255,255,0.90)", lineHeight: 1.3, letterSpacing: "-0.01em",
              textShadow: "0 1px 6px rgba(0,0,0,0.55)", marginTop: "6px",
            }}>
              {subHeadline}
            </div>
          )}
          {!headline && !subHeadline && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", fontWeight: 800, color: "rgba(255,255,255,0.70)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
              {dealershipName}
            </div>
          )}
        </div>
      </div>

      {/* Urgency strip — branded accent, not generic amber */}
      {urgencyLine && (
        <div style={{
          background: adjustBrightness(accent.header, -18),
          borderLeft: "5px solid rgba(255,255,255,0.65)",
          padding: "8px 14px", display: "flex", alignItems: "center", gap: "7px",
        }}>
          <span style={{ fontSize: "11px" }}>⚡</span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", flex: 1 }}>{urgencyLine}</span>
          <div style={{ background: "rgba(255,255,255,0.20)", borderRadius: "3px", padding: "2px 7px", fontFamily: "'Inter', sans-serif", fontSize: "6px", fontWeight: 900, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>ACT NOW →</div>
        </div>
      )}

      {/* Offer Banner — dominant full-width accent block (above body copy) */}
      {offer && (
        <OfferCallout offer={offer} accent={accent} expiresText={expiresText ?? undefined} conditionsText={conditionsText ?? undefined} />
      )}

      {/* Body copy — clean campaign sans-serif */}
      <div style={{ padding: "10px 14px 9px" }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: 1.72, color: "#374151", margin: 0, fontWeight: 400 }}>
          {(() => { const max = offer ? 90 : 150; return content.length > max ? content.slice(0, max - 3) + "…" : content; })()}
        </p>
      </div>

      {/* Action row: QR scan + CTA button side by side */}
      <div style={{ padding: "10px 14px 12px", display: "flex", gap: "10px", alignItems: "stretch" }}>
        {/* QR code */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
          <div style={{ background: "white", border: `2.5px solid ${accent.header}`, borderRadius: "8px", padding: "4px", boxShadow: `0 3px 10px ${accent.header}33` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrPreviewUrl} alt="Scan to schedule" width={64} height={64} style={{ display: "block", borderRadius: "4px" }} />
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "5px", fontWeight: 900, color: accent.header, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>
            SCAN TO<br />SCHEDULE
          </div>
        </div>
        {/* CTA — fills remaining width, shows phone as secondary line */}
        <div style={{ flex: 1, display: "flex" }}>
          <div style={{
            flex: 1,
            background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -16)} 100%)`,
            color: "white", fontFamily: "'Inter', sans-serif", fontWeight: 900,
            borderRadius: "4px", padding: "0 12px",
            boxShadow: `0 6px 16px ${accent.header}55`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px",
          }}>
            <div style={{ fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>{ctaText ?? "Call to Schedule Today"}</span>
              <span style={{ opacity: 0.75, fontSize: "15px", lineHeight: 1 }}>→</span>
            </div>
            {dealershipPhone && (
              <div style={{ fontSize: "9.5px", fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.03em" }}>{dealershipPhone}</div>
            )}
          </div>
        </div>
      </div>

      {/* Address footer */}
      {(addrLines.line1 || addrLines.line2) && (
        <div style={{ padding: "5px 14px", borderTop: "1px solid #EDE8D8", background: "rgba(254,252,243,0.97)", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={accent.header} strokeWidth="2" style={{ width: "14px", height: "14px", flexShrink: 0 }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", color: "#6B7280", lineHeight: 1.4 }}>
            {addrLines.line1}{addrLines.line2 ? ` · ${addrLines.line2}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Realistic Postcard Back ───────────────────────────────────

function RealPostcardBack({
  dealershipName, customerName, logoUrl, accent, dealershipAddress, dealershipPhone, customerAddress, content,
}: {
  dealershipName: string;
  customerName?: string;
  logoUrl?: string | null;
  accent: AccentConfig;
  dealershipAddress?: AddressRecord | null;
  dealershipPhone?: string | null;
  customerAddress?: AddressRecord | null;
  content?: string;
}) {
  const dAddrLines = addrToLines(dealershipAddress);
  const cAddrLines = addrToLines(customerAddress);

  return (
    <div style={{
      maxWidth: "520px", minHeight: "320px",
      background: "#FEFCF3",
      backgroundImage: [
        PAPER_TEXTURE,
        "repeating-linear-gradient(89.4deg, transparent, transparent 4px, rgba(155,135,100,0.022) 4px, rgba(155,135,100,0.022) 5px)",
        "repeating-linear-gradient(90.6deg, transparent, transparent 7px, rgba(155,135,100,0.013) 7px, rgba(155,135,100,0.013) 8px)",
      ].join(", "),
      borderRadius: "8px", overflow: "hidden",
      boxShadow: "0 2px 4px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.20), 0 0 0 1px rgba(0,0,0,0.05)",
      display: "flex", flexDirection: "column", width: "100%",
    }}>
      <div style={{ height: "6px", background: `linear-gradient(90deg, ${accent.header} 0%, ${adjustBrightness(accent.header, 20)} 100%)` }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 14px 8px", borderBottom: "1px solid rgba(218,209,189,0.5)" }}>
        <div style={{ fontFamily: "'Inter', sans-serif", lineHeight: 1.55 }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={dealershipName}
              style={{ height: "13px", width: "auto", maxWidth: "50px", objectFit: "contain", display: "block", marginBottom: "3px" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div style={{ fontSize: "8px", fontWeight: 800, color: "#1F2937" }}>{dealershipName}</div>
          {dAddrLines.line1 && <div style={{ fontSize: "7px", color: "#6B7280" }}>{dAddrLines.line1}</div>}
          {dAddrLines.line2 && <div style={{ fontSize: "7px", color: "#6B7280" }}>{dAddrLines.line2}</div>}
          {dealershipPhone && <div style={{ fontSize: "7px", color: "#6B7280", marginTop: "1px" }}>{dealershipPhone}</div>}
        </div>
        <USPSIndicia city={dealershipAddress?.city} state={dealershipAddress?.state} accentColor={accent.header} />
      </div>

      <div style={{ flex: 1, display: "flex", position: "relative", minHeight: "160px" }}>
        <div style={{ position: "absolute", top: "10px", bottom: "10px", left: "46%", width: "1px", background: "repeating-linear-gradient(180deg, #9CA3AF 0, #9CA3AF 5px, transparent 5px, transparent 10px)" }} />
        <div style={{ width: "44%", padding: "10px 10px 8px 14px", backgroundImage: "repeating-linear-gradient(transparent, transparent 20px, rgba(218,209,189,0.35) 20px, rgba(218,209,189,0.35) 21px)", backgroundPositionY: "30px", overflow: "hidden" }}>
          <div style={{ fontSize: "5.5px", color: "#C4B69A", fontFamily: "'Inter', sans-serif", letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 700, marginBottom: "6px" }}>MESSAGE AREA</div>
          {content && (
            <div style={{
              fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "9.5px",
              color: "#6B7280", lineHeight: "20px", overflow: "hidden",
              maxHeight: "120px", wordBreak: "break-word",
            }}>
              {content.slice(0, 160)}{content.length > 160 ? "…" : ""}
            </div>
          )}
        </div>
        <div style={{ flex: 1, padding: "10px 14px 8px 18px" }}>
          <div style={{ fontSize: "6px", fontFamily: "'Inter', sans-serif", fontWeight: 800, color: "#9CA3AF", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>DELIVER TO</div>
          <div style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: "3px", padding: "7px 10px 8px", background: "rgba(255,255,255,0.55)" }}>
            <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "18px", color: "#1F2937", fontWeight: 700, lineHeight: 1.2 }}>{customerName ?? "Customer Name"}</div>
            {cAddrLines.line1 ? (
              <>
                <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "13px", color: "#4B5563", marginTop: "1px" }}>{cAddrLines.line1}</div>
                <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "12px", color: "#6B7280" }}>{cAddrLines.line2}</div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "13px", color: "#C4B69A", marginTop: "1px" }}>123 Delivery Address</div>
                <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "12px", color: "#C4B69A" }}>City, ST 00000</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "5px 14px 10px", borderTop: "1px solid rgba(218,209,189,0.5)" }}>
        <div style={{ fontSize: "5px", color: "#C4B69A", fontFamily: "'Inter', sans-serif", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: "3px", fontWeight: 700 }}>INTELLIGENT MAIL BARCODE</div>
        <IMBBarcode />
      </div>
    </div>
  );
}

// ── Realistic Letter Preview ──────────────────────────────────

function RealLetterPreview({
  content, dealershipName, templateType, logoUrl, accent, customerName, customerAddress, dealershipAddress, dealershipPhone,
  offer, headline, ctaText, expiresText, conditionsText,
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
  offer?: string | null;
  headline?: string | null;
  ctaText?: string | null;
  expiresText?: string | null;
  conditionsText?: string | null;
}) {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const is8511 = templateType === "letter_8.5x11";
  const cAddrLines = addrToLines(customerAddress);
  const dAddrLines = addrToLines(dealershipAddress);
  // If the AI content already ends with a short signoff paragraph (≤2 lines), don't
  // render the hardcoded "Sincerely," block — that would double the closing.
  const contentParas = content.trim().split(/\n\n+/).filter((p) => p.trim());
  const lastPara = contentParas[contentParas.length - 1] ?? "";
  const contentHasSignoff =
    contentParas.length >= 2 && lastPara.split("\n").filter((l) => l.trim()).length <= 2;

  return (
    <div style={{
      maxWidth: is8511 ? "440px" : "340px",
      background: "#FFFFFF",
      backgroundImage: [
        PAPER_TEXTURE,
        "repeating-linear-gradient(89.4deg, transparent, transparent 4px, rgba(155,135,100,0.012) 4px, rgba(155,135,100,0.012) 5px)",
        "repeating-linear-gradient(90.6deg, transparent, transparent 7px, rgba(155,135,100,0.008) 7px, rgba(155,135,100,0.008) 8px)",
      ].join(", "),
      borderRadius: "4px", overflow: "hidden",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.14)",
      width: "100%",
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -22)} 100%)`,
        padding: "12px 22px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, right: "14%", width: "26%", height: "100%", background: "rgba(255,255,255,0.09)", transform: "skewX(-12deg)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, right: "44%", width: "12%", height: "100%", background: "rgba(255,255,255,0.04)", transform: "skewX(-12deg)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={dealershipName}
              style={{ height: is8511 ? "26px" : "20px", width: "auto", maxWidth: "80px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {logoUrl && <div style={{ width: "1px", height: is8511 ? "22px" : "17px", background: "rgba(255,255,255,0.30)" }} />}
          <div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: is8511 ? "13px" : "11px", fontWeight: 900, color: "white", lineHeight: 1, letterSpacing: "0.02em" }}>{dealershipName}</div>
            {dealershipPhone && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7.5px", color: "rgba(255,255,255,0.82)", marginTop: "2px" }}>{dealershipPhone}</div>}
          </div>
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7.5px", color: "rgba(255,255,255,0.70)", textAlign: "right", position: "relative" }}>{today}</div>
      </div>

      {(dAddrLines.line1 || dAddrLines.line2) && (
        <div style={{ padding: "5px 22px", background: `${accent.header}11`, borderBottom: `1px solid ${accent.header}22` }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", color: "#6B7280" }}>
            {dAddrLines.line1}{dAddrLines.line2 ? ` · ${dAddrLines.line2}` : ""}
          </span>
        </div>
      )}

      {cAddrLines.line1 && (
        <div style={{ padding: "14px 22px 0px" }}>
          <div style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif", fontWeight: 700, color: "#374151" }}>{customerName}</div>
          <div style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", color: "#6B7280" }}>{cAddrLines.line1}</div>
          {cAddrLines.line2 && <div style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif", color: "#6B7280" }}>{cAddrLines.line2}</div>}
        </div>
      )}

      {headline && (
        <div style={{ background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -26)} 100%)`, padding: is8511 ? "16px 22px" : "13px 22px", margin: "14px 0 0", position: "relative", overflow: "hidden" }}>
          {/* Sheen stripe */}
          <div style={{ position: "absolute", top: 0, right: "18%", width: "28%", height: "100%", background: "rgba(255,255,255,0.08)", transform: "skewX(-12deg)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 0, right: "50%", width: "14%", height: "100%", background: "rgba(255,255,255,0.04)", transform: "skewX(-12deg)", pointerEvents: "none" }} />
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: is8511 ? "24px" : "20px", fontWeight: 900, color: "#fff", lineHeight: 1.12, letterSpacing: "-0.025em", textShadow: "0 2px 8px rgba(0,0,0,0.40)", position: "relative" }}>{headline}</div>
        </div>
      )}

      <div style={{ padding: "14px 22px 0" }}>
        <HandwrittenContent text={content} fontSize={is8511 ? 14 : 13} lineHeight={1.88} />
      </div>

      {!contentHasSignoff && (
        <div style={{ padding: "10px 22px 18px" }}>
          <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: is8511 ? 17 : 15, color: "#374151", lineHeight: 1.2 }}>Sincerely,</div>
          <div style={{
            fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: is8511 ? 22 : 19, color: "#1F2937",
            fontWeight: 700, marginTop: "8px", letterSpacing: "0.01em",
            borderBottom: "1px solid rgba(0,0,0,0.08)", paddingBottom: "4px",
            display: "inline-block", minWidth: "100px",
          }}>
            {dealershipName.split(" ")[0]}
          </div>
          <div style={{ fontSize: "7.5px", fontFamily: "'Inter', sans-serif", color: "#9CA3AF", marginTop: "3px" }}>
            {dealershipName} — Service Department
          </div>
        </div>
      )}

      {offer && (
        <div style={{ padding: "0 22px 14px" }}>
          <CouponStrip offer={offer} accent={accent} expiresText={expiresText ?? undefined} conditionsText={conditionsText ?? undefined} />
        </div>
      )}

      {(ctaText ?? headline) && (
        <div style={{ padding: "0 22px 16px" }}>
          <div style={{
            background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -16)} 100%)`,
            color: "white", fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 900,
            letterSpacing: "0.07em", textTransform: "uppercase", padding: "14px 16px",
            borderRadius: "5px", textAlign: "center", display: "flex", alignItems: "center",
            justifyContent: "center", gap: "8px",
            boxShadow: `0 8px 24px ${accent.header}55, 0 2px 6px rgba(0,0,0,0.14)`,
          }}>
            <span>{ctaText ?? (dealershipPhone ? `Call ${dealershipPhone}` : "Call Us Today")}</span>
            <span style={{ opacity: 0.75, fontSize: "13px", lineHeight: 1 }}>→</span>
          </div>
        </div>
      )}

      <div style={{ height: "5px", background: `linear-gradient(90deg, ${accent.header} 0%, ${adjustBrightness(accent.header, 20)} 100%)` }} />
    </div>
  );
}

// ── Postcard back side (design mode) ─────────────────────────

function PostcardBack({
  dealershipName, customerName, accent, logoUrl, customerAddress, dealershipAddress,
}: {
  dealershipName: string; customerName?: string; accent: AccentConfig; logoUrl?: string | null;
  customerAddress?: AddressRecord | null; dealershipAddress?: AddressRecord | null;
}) {
  const cAddrLines = addrToLines(customerAddress);
  const dAddrLines = addrToLines(dealershipAddress);
  return (
    <div style={{
      width: "100%", maxWidth: "420px",
      background: "#FEFCF3", backgroundImage: PAPER_TEXTURE, border: "1px solid #D1C9B0",
      borderRadius: "12px", overflow: "hidden", fontFamily: "'Inter', sans-serif",
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 10px 24px -4px rgba(0,0,0,0.10)",
    }}>
      <div style={{ height: "5px", background: accent.header }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 16px 10px", borderBottom: "1px solid rgba(218,209,189,0.5)" }}>
        <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", lineHeight: 1.55 }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={dealershipName}
              style={{ height: "15px", width: "auto", maxWidth: "52px", objectFit: "contain", display: "block", marginBottom: "3px" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div style={{ fontSize: "11px", color: "#475569", fontWeight: 600 }}>{dealershipName}</div>
          {dAddrLines.line1 && <div style={{ fontSize: "9px", color: "#94a3b8" }}>{dAddrLines.line1}</div>}
          {dAddrLines.line2 && <div style={{ fontSize: "9px", color: "#94a3b8" }}>{dAddrLines.line2}</div>}
        </div>
        <USPSIndicia city={dealershipAddress?.city} state={dealershipAddress?.state} accentColor={accent.header} />
      </div>
      <div style={{ height: "1px", margin: "0 16px", background: "repeating-linear-gradient(90deg, #CBD5E1 0, #CBD5E1 6px, transparent 6px, transparent 12px)" }} />
      <div style={{ padding: "12px 16px 16px" }}>
        <div style={{ fontSize: "7.5px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.10em", marginBottom: "8px", textTransform: "uppercase" }}>DELIVER TO:</div>
        <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", lineHeight: 1.65 }}>
          <div style={{ fontSize: "16px", color: "#1e293b", fontWeight: 700 }}>{customerName ?? "Customer Name"}</div>
          {cAddrLines.line1 ? (
            <>
              <div style={{ fontSize: "13px", color: "#475569" }}>{cAddrLines.line1}</div>
              <div style={{ fontSize: "12px", color: "#64748B" }}>{cAddrLines.line2}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "13px", color: "#C4B69A" }}>Street Address</div>
              <div style={{ fontSize: "12px", color: "#C4B69A" }}>City, ST 00000</div>
            </>
          )}
        </div>
        <IMBBarcode />
      </div>
    </div>
  );
}

// ── Postcard 6x9 Preview ──────────────────────────────────────

function Postcard6x9Preview({
  content, dealershipName, customerName, offer, headline, qrPreviewUrl, logoUrl, accent,
  customerAddress, dealershipAddress, dealershipPhone, vehiclePhotoUrl, initialMode,
  subHeadline, ctaText, urgencyLine, expiresText, conditionsText,
}: {
  content: string;
  dealershipName: string;
  customerName?: string;
  offer?: string | null;
  headline?: string | null;
  qrPreviewUrl: string;
  logoUrl?: string | null;
  accent: AccentConfig;
  customerAddress?: AddressRecord | null;
  dealershipAddress?: AddressRecord | null;
  dealershipPhone?: string | null;
  vehiclePhotoUrl?: string | null;
  initialMode?: PreviewMode;
  subHeadline?: string | null;
  ctaText?: string | null;
  urgencyLine?: string | null;
  expiresText?: string | null;
  conditionsText?: string | null;
}) {
  const [showBack, setShowBack] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(initialMode ?? "realistic");

  return (
    <div className="space-y-2.5">
      <div className="flex justify-center">
        <ModeToggle mode={previewMode} onChange={setPreviewMode} />
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {(["Front", "Back (Mailing Side)"] as const).map((label, i) => (
          <button key={label} onClick={() => setShowBack(i === 1)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
              showBack === (i === 1) ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:border-slate-300"
            }`}>{label}</button>
        ))}
      </div>

      {previewMode === "design" ? (
        <div className="relative flex justify-center">
          <div className="absolute -bottom-1.5 rounded-b-xl blur-sm -z-10" style={{ left: "16px", right: "16px", height: "14px", background: "rgba(15, 23, 42, 0.10)" }} />

          {!showBack ? (
            <div className="rounded-xl overflow-hidden" style={{
              width: "100%", maxWidth: "420px",
              background: "#FEFCF3",
              backgroundImage: [
                PAPER_TEXTURE,
                "repeating-linear-gradient(transparent, transparent 30px, #EDE8D8 30px, #EDE8D8 31px)",
              ].join(", "),
              backgroundPositionY: "72px",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 10px 24px -4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
            }}>
              {/* Dealer identity bar — always at top */}
              <BoldHeaderBand dealershipName={dealershipName} accent={accent} logoUrl={logoUrl} dealershipPhone={dealershipPhone} />
              {/* Vehicle photo — tall hero with offer badge + headline overlay */}
              <div style={{ position: "relative" }}>
                <VehiclePhotoZone heroBg={accent.header} height="170px" imageUrl={vehiclePhotoUrl} showLabel={!headline} dealershipName={headline ? undefined : dealershipName} />
                {offer && <OfferBadge offer={offer} accent={accent} />}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "40px 14px 10px", background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 60%, transparent 100%)", pointerEvents: "none" }}>
                  {headline && <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "21px", color: "#fff", lineHeight: 1.1, letterSpacing: "-0.025em", textShadow: "0 3px 10px rgba(0,0,0,0.65)" }}>{headline}</div>}
                  {subHeadline && <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: "11px", color: "rgba(255,255,255,0.90)", lineHeight: 1.3, marginTop: "4px", textShadow: "0 1px 5px rgba(0,0,0,0.55)" }}>{subHeadline}</div>}
                  {!headline && !subHeadline && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", fontWeight: 800, color: "rgba(255,255,255,0.70)", letterSpacing: "0.10em", textTransform: "uppercase" }}>{dealershipName}</div>}
                </div>
              </div>

              {/* Urgency strip — branded accent */}
              {urgencyLine && (
                <div style={{
                  background: adjustBrightness(accent.header, -18),
                  borderLeft: "5px solid rgba(255,255,255,0.65)",
                  padding: "8px 16px", display: "flex", alignItems: "center", gap: "7px",
                }}>
                  <span style={{ fontSize: "11px" }}>⚡</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", flex: 1 }}>{urgencyLine}</span>
                  <div style={{ background: "rgba(255,255,255,0.20)", borderRadius: "3px", padding: "2px 7px", fontFamily: "'Inter', sans-serif", fontSize: "6px", fontWeight: 900, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>ACT NOW →</div>
                </div>
              )}

              {/* Offer Banner — above body copy */}
              {offer && (
                <OfferCallout offer={offer} accent={accent} expiresText={expiresText ?? undefined} conditionsText={conditionsText ?? undefined} />
              )}

              {/* Body copy — clean campaign sans-serif */}
              <div style={{ padding: "10px 16px 9px" }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", lineHeight: 1.72, color: "#374151", margin: 0, fontWeight: 400 }}>
                  {(() => { const max = offer ? 90 : 150; return content.length > max ? content.slice(0, max - 3) + "…" : content; })()}
                </p>
              </div>
              {/* Action row: QR + CTA */}
              <div style={{ padding: "10px 16px 14px", display: "flex", gap: "10px", alignItems: "stretch" }}>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                  <div style={{ background: "white", border: `2.5px solid ${accent.header}`, borderRadius: "8px", padding: "4px", boxShadow: `0 3px 10px ${accent.header}33` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrPreviewUrl} alt="QR" width={64} height={64} style={{ display: "block", borderRadius: "4px" }} />
                  </div>
                  <div style={{ fontSize: "5px", color: accent.header, fontFamily: "'Inter', sans-serif", fontWeight: 900, letterSpacing: "0.08em", textAlign: "center", textTransform: "uppercase", lineHeight: 1.3 }}>SCAN TO<br />SCHEDULE</div>
                </div>
                <div style={{ flex: 1, display: "flex" }}>
                  <div style={{
                    flex: 1,
                    background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -16)} 100%)`,
                    color: "white", fontFamily: "'Inter', sans-serif", fontWeight: 900,
                    borderRadius: "4px", padding: "0 12px",
                    boxShadow: `0 6px 16px ${accent.header}55`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px",
                  }}>
                    <div style={{ fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{ctaText ?? "Call to Schedule Today"}</span>
                      <span style={{ opacity: 0.75, fontSize: "15px", lineHeight: 1 }}>→</span>
                    </div>
                    {dealershipPhone && (
                      <div style={{ fontSize: "9.5px", fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.03em" }}>{dealershipPhone}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <PostcardBack dealershipName={dealershipName} customerName={customerName} accent={accent} logoUrl={logoUrl} customerAddress={customerAddress} dealershipAddress={dealershipAddress} />
          )}
        </div>
      ) : (
        <div style={{ background: "linear-gradient(145deg, #EAE5DE 0%, #E0D9D0 100%)", padding: "14px 8px 18px", borderRadius: 14 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 560 }}>
              <PrintReadyFrame width={520}>
                <div style={{ transform: "rotate(-0.4deg)", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.22))" }}>
                  {!showBack ? (
                    <RealPostcardFront
                      content={content} dealershipName={dealershipName} offer={offer} headline={headline}
                      qrPreviewUrl={qrPreviewUrl} logoUrl={logoUrl} accent={accent}
                      dealershipAddress={dealershipAddress} dealershipPhone={dealershipPhone}
                      vehiclePhotoUrl={vehiclePhotoUrl}
                      subHeadline={subHeadline} ctaText={ctaText} urgencyLine={urgencyLine}
                      expiresText={expiresText} conditionsText={conditionsText}
                    />
                  ) : (
                    <RealPostcardBack
                      dealershipName={dealershipName} customerName={customerName} logoUrl={logoUrl}
                      accent={accent} dealershipAddress={dealershipAddress}
                      dealershipPhone={dealershipPhone} customerAddress={customerAddress}
                      content={content}
                    />
                  )}
                </div>
              </PrintReadyFrame>
            </div>
          </div>
          {customerName && (
            <p className="text-center mt-2" style={{ fontSize: 9, color: "#9B8E83", fontFamily: "'Inter', sans-serif" }}>
              Will be mailed to: <strong style={{ color: "#6B5E54" }}>{customerName}</strong>
              {customerAddress?.street ? ` · ${customerAddress.street}, ${[customerAddress.city, customerAddress.state].filter(Boolean).join(", ")}` : ""}
            </p>
          )}
        </div>
      )}

      <div className="text-center">
        <span className="chip chip-slate text-[10px]">
          {previewMode === "realistic"
            ? (showBack ? "✦ Mailing side · USPS First Class · PostGrid prints this exact layout" : "✦ Front · Vehicle photo + handwritten copy · Printed by PostGrid")
            : (showBack ? "↑ Mailing side · Back has address + USPS indicia" : "↑ Front · Vehicle photo + personalized handwriting + offer coupon")}
        </span>
      </div>
    </div>
  );
}

// ── Letter Preview ────────────────────────────────────────────

function LetterPreview({
  content, dealershipName, templateType, logoUrl, accent,
  customerName, customerAddress, dealershipAddress, dealershipPhone, initialMode,
  offer, headline, ctaText, expiresText, conditionsText,
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
  initialMode?: PreviewMode;
  offer?: string | null;
  headline?: string | null;
  ctaText?: string | null;
  expiresText?: string | null;
  conditionsText?: string | null;
}) {
  const aspectRatio = templateType === "letter_8.5x11" ? "8.5/11" : "6/9";
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const [previewMode, setPreviewMode] = useState<PreviewMode>(initialMode ?? "realistic");
  const cAddrLines = addrToLines(customerAddress);

  return (
    <div className="space-y-2.5">
      <div className="flex justify-center">
        <ModeToggle mode={previewMode} onChange={setPreviewMode} />
      </div>

      {previewMode === "design" ? (
        <div className="rounded-xl shadow-xl overflow-hidden" style={{
          width: "100%", maxWidth: templateType === "letter_8.5x11" ? "480px" : "360px",
          aspectRatio, position: "relative", background: "#FFFFFF",
          backgroundImage: PAPER_TEXTURE,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -22)} 100%)`,
            padding: templateType === "letter_8.5x11" ? "14px 28px" : "10px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
            position: "relative", overflow: "hidden",
            borderBottom: "2px solid rgba(0,0,0,0.16)",
          }}>
            <div style={{ position: "absolute", top: 0, right: "18%", width: "22%", height: "100%", background: "rgba(255,255,255,0.09)", transform: "skewX(-12deg)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 0, right: "44%", width: "10%", height: "100%", background: "rgba(255,255,255,0.04)", transform: "skewX(-12deg)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={dealershipName}
                  style={{ height: templateType === "letter_8.5x11" ? "26px" : "20px", width: "auto", maxWidth: "80px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              {logoUrl && <div style={{ width: "1px", height: templateType === "letter_8.5x11" ? "20px" : "15px", background: "rgba(255,255,255,0.30)" }} />}
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: templateType === "letter_8.5x11" ? "14px" : "11px", fontWeight: 900, color: "white", letterSpacing: "0.03em" }}>{dealershipName}</div>
                {dealershipPhone && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7.5px", color: "rgba(255,255,255,0.80)", marginTop: "1px" }}>{dealershipPhone}</div>}
              </div>
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", color: "rgba(255,255,255,0.70)", textAlign: "right", position: "relative" }}>{today}</div>
          </div>

          {cAddrLines.line1 && (
            <div style={{ padding: templateType === "letter_8.5x11" ? "16px 28px 0" : "12px 20px 0" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 700, color: "#374151" }}>{customerName}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: "#6B7280" }}>{cAddrLines.line1}</div>
              {cAddrLines.line2 && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: "#6B7280" }}>{cAddrLines.line2}</div>}
            </div>
          )}

          {headline && (
            <div style={{ background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -24)} 100%)`, padding: templateType === "letter_8.5x11" ? "13px 28px" : "10px 20px", margin: "14px 0 0", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, right: "20%", width: "20%", height: "100%", background: "rgba(255,255,255,0.08)", transform: "skewX(-12deg)", pointerEvents: "none" }} />
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: templateType === "letter_8.5x11" ? "18px" : "14px", fontWeight: 900, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.015em", position: "relative" }}>{headline}</div>
            </div>
          )}

          <div style={{ flex: 1, padding: templateType === "letter_8.5x11" ? "14px 28px 0" : "12px 20px 0", overflow: "hidden" }}>
            <HandwrittenContent text={content} fontSize={templateType === "letter_8.5x11" ? 14 : 13} lineHeight={1.88} />
          </div>

          {offer && (
            <div style={{ padding: templateType === "letter_8.5x11" ? "0 28px 14px" : "0 20px 12px" }}>
              <CouponStrip offer={offer} accent={accent} expiresText={expiresText ?? undefined} conditionsText={conditionsText ?? undefined} />
            </div>
          )}

          <div style={{ height: "4px", background: accent.header, marginTop: "auto", flexShrink: 0 }} />
        </div>
      ) : (
        <div style={{ background: "linear-gradient(145deg, #EAE5DE 0%, #E0D9D0 100%)", padding: "14px 8px 18px", borderRadius: 14 }}>
          <div className="flex justify-center">
            <div style={{ width: "100%", maxWidth: 520 }}>
              <PrintReadyFrame width={templateType === "letter_8.5x11" ? 440 : 340}>
                <div style={{ transform: "rotate(-0.3deg)", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18))" }}>
                  <RealLetterPreview
                    content={content} dealershipName={dealershipName} templateType={templateType}
                    logoUrl={logoUrl} accent={accent} customerName={customerName}
                    customerAddress={customerAddress} dealershipAddress={dealershipAddress}
                    dealershipPhone={dealershipPhone}
                    offer={offer} headline={headline} ctaText={ctaText}
                    expiresText={expiresText} conditionsText={conditionsText}
                  />
                </div>
              </PrintReadyFrame>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Multi-Panel Preview ───────────────────────────────────────

function MultiPanelPreview({
  content, dealershipName, customerName, offer, qrPreviewUrl, logoUrl, layoutSpec, accent, vehiclePhotoUrl,
  headline: headlineProp, ctaText, expiresText, conditionsText, urgencyLine,
}: {
  content: string; dealershipName: string; customerName?: string; offer?: string | null;
  qrPreviewUrl: string; logoUrl?: string | null; layoutSpec?: LayoutSpec; accent: AccentConfig;
  vehiclePhotoUrl?: string | null;
  headline?: string | null; ctaText?: string | null;
  expiresText?: string | null; conditionsText?: string | null;
  urgencyLine?: string | null;
}) {
  const [showBack, setShowBack] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("realistic");
  const front = layoutSpec?.panels?.find((p) => p.role === "front") ?? layoutSpec?.panels?.[0];
  const cs = layoutSpec?.colorScheme;
  const heroBg = cs?.primary ?? accent.header;
  const accentHex = cs?.accent ?? accent.offerBorder;
  const resolvedHeadline = headlineProp ?? front?.headline ?? dealershipName;

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <ModeToggle mode={previewMode} onChange={setPreviewMode} />
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {["Front", "Back (Mailing Side)"].map((label, i) => (
          <button key={label} onClick={() => setShowBack(i === 1)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
              showBack === (i === 1) ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:border-slate-300"
            }`}>{label}</button>
        ))}
      </div>
      {previewMode === "design" ? (
        <div className="flex justify-center">
          {!showBack ? (
            <div className="w-full rounded-xl border border-slate-200 shadow-xl overflow-hidden" style={{ maxWidth: "420px", background: "#fff" }}>
              <BoldHeaderBand dealershipName={dealershipName} accent={{ ...accent, header: accentHex, offerBorder: accentHex }} logoUrl={logoUrl} dealershipPhone={undefined} />
              <div style={{ position: "relative" }}>
                <VehiclePhotoZone heroBg={heroBg} height="200px" showLabel={false} imageUrl={vehiclePhotoUrl} />
                {offer && <OfferBadge offer={offer} accent={{ ...accent, header: accentHex, offerBorder: accentHex, offerBg: accent.offerBg, offerText: accent.offerText, letterBorder: accent.letterBorder, highlightGlow: accent.highlightGlow, isHighlight: accent.isHighlight }} />}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "52px 16px 13px", background: `linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)`, pointerEvents: "none" }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "30px", color: "#fff", lineHeight: 1.04, letterSpacing: "-0.030em", textShadow: "0 3px 14px rgba(0,0,0,0.72)" }}>{resolvedHeadline}</div>
                  <div style={{ width: "32px", height: "3px", background: accentHex, borderRadius: "2px", marginTop: "8px", boxShadow: `0 0 8px ${accentHex}` }} />
                </div>
              </div>
              {urgencyLine && (
                <div style={{
                  background: adjustBrightness(accentHex, -18),
                  borderLeft: "5px solid rgba(255,255,255,0.65)",
                  padding: "8px 18px", display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <span style={{ fontSize: "11px" }}>⚡</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", flex: 1 }}>{urgencyLine}</span>
                  <div style={{ background: "rgba(255,255,255,0.20)", borderRadius: "3px", padding: "2px 7px", fontFamily: "'Inter', sans-serif", fontSize: "6px", fontWeight: 900, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>ACT NOW →</div>
                </div>
              )}
              {/* Offer banner — above body copy */}
              {offer && (
                <OfferCallout offer={offer} accent={{ ...accent, header: accentHex, offerBorder: accentHex, offerBg: accent.offerBg, offerText: accent.offerText, letterBorder: accent.letterBorder, highlightGlow: accent.highlightGlow, isHighlight: accent.isHighlight }} expiresText={expiresText ?? undefined} conditionsText={conditionsText ?? undefined} />
              )}
              {/* Body copy — clean campaign sans-serif */}
              <div style={{ padding: "11px 18px 9px" }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: 1.72, color: "#374151", margin: 0, fontWeight: 400 }}>
                  {(() => { const max = offer ? 90 : 150; return content.length > max ? content.slice(0, max - 3) + "…" : content; })()}
                </p>
              </div>
              {/* Action row: QR + CTA */}
              <div style={{ padding: "10px 18px 16px", display: "flex", gap: "10px", alignItems: "stretch" }}>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                  <div style={{ background: "white", border: `2.5px solid ${accentHex}`, borderRadius: "8px", padding: "4px", boxShadow: `0 3px 10px ${accentHex}33` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrPreviewUrl} alt="QR" width={64} height={64} style={{ display: "block", borderRadius: "4px" }} />
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "5px", fontWeight: 900, color: accentHex, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>SCAN TO<br />BOOK</div>
                </div>
                <div style={{ flex: 1, display: "flex" }}>
                  <div style={{ flex: 1, background: `linear-gradient(135deg, ${accentHex} 0%, ${adjustBrightness(accentHex, -16)} 100%)`, color: "#fff", fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: "4px", padding: "0 12px", boxShadow: `0 6px 16px ${accentHex}55`, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <span>{ctaText ?? front?.cta ?? "Schedule Now"}</span>
                    <span style={{ opacity: 0.75, fontSize: "15px", lineHeight: 1 }}>→</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <PostcardBack dealershipName={dealershipName} customerName={customerName} accent={accent} logoUrl={logoUrl} />
          )}
        </div>
      ) : (
        <div style={{ background: "linear-gradient(145deg, #EAE5DE 0%, #E0D9D0 100%)", padding: "14px 8px 18px", borderRadius: 14 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 560 }}>
              <PrintReadyFrame width={520}>
                <div style={{ transform: "rotate(-0.4deg)", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.22))" }}>
                  {!showBack ? (
                    <div className="w-full rounded-xl border border-slate-200 shadow-xl overflow-hidden" style={{ maxWidth: "520px", background: "#fff" }}>
                      <BoldHeaderBand dealershipName={dealershipName} accent={{ ...accent, header: accentHex, offerBorder: accentHex }} logoUrl={logoUrl} dealershipPhone={undefined} />
                      <div style={{ position: "relative" }}>
                        <VehiclePhotoZone heroBg={heroBg} height="210px" showLabel={false} imageUrl={vehiclePhotoUrl} />
                        {offer && <OfferBadge offer={offer} accent={{ ...accent, header: accentHex, offerBorder: accentHex, offerBg: accent.offerBg, offerText: accent.offerText, letterBorder: accent.letterBorder, highlightGlow: accent.highlightGlow, isHighlight: accent.isHighlight }} />}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "52px 16px 13px", background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)", pointerEvents: "none" }}>
                          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "30px", color: "#fff", lineHeight: 1.04, letterSpacing: "-0.030em", textShadow: "0 3px 14px rgba(0,0,0,0.72)" }}>{resolvedHeadline}</div>
                          <div style={{ width: "32px", height: "3px", background: accentHex, borderRadius: "2px", marginTop: "8px", boxShadow: `0 0 8px ${accentHex}` }} />
                        </div>
                      </div>
                      {urgencyLine && (
                        <div style={{
                          background: adjustBrightness(accentHex, -18),
                          borderLeft: "5px solid rgba(255,255,255,0.65)",
                          padding: "8px 18px", display: "flex", alignItems: "center", gap: "6px",
                        }}>
                          <span style={{ fontSize: "11px" }}>⚡</span>
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", flex: 1 }}>{urgencyLine}</span>
                          <div style={{ background: "rgba(255,255,255,0.20)", borderRadius: "3px", padding: "2px 7px", fontFamily: "'Inter', sans-serif", fontSize: "6px", fontWeight: 900, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>ACT NOW →</div>
                        </div>
                      )}
                      {/* Offer banner — above body copy */}
                      {offer && (
                        <OfferCallout offer={offer} accent={{ ...accent, header: accentHex, offerBorder: accentHex, offerBg: accent.offerBg, offerText: accent.offerText, letterBorder: accent.letterBorder, highlightGlow: accent.highlightGlow, isHighlight: accent.isHighlight }} expiresText={expiresText ?? undefined} conditionsText={conditionsText ?? undefined} />
                      )}
                      {/* Body copy — clean campaign sans-serif */}
                      <div style={{ padding: "11px 18px 9px" }}>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: 1.72, color: "#374151", margin: 0, fontWeight: 400 }}>
                          {(() => { const max = offer ? 90 : 150; return content.length > max ? content.slice(0, max - 3) + "…" : content; })()}
                        </p>
                      </div>
                      {/* Action row: QR + CTA */}
                      <div style={{ padding: "10px 18px 16px", display: "flex", gap: "10px", alignItems: "stretch" }}>
                        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                          <div style={{ background: "white", border: `2.5px solid ${accentHex}`, borderRadius: "8px", padding: "4px", boxShadow: `0 3px 10px ${accentHex}33` }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrPreviewUrl} alt="QR" width={64} height={64} style={{ display: "block", borderRadius: "4px" }} />
                          </div>
                          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "5px", fontWeight: 900, color: accentHex, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>SCAN TO<br />BOOK</div>
                        </div>
                        <div style={{ flex: 1, display: "flex" }}>
                          <div style={{ flex: 1, background: `linear-gradient(135deg, ${accentHex} 0%, ${adjustBrightness(accentHex, -16)} 100%)`, color: "#fff", fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: "4px", padding: "0 12px", boxShadow: `0 6px 16px ${accentHex}55`, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <span>{ctaText ?? front?.cta ?? "Schedule Now"}</span>
                            <span style={{ opacity: 0.75, fontSize: "15px", lineHeight: 1 }}>→</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <RealPostcardBack
                      dealershipName={dealershipName} customerName={customerName} logoUrl={logoUrl}
                      accent={accent} content={content}
                    />
                  )}
                </div>
              </PrintReadyFrame>
            </div>
          </div>
        </div>
      )}
      <div className="text-center">
        <span className="chip chip-slate text-[10px]">Multi-Panel · Vehicle hero + personalized message + coupon</span>
      </div>
    </div>
  );
}

// ── Premium Fluorescent Preview ───────────────────────────────

function PremiumFluorescentPreview({
  content, dealershipName, customerName, offer, qrPreviewUrl, logoUrl, layoutSpec, vehiclePhotoUrl,
  headline: headlineProp, subHeadline, ctaText, urgencyLine, expiresText, conditionsText,
}: {
  content: string; dealershipName: string; customerName?: string; offer?: string | null;
  qrPreviewUrl: string; logoUrl?: string | null; layoutSpec?: LayoutSpec; vehiclePhotoUrl?: string | null;
  headline?: string | null; subHeadline?: string | null; ctaText?: string | null; urgencyLine?: string | null;
  expiresText?: string | null; conditionsText?: string | null;
}) {
  const [showBack, setShowBack] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("realistic");
  const front = layoutSpec?.panels?.find((p) => p.role === "front") ?? layoutSpec?.panels?.[0];
  const cs = layoutSpec?.colorScheme;
  const bg = cs?.background ?? "#0F172A";
  const accentCol = cs?.accent ?? "#FFE500";
  const textCol = cs?.text ?? "#F1F5F9";
  const isNeon = cs?.accentIsNeon !== false;
  const resolvedHeadline = headlineProp ?? front?.headline ?? "We've saved a spot for you.";
  const resolvedSubheadline = subHeadline ?? front?.subheadline;
  const offerDollarMatch = offer?.match(/\$(\d+(?:\.\d{2})?)/);
  const offerSavingsAmount = offerDollarMatch ? offerDollarMatch[1].replace(/\.00$/, "") : null;
  const offerIsFree = offer ? /free/i.test(offer) : false;

  const backAccent: AccentConfig = {
    header: accentCol, offerBg: `${accentCol}22`, offerBorder: accentCol,
    offerText: bg, letterBorder: `2px solid ${accentCol}`, highlightGlow: "", isHighlight: true,
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <ModeToggle mode={previewMode} onChange={setPreviewMode} />
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {["Front", "Back (Mailing Side)"].map((label, i) => (
          <button key={label} onClick={() => setShowBack(i === 1)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
              showBack === (i === 1) ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:border-slate-300"
            }`}>{label}</button>
        ))}
      </div>
      {previewMode === "design" ? (
        <div className="flex justify-center">
          {!showBack ? (
            <div className="w-full rounded-xl shadow-xl overflow-hidden" style={{ maxWidth: "420px", background: bg, position: "relative" }}>
              {/* Hero — photo with headline overlaid at bottom */}
              <div style={{ position: "relative" }}>
                <VehiclePhotoZone heroBg={bg} height="188px" showLabel={false} imageUrl={vehiclePhotoUrl} />
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "5px", background: accentCol }} />
                <div style={{ position: "absolute", top: "12px", left: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={dealershipName}
                      style={{ height: "14px", width: "auto", maxWidth: "50px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <span style={{ fontSize: "8px", fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: accentCol, fontFamily: "'Inter', sans-serif" }}>{dealershipName}</span>
                </div>
                {/* Dominant headline overlaid at bottom of hero */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "48px 16px 12px", background: `linear-gradient(to top, ${bg} 0%, ${bg}d0 38%, transparent 100%)`, pointerEvents: "none" }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "24px", color: textCol, lineHeight: 1.07, letterSpacing: "-0.025em", textShadow: "0 2px 12px rgba(0,0,0,0.65)" }}>{resolvedHeadline}</div>
                  {resolvedSubheadline && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: `${textCol}cc`, lineHeight: 1.35, marginTop: "5px", fontWeight: 500 }}>{resolvedSubheadline}</div>}
                </div>
              </div>
              {/* Urgency strip — solid accent band */}
              {urgencyLine && (
                <div style={{
                  background: accentCol, padding: "6px 18px",
                  borderLeft: "5px solid rgba(0,0,0,0.20)",
                  display: "flex", alignItems: "center", gap: "7px",
                }}>
                  <span style={{ fontSize: "10px" }}>⚡</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, color: isNeon ? "#000" : bg, letterSpacing: "0.06em", textTransform: "uppercase" }}>{urgencyLine}</span>
                </div>
              )}
              {/* Content area */}
              <div style={{ padding: "12px 18px 18px" }}>
                <div style={{ width: "40px", height: "3px", background: accentCol, borderRadius: "2px", marginBottom: "11px" }} />
                {/* Offer block — dominant, above body copy */}
                {offer && (
                  <div style={{ background: `${accentCol}1a`, border: `2px solid ${accentCol}`, borderRadius: "6px", padding: "10px 14px", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: expiresText || conditionsText ? "6px" : 0 }}>
                      {offerSavingsAmount ? (
                        <div style={{ background: accentCol, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontSize: "24px", fontWeight: 900, padding: "5px 10px", borderRadius: "4px", lineHeight: 1, flexShrink: 0 }}>${offerSavingsAmount}</div>
                      ) : offerIsFree ? (
                        <div style={{ background: accentCol, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontSize: "16px", fontWeight: 900, padding: "5px 10px", borderRadius: "4px", lineHeight: 1, flexShrink: 0 }}>FREE</div>
                      ) : (
                        <div style={{ background: accentCol, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, padding: "4px 10px", borderRadius: "3px", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>★ OFFER</div>
                      )}
                      <div>
                        {offerSavingsAmount && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", fontWeight: 900, color: accentCol, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: "2px" }}>★ EXCLUSIVE SAVINGS</div>}
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 800, color: textCol, lineHeight: 1.25 }}>{offer}</span>
                      </div>
                    </div>
                    {expiresText && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7.5px", color: accentCol, fontWeight: 700, letterSpacing: "0.04em" }}>🕐 {expiresText}</div>}
                    {conditionsText && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "6px", color: `${textCol}44`, marginTop: "2px", letterSpacing: "0.03em" }}>{conditionsText}</div>}
                  </div>
                )}
                {/* Body copy — clean campaign sans-serif */}
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: 1.72, color: textCol, margin: 0, fontWeight: 400, opacity: 0.82 }}>
                    {(() => { const max = offer ? 90 : 150; return content.length > max ? content.slice(0, max - 3) + "…" : content; })()}
                  </p>
                </div>
                {/* Action row: CTA (flex) + QR (fixed) */}
                <div style={{ display: "flex", gap: "10px", alignItems: "stretch" }}>
                  <div style={{ flex: 1, background: accentCol, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "13px", padding: "12px 14px", borderRadius: "4px", letterSpacing: "0.05em", textTransform: "uppercase", boxShadow: `0 6px 18px ${accentCol}66`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>{ctaText ?? front?.cta ?? "Book Your Appointment"}</span>
                      <span style={{ fontSize: "15px", lineHeight: 1, opacity: 0.75 }}>→</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                    <div style={{ background: "rgba(255,255,255,0.09)", border: `2.5px solid ${accentCol}`, borderRadius: "8px", padding: "4px" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrPreviewUrl} alt="QR" width={64} height={64} style={{ borderRadius: "4px", display: "block" }} />
                    </div>
                    <div style={{ fontSize: "5px", color: accentCol, fontFamily: "'Inter', sans-serif", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>SCAN TO<br />BOOK</div>
                  </div>
                </div>
              </div>
              <div style={{ height: "5px", background: accentCol }} />
            </div>
          ) : (
            <PostcardBack dealershipName={dealershipName} customerName={customerName} accent={backAccent} logoUrl={logoUrl} />
          )}
        </div>
      ) : (
        <div style={{ background: "linear-gradient(145deg, #EAE5DE 0%, #E0D9D0 100%)", padding: "14px 8px 18px", borderRadius: 14 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 560 }}>
              <PrintReadyFrame width={520}>
                <div style={{ transform: "rotate(-0.4deg)", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.22))" }}>
                  {!showBack ? (
                    <div className="w-full rounded-xl shadow-xl overflow-hidden" style={{ maxWidth: "520px", background: bg, position: "relative" }}>
                      {/* Hero — photo with headline overlaid at bottom */}
                      <div style={{ position: "relative" }}>
                        <VehiclePhotoZone heroBg={bg} height="200px" showLabel={false} imageUrl={vehiclePhotoUrl} />
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "5px", background: accentCol }} />
                        <div style={{ position: "absolute", top: "12px", left: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                          {logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt={dealershipName}
                              style={{ height: "14px", width: "auto", maxWidth: "50px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <span style={{ fontSize: "8px", fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: accentCol, fontFamily: "'Inter', sans-serif" }}>{dealershipName}</span>
                        </div>
                        {/* Dominant headline overlaid at bottom of hero */}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "52px 18px 12px", background: `linear-gradient(to top, ${bg} 0%, ${bg}d0 38%, transparent 100%)`, pointerEvents: "none" }}>
                          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "27px", color: textCol, lineHeight: 1.07, letterSpacing: "-0.025em", textShadow: "0 2px 12px rgba(0,0,0,0.65)" }}>{resolvedHeadline}</div>
                          {resolvedSubheadline && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: `${textCol}cc`, lineHeight: 1.35, marginTop: "5px", fontWeight: 500 }}>{resolvedSubheadline}</div>}
                        </div>
                      </div>
                      {/* Urgency strip — solid accent band */}
                      {urgencyLine && (
                        <div style={{
                          background: accentCol, padding: "6px 18px",
                          borderLeft: "5px solid rgba(0,0,0,0.20)",
                          display: "flex", alignItems: "center", gap: "7px",
                        }}>
                          <span style={{ fontSize: "10px" }}>⚡</span>
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, color: isNeon ? "#000" : bg, letterSpacing: "0.06em", textTransform: "uppercase" }}>{urgencyLine}</span>
                        </div>
                      )}
                      {/* Content area */}
                      <div style={{ padding: "12px 18px 18px" }}>
                        <div style={{ width: "40px", height: "3px", background: accentCol, borderRadius: "2px", marginBottom: "11px" }} />
                        {/* Offer block — dominant, above body copy */}
                        {offer && (
                          <div style={{ background: `${accentCol}1a`, border: `2px solid ${accentCol}`, borderRadius: "6px", padding: "10px 14px", marginBottom: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: expiresText || conditionsText ? "6px" : 0 }}>
                              {offerSavingsAmount ? (
                                <div style={{ background: accentCol, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontSize: "26px", fontWeight: 900, padding: "5px 10px", borderRadius: "4px", lineHeight: 1, flexShrink: 0 }}>${offerSavingsAmount}</div>
                              ) : offerIsFree ? (
                                <div style={{ background: accentCol, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontSize: "18px", fontWeight: 900, padding: "5px 10px", borderRadius: "4px", lineHeight: 1, flexShrink: 0 }}>FREE</div>
                              ) : (
                                <div style={{ background: accentCol, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, padding: "4px 10px", borderRadius: "3px", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>★ OFFER</div>
                              )}
                              <div>
                                {offerSavingsAmount && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", fontWeight: 900, color: accentCol, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: "2px" }}>★ EXCLUSIVE SAVINGS</div>}
                                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 800, color: textCol, lineHeight: 1.25 }}>{offer}</span>
                              </div>
                            </div>
                            {expiresText && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7.5px", color: accentCol, fontWeight: 700, letterSpacing: "0.04em" }}>🕐 {expiresText}</div>}
                            {conditionsText && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "6px", color: `${textCol}44`, marginTop: "2px", letterSpacing: "0.03em" }}>{conditionsText}</div>}
                          </div>
                        )}
                        {/* Body copy — clean campaign sans-serif */}
                        <div style={{ marginBottom: "12px" }}>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: 1.72, color: textCol, margin: 0, fontWeight: 400, opacity: 0.82 }}>
                            {(() => { const max = offer ? 90 : 150; return content.length > max ? content.slice(0, max - 3) + "…" : content; })()}
                          </p>
                        </div>
                        {/* Action row: CTA (flex) + QR (fixed) */}
                        <div style={{ display: "flex", gap: "10px", alignItems: "stretch" }}>
                          <div style={{ flex: 1, background: accentCol, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "13px", padding: "12px 14px", borderRadius: "4px", letterSpacing: "0.05em", textTransform: "uppercase", boxShadow: `0 6px 18px ${accentCol}66`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span>{ctaText ?? front?.cta ?? "Book Your Appointment"}</span>
                              <span style={{ fontSize: "15px", lineHeight: 1, opacity: 0.75 }}>→</span>
                            </div>
                          </div>
                          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                            <div style={{ background: "rgba(255,255,255,0.09)", border: `2.5px solid ${accentCol}`, borderRadius: "8px", padding: "4px" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={qrPreviewUrl} alt="QR" width={64} height={64} style={{ borderRadius: "4px", display: "block" }} />
                            </div>
                            <div style={{ fontSize: "5px", color: accentCol, fontFamily: "'Inter', sans-serif", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>SCAN TO<br />BOOK</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ height: "5px", background: accentCol }} />
                    </div>
                  ) : (
                    <RealPostcardBack
                      dealershipName={dealershipName} customerName={customerName} logoUrl={logoUrl}
                      accent={backAccent} content={content}
                    />
                  )}
                </div>
              </PrintReadyFrame>
            </div>
          </div>
        </div>
      )}
      <div className="text-center">
        <span className="chip chip-slate text-[10px]">Premium Fluorescent · {isNeon ? "Neon ink accents" : "Bold graphic design"} · {accentCol}</span>
      </div>
    </div>
  );
}

// ── Complex Fold Preview ──────────────────────────────────────

function ComplexFoldPreview({
  dealershipName, customerName, offer, qrPreviewUrl, logoUrl, layoutSpec, vehiclePhotoUrl,
  content, headline, ctaText, urgencyLine,
}: {
  dealershipName: string; customerName?: string; offer?: string | null;
  qrPreviewUrl: string; logoUrl?: string | null; layoutSpec?: LayoutSpec; vehiclePhotoUrl?: string | null;
  content?: string; headline?: string | null; ctaText?: string | null; urgencyLine?: string | null;
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
        <div className="w-full rounded-xl shadow-xl overflow-hidden" style={{ maxWidth: "420px", minHeight: "300px" }}>
          {activePanel === "cover" && (
            <div style={{ background: bg, minHeight: "300px", position: "relative", overflow: "hidden" }}>
              {/* Hero — taller with headline overlaid at bottom */}
              <div style={{ position: "relative" }}>
                <VehiclePhotoZone heroBg={bg} height="215px" showLabel={false} imageUrl={vehiclePhotoUrl} />
                {/* Logo + dealer name — top left */}
                <div style={{ position: "absolute", top: "12px", left: "18px", display: "flex", alignItems: "center", gap: "7px" }}>
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={dealershipName}
                      style={{ height: "13px", width: "auto", maxWidth: "50px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <span style={{ fontSize: "7px", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, fontFamily: "'Inter', sans-serif" }}>{dealershipName}</span>
                </div>
                {/* Dominant headline overlaid at bottom of photo */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "52px 18px 12px", background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.50) 55%, transparent 100%)", pointerEvents: "none" }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "28px", color: "#fff", lineHeight: 1.04, letterSpacing: "-0.025em", textShadow: "0 3px 14px rgba(0,0,0,0.70)" }}>
                    {headline ?? cover?.headline ?? "We'd love to see you again."}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.72)", lineHeight: 1.4, marginTop: "5px", fontWeight: 400 }}>
                    {cover?.subheadline ?? "A personal note from your service team."}
                  </div>
                </div>
              </div>
              {/* Urgency strip — solid accent band */}
              {urgencyLine && (
                <div style={{
                  background: accent, padding: "6px 22px",
                  borderLeft: "5px solid rgba(0,0,0,0.20)",
                  display: "flex", alignItems: "center", gap: "7px",
                }}>
                  <span style={{ fontSize: "10px" }}>⚡</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, color: isNeon ? "#000" : "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>{urgencyLine}</span>
                </div>
              )}
              {/* Teaser — invites reader to open */}
              <div style={{ padding: "12px 22px 16px" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.70)", fontFamily: "'Inter', sans-serif", fontWeight: 400, lineHeight: 1.55 }}>
                  Open for a personal message and an exclusive offer reserved just for you.
                </div>
              </div>
              <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "8px", background: accent }} />
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
              <HandwrittenContent text={content ?? innerLeft?.body ?? "We appreciate your loyalty and wanted to reach out personally..."} fontSize={15} lineHeight={1.82} />
            </div>
          )}
          {activePanel === "inner-right" && (
            <div style={{ background: "#fff", padding: "20px 22px", minHeight: "300px" }}>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#1e293b", marginBottom: "14px", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
                {innerRight?.headline ?? "Ready when you are."}
              </div>
              {offer && (() => {
                const dm = offer.match(/\$(\d+(?:\.\d{2})?)/);
                const sa = dm ? dm[1].replace(/\.00$/, "") : null;
                const isFr = /free/i.test(offer);
                return (
                  <div style={{ background: `${accent}0d`, border: `2px solid ${accent}`, borderRadius: "6px", padding: "12px 14px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                      {sa ? (
                        <div style={{ background: accent, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontSize: "28px", fontWeight: 900, padding: "6px 10px", borderRadius: "5px", lineHeight: 1, flexShrink: 0 }}>${sa}</div>
                      ) : isFr ? (
                        <div style={{ background: accent, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontSize: "18px", fontWeight: 900, padding: "6px 10px", borderRadius: "5px", lineHeight: 1, flexShrink: 0 }}>FREE</div>
                      ) : (
                        <div style={{ background: accent, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, padding: "4px 10px", borderRadius: "3px", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>★ OFFER</div>
                      )}
                      <div>
                        {sa && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", fontWeight: 900, color: accent, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: "2px" }}>★ EXCLUSIVE SAVINGS</div>}
                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#1e293b", fontFamily: "'Inter', sans-serif", lineHeight: 1.25 }}>{offer}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ background: accent, color: isNeon ? "#000" : "#fff", fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "13px", padding: "13px 16px", borderRadius: "5px", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center", boxShadow: `0 8px 20px ${accent}55`, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span>{ctaText ?? innerRight?.cta ?? "Book Now"}</span>
                  <span style={{ fontSize: "15px", lineHeight: 1, opacity: 0.75 }}>→</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ background: "white", border: `2.5px solid ${accent}`, borderRadius: "7px", padding: "4px", boxShadow: `0 3px 10px ${accent}33` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrPreviewUrl} alt="QR" width={64} height={64} style={{ borderRadius: "4px", display: "block" }} />
                  </div>
                  <div style={{ fontSize: "5.5px", color: accent, marginTop: "4px", textAlign: "center", fontFamily: "'Inter', sans-serif", letterSpacing: "0.10em", fontWeight: 900, textTransform: "uppercase", lineHeight: 1.3 }}>SCAN TO<br />BOOK</div>
                </div>
                <div style={{ fontSize: "9px", color: "#64748b", lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }}>
                  <strong style={{ color: "#1e293b", fontSize: "10px" }}>{dealershipName}</strong><br />
                  <span style={{ fontSize: "8px" }}>We look forward to seeing you.</span>
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

// ── Conquest Front (design mode) ─────────────────────────────

function ConquestFront({
  content, dealershipName, offer, qrPreviewUrl, logoUrl, accent,
  dealershipAddress, dealershipPhone, vehiclePhotoUrl, layoutSpec,
  headline: headlineProp, ctaText, urgencyLine, expiresText, conditionsText,
}: {
  content: string; dealershipName: string; offer?: string | null;
  qrPreviewUrl: string; logoUrl?: string | null; accent: AccentConfig;
  dealershipAddress?: AddressRecord | null; dealershipPhone?: string | null;
  vehiclePhotoUrl?: string | null; layoutSpec?: LayoutSpec;
  headline?: string | null; ctaText?: string | null; urgencyLine?: string | null;
  expiresText?: string | null; conditionsText?: string | null;
}) {
  const front = layoutSpec?.panels?.find((p) => p.role === "front") ?? layoutSpec?.panels?.[0];
  const headline = headlineProp ?? front?.headline ?? "An exclusive offer, just for you.";
  const cta = ctaText ?? front?.cta ?? "Reserve Your Spot";
  const addrLines = addrToLines(dealershipAddress);

  return (
    <div style={{
      width: "100%", background: "#FFFFFF",
      backgroundImage: [PAPER_TEXTURE, "repeating-linear-gradient(transparent, transparent 30px, #EDE8D8 30px, #EDE8D8 31px)"].join(", "),
      backgroundPositionY: "80px",
      borderRadius: "12px", overflow: "hidden",
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 10px 24px -4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
    }}>
      {/* Dealer identity bar — always at top */}
      <BoldHeaderBand dealershipName={dealershipName} accent={accent} logoUrl={logoUrl} dealershipPhone={dealershipPhone} />
      <div style={{ position: "relative" }}>
        <VehiclePhotoZone heroBg={accent.header} height="162px" imageUrl={vehiclePhotoUrl} showLabel={false} />
        {offer && <OfferBadge offer={offer} accent={accent} />}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "44px 16px 13px", background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)", pointerEvents: "none" }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "5.5px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.80)", marginBottom: "5px" }}>EXCLUSIVE OFFER · {dealershipName}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "28px", color: "#fff", lineHeight: 1.04, letterSpacing: "-0.030em", textShadow: "0 3px 14px rgba(0,0,0,0.72)" }}>{headline}</div>
          <div style={{ width: "28px", height: "3px", background: accent.header, borderRadius: "2px", marginTop: "7px", boxShadow: `0 0 8px ${accent.header}` }} />
        </div>
      </div>
      {urgencyLine && (
        <div style={{
          background: adjustBrightness(accent.header, -18),
          borderLeft: "5px solid rgba(255,255,255,0.65)",
          padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px",
        }}>
          <span style={{ fontSize: "11px" }}>⚡</span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", flex: 1 }}>{urgencyLine}</span>
          <div style={{ background: "rgba(255,255,255,0.20)", borderRadius: "3px", padding: "2px 7px", fontFamily: "'Inter', sans-serif", fontSize: "6px", fontWeight: 900, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>ACT NOW →</div>
        </div>
      )}
      {/* Offer banner — dominant accent block (above body copy) */}
      {offer && (
        <OfferCallout offer={offer} accent={accent} expiresText={expiresText ?? undefined} conditionsText={conditionsText ?? undefined} />
      )}
      {/* Body copy — clean campaign sans-serif */}
      <div style={{ padding: "10px 16px 9px" }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: 1.72, color: "#374151", margin: 0, fontWeight: 400 }}>
          {(() => { const max = offer ? 90 : 150; return content.length > max ? content.slice(0, max - 3) + "…" : content; })()}
        </p>
      </div>
      {/* Action row: QR + CTA */}
      <div style={{ padding: "10px 16px 12px", display: "flex", gap: "10px", alignItems: "stretch" }}>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
          <div style={{ background: "white", border: `2.5px solid ${accent.header}`, borderRadius: "8px", padding: "4px", boxShadow: `0 3px 10px ${accent.header}33` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrPreviewUrl} alt="Scan to view offer" width={64} height={64} style={{ display: "block", borderRadius: "4px" }} />
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "5px", fontWeight: 900, color: accent.header, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>SCAN TO<br />VIEW OFFER</div>
        </div>
        <div style={{ flex: 1, display: "flex" }}>
          <div style={{ flex: 1, background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -16)} 100%)`, color: "white", fontFamily: "'Inter', sans-serif", fontWeight: 900, borderRadius: "4px", padding: "0 12px", boxShadow: `0 6px 16px ${accent.header}55`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
            <div style={{ fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{cta}</span>
              <span style={{ opacity: 0.75, fontSize: "15px", lineHeight: 1 }}>→</span>
            </div>
            {dealershipPhone && (
              <div style={{ fontSize: "9.5px", fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.03em" }}>{dealershipPhone}</div>
            )}
          </div>
        </div>
      </div>
      {(addrLines.line1 || addrLines.line2) && (
        <div style={{ padding: "5px 16px", borderTop: "1px solid #EDE8D8", background: "rgba(254,252,243,0.97)", display: "flex", alignItems: "center", gap: "6px" }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={dealershipName} style={{ height: "12px", width: "auto", maxWidth: "40px", objectFit: "contain", flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", color: "#6B7280" }}>
            <strong>{dealershipName}</strong>{addrLines.line1 ? ` · ${addrLines.line1}${addrLines.line2 ? `, ${addrLines.line2}` : ""}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Realistic Conquest Front (print-ready) ────────────────────

function RealConquestFront({
  content, dealershipName, offer, qrPreviewUrl, logoUrl, accent,
  dealershipAddress, dealershipPhone, vehiclePhotoUrl, layoutSpec,
  headline: headlineProp, ctaText, urgencyLine, expiresText, conditionsText,
}: {
  content: string; dealershipName: string; offer?: string | null;
  qrPreviewUrl: string; logoUrl?: string | null; accent: AccentConfig;
  dealershipAddress?: AddressRecord | null; dealershipPhone?: string | null;
  vehiclePhotoUrl?: string | null; layoutSpec?: LayoutSpec;
  headline?: string | null; ctaText?: string | null; urgencyLine?: string | null;
  expiresText?: string | null; conditionsText?: string | null;
}) {
  const front = layoutSpec?.panels?.find((p) => p.role === "front") ?? layoutSpec?.panels?.[0];
  const headline = headlineProp ?? front?.headline ?? "An exclusive offer, just for you.";
  const cta = ctaText ?? front?.cta ?? "Reserve Your Spot";
  const addrLines = addrToLines(dealershipAddress);

  return (
    <div style={{
      maxWidth: "520px", background: "#FFFFFF",
      backgroundImage: [
        PAPER_TEXTURE,
        "repeating-linear-gradient(89.4deg, transparent, transparent 4px, rgba(155,135,100,0.012) 4px, rgba(155,135,100,0.012) 5px)",
        "repeating-linear-gradient(90.6deg, transparent, transparent 7px, rgba(155,135,100,0.008) 7px, rgba(155,135,100,0.008) 8px)",
      ].join(", "),
      borderRadius: "6px", overflow: "hidden",
      boxShadow: "0 2px 4px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.20), 0 0 0 1px rgba(0,0,0,0.05)",
      width: "100%", display: "flex", flexDirection: "column",
    }}>
      {/* Dealer identity bar — always at top */}
      <BoldHeaderBand dealershipName={dealershipName} accent={accent} logoUrl={logoUrl} dealershipPhone={dealershipPhone} />
      <div style={{ position: "relative" }}>
        <VehiclePhotoZone heroBg={accent.header} height="190px" imageUrl={vehiclePhotoUrl} showLabel={false} />
        {offer && <OfferBadge offer={offer} accent={accent} />}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "50px 14px 13px", background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.58) 55%, transparent 100%)", pointerEvents: "none" }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "5.5px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.82)", marginBottom: "5px" }}>EXCLUSIVE OFFER · {dealershipName}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: "30px", color: "#fff", lineHeight: 1.03, letterSpacing: "-0.032em", textShadow: "0 3px 16px rgba(0,0,0,0.76)" }}>{headline}</div>
          <div style={{ width: "28px", height: "3px", background: accent.header, borderRadius: "2px", marginTop: "8px", boxShadow: `0 0 8px ${accent.header}` }} />
        </div>
      </div>
      {urgencyLine && (
        <div style={{
          background: adjustBrightness(accent.header, -18),
          borderLeft: "5px solid rgba(255,255,255,0.65)",
          padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px",
        }}>
          <span style={{ fontSize: "11px" }}>⚡</span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", fontWeight: 900, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", flex: 1 }}>{urgencyLine}</span>
          <div style={{ background: "rgba(255,255,255,0.20)", borderRadius: "3px", padding: "2px 7px", fontFamily: "'Inter', sans-serif", fontSize: "6px", fontWeight: 900, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>ACT NOW →</div>
        </div>
      )}
      {/* Offer banner — dominant accent block (above body copy) */}
      {offer && (
        <OfferCallout offer={offer} accent={accent} expiresText={expiresText ?? undefined} conditionsText={conditionsText ?? undefined} />
      )}
      {/* Body copy — clean campaign sans-serif */}
      <div style={{ padding: "10px 14px 9px" }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: 1.72, color: "#374151", margin: 0, fontWeight: 400 }}>
          {(() => { const max = offer ? 90 : 150; return content.length > max ? content.slice(0, max - 3) + "…" : content; })()}
        </p>
      </div>
      {/* Action row: QR + CTA */}
      <div style={{ padding: "10px 14px 12px", display: "flex", gap: "10px", alignItems: "stretch" }}>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
          <div style={{ background: "white", border: `2.5px solid ${accent.header}`, borderRadius: "8px", padding: "4px", boxShadow: `0 3px 10px ${accent.header}33` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrPreviewUrl} alt="Scan to view offer" width={64} height={64} style={{ display: "block", borderRadius: "4px" }} />
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "5px", fontWeight: 900, color: accent.header, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>SCAN TO<br />VIEW OFFER</div>
        </div>
        <div style={{ flex: 1, display: "flex" }}>
          <div style={{ flex: 1, background: `linear-gradient(135deg, ${accent.header} 0%, ${adjustBrightness(accent.header, -16)} 100%)`, color: "white", fontFamily: "'Inter', sans-serif", fontWeight: 900, borderRadius: "4px", padding: "0 12px", boxShadow: `0 6px 16px ${accent.header}55`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
            <div style={{ fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{cta}</span>
              <span style={{ opacity: 0.75, fontSize: "15px", lineHeight: 1 }}>→</span>
            </div>
            {dealershipPhone && (
              <div style={{ fontSize: "9.5px", fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.03em" }}>{dealershipPhone}</div>
            )}
          </div>
        </div>
      </div>
      {(addrLines.line1 || addrLines.line2) && (
        <div style={{ padding: "5px 14px", borderTop: "1px solid #EDE8D8", background: "rgba(254,252,243,0.97)", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={accent.header} strokeWidth="2" style={{ width: "12px", height: "12px", flexShrink: 0 }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "7px", color: "#6B7280", lineHeight: 1.4 }}>
            {addrLines.line1}{addrLines.line2 ? ` · ${addrLines.line2}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Conquest Postcard Preview ─────────────────────────────────

function ConquestPostcardPreview({
  content, dealershipName, customerName, offer, qrPreviewUrl, logoUrl, accent,
  customerAddress, dealershipAddress, dealershipPhone, vehiclePhotoUrl, layoutSpec,
  headline, ctaText, urgencyLine, expiresText, conditionsText,
}: {
  content: string; dealershipName: string; customerName?: string; offer?: string | null;
  qrPreviewUrl: string; logoUrl?: string | null; accent: AccentConfig;
  customerAddress?: AddressRecord | null; dealershipAddress?: AddressRecord | null;
  dealershipPhone?: string | null; vehiclePhotoUrl?: string | null; layoutSpec?: LayoutSpec;
  headline?: string | null; ctaText?: string | null; urgencyLine?: string | null;
  expiresText?: string | null; conditionsText?: string | null;
}) {
  const [showBack, setShowBack] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("realistic");

  return (
    <div className="space-y-2.5">
      <div className="flex justify-center">
        <ModeToggle mode={previewMode} onChange={setPreviewMode} />
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {(["Front", "Back (Mailing Side)"] as const).map((label, i) => (
          <button key={label} onClick={() => setShowBack(i === 1)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
              showBack === (i === 1) ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:border-slate-300"
            }`}>{label}</button>
        ))}
      </div>
      {previewMode === "design" ? (
        <div className="relative flex justify-center">
          <div className="absolute -bottom-1.5 rounded-b-xl blur-sm -z-10" style={{ left: "16px", right: "16px", height: "14px", background: "rgba(15,23,42,0.10)" }} />
          {!showBack ? (
            <div style={{ width: "100%", maxWidth: "420px" }}>
              <ConquestFront
                content={content} dealershipName={dealershipName} offer={offer}
                qrPreviewUrl={qrPreviewUrl} logoUrl={logoUrl} accent={accent}
                dealershipAddress={dealershipAddress} dealershipPhone={dealershipPhone}
                vehiclePhotoUrl={vehiclePhotoUrl} layoutSpec={layoutSpec}
                headline={headline} ctaText={ctaText} urgencyLine={urgencyLine}
                expiresText={expiresText} conditionsText={conditionsText}
              />
            </div>
          ) : (
            <PostcardBack dealershipName={dealershipName} customerName={customerName} accent={accent} logoUrl={logoUrl} customerAddress={customerAddress} dealershipAddress={dealershipAddress} />
          )}
        </div>
      ) : (
        <div style={{ background: "linear-gradient(145deg, #EAE5DE 0%, #E0D9D0 100%)", padding: "14px 8px 18px", borderRadius: 14 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 560 }}>
              <PrintReadyFrame width={520}>
                <div style={{ transform: "rotate(-0.4deg)", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.22))" }}>
                  {!showBack ? (
                    <RealConquestFront
                      content={content} dealershipName={dealershipName} offer={offer}
                      qrPreviewUrl={qrPreviewUrl} logoUrl={logoUrl} accent={accent}
                      dealershipAddress={dealershipAddress} dealershipPhone={dealershipPhone}
                      vehiclePhotoUrl={vehiclePhotoUrl} layoutSpec={layoutSpec}
                      headline={headline} ctaText={ctaText} urgencyLine={urgencyLine}
                      expiresText={expiresText} conditionsText={conditionsText}
                    />
                  ) : (
                    <RealPostcardBack
                      dealershipName={dealershipName} customerName={customerName} logoUrl={logoUrl}
                      accent={accent} dealershipAddress={dealershipAddress}
                      dealershipPhone={dealershipPhone} customerAddress={customerAddress}
                      content={content}
                    />
                  )}
                </div>
              </PrintReadyFrame>
            </div>
          </div>
          {customerName && (
            <p className="text-center mt-2" style={{ fontSize: 9, color: "#9B8E83", fontFamily: "'Inter', sans-serif" }}>
              Will be mailed to: <strong style={{ color: "#6B5E54" }}>{customerName}</strong>
              {customerAddress?.street ? ` · ${customerAddress.street}, ${[customerAddress.city, customerAddress.state].filter(Boolean).join(", ")}` : ""}
            </p>
          )}
        </div>
      )}
      <div className="text-center">
        <span className="chip chip-slate text-[10px]">
          {previewMode === "realistic"
            ? (showBack ? "✦ Mailing side · USPS First Class · PostGrid" : "✦ Conquest Front · Clean minimalist · Printed by PostGrid")
            : (showBack ? "↑ Mailing side · Address + USPS indicia" : "↑ Conquest · Clean design for new customer acquisition")}
        </span>
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
  headline?: string | null;
  qrPreviewUrl?: string;
  logoUrl?: string | null;
  accentColor?: AccentColor;
  designStyle?: DesignStyle;
  layoutSpec?: LayoutSpec;
  vehiclePhotoUrl?: string | null;
  customerAddress?: { street?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
  dealershipAddress?: { street?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
  dealershipPhone?: string | null;
  initialMode?: PreviewMode;
  subHeadline?: string | null;
  ctaText?: string | null;
  urgencyLine?: string | null;
  expiresText?: string | null;
  conditionsText?: string | null;
}

export function TemplatePreview({
  templateType,
  content,
  dealershipName,
  customerName,
  offer,
  headline,
  qrPreviewUrl: qrPropUrl,
  logoUrl,
  accentColor = "indigo",
  designStyle = "standard",
  layoutSpec,
  vehiclePhotoUrl,
  customerAddress,
  dealershipAddress,
  dealershipPhone,
  initialMode,
  subHeadline,
  ctaText,
  urgencyLine,
  expiresText,
  conditionsText,
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
            content={content} dealershipName={dealershipName} customerName={customerName}
            offer={offer} qrPreviewUrl={qrUrl} logoUrl={logoUrl}
            layoutSpec={layoutSpec} accent={accent} vehiclePhotoUrl={vehiclePhotoUrl}
            headline={headline} ctaText={ctaText} urgencyLine={urgencyLine}
            expiresText={expiresText} conditionsText={conditionsText}
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
            content={content} dealershipName={dealershipName} customerName={customerName}
            offer={offer} qrPreviewUrl={qrUrl} logoUrl={logoUrl}
            layoutSpec={layoutSpec} vehiclePhotoUrl={vehiclePhotoUrl}
            headline={headline} subHeadline={subHeadline} ctaText={ctaText} urgencyLine={urgencyLine}
            expiresText={expiresText} conditionsText={conditionsText}
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
            dealershipName={dealershipName} customerName={customerName} offer={offer}
            qrPreviewUrl={qrUrl} logoUrl={logoUrl} layoutSpec={layoutSpec}
            vehiclePhotoUrl={vehiclePhotoUrl}
            content={content} headline={headline} ctaText={ctaText} urgencyLine={urgencyLine}
          />
        </div>
      </div>
    );
  }

  if (designStyle === "conquest") {
    return (
      <div className="flex justify-center">
        <div className="w-full" style={{ maxWidth: "420px" }}>
          <ConquestPostcardPreview
            content={content} dealershipName={dealershipName} customerName={customerName}
            offer={offer} qrPreviewUrl={qrUrl} logoUrl={logoUrl} accent={accent}
            customerAddress={customerAddress} dealershipAddress={dealershipAddress}
            dealershipPhone={dealershipPhone} vehiclePhotoUrl={vehiclePhotoUrl}
            layoutSpec={layoutSpec}
            headline={headline} ctaText={ctaText} urgencyLine={urgencyLine}
            expiresText={expiresText} conditionsText={conditionsText}
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
            content={content} dealershipName={dealershipName} customerName={customerName}
            offer={offer} headline={headline} qrPreviewUrl={qrUrl} logoUrl={logoUrl} accent={accent}
            customerAddress={customerAddress} dealershipAddress={dealershipAddress}
            dealershipPhone={dealershipPhone} vehiclePhotoUrl={vehiclePhotoUrl}
            initialMode={initialMode}
            subHeadline={subHeadline} ctaText={ctaText} urgencyLine={urgencyLine}
            expiresText={expiresText} conditionsText={conditionsText}
          />
        </div>
      ) : (
        <LetterPreview
          content={content} dealershipName={dealershipName} templateType={templateType}
          logoUrl={logoUrl} accent={accent} customerName={customerName}
          customerAddress={customerAddress} dealershipAddress={dealershipAddress}
          dealershipPhone={dealershipPhone} initialMode={initialMode}
          offer={offer} headline={headline} ctaText={ctaText}
          expiresText={expiresText} conditionsText={conditionsText}
        />
      )}
    </div>
  );
}
