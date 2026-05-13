"use client";

import { useState } from "react";
import { RefreshCw, Printer, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import type { AccentColor } from "./template-preview";

// ── Sample messages ───────────────────────────────────────────

const SAMPLE_MESSAGES = [
  {
    recipient: "James Chen",
    address: "4821 Oak Creek Dr",
    cityStateZip: "Scottsdale, AZ 85254",
    body: `James,\n\nYour 2021 Tacoma is coming up on its 30,000-mile service. I wanted to reach out personally — we have a $30 coupon just for you, good any Tuesday or Wednesday this month.\n\nWould love to see you back in. Just give us a call or book online anytime.\n\nWarmly,\nMike`,
    vehicle: "2021 Toyota Tacoma",
    advisor: "Mike",
    offer: "$30 off service · Good Tue/Wed only",
  },
  {
    recipient: "Sarah Martinez",
    address: "711 Mesa View Ln",
    cityStateZip: "Tempe, AZ 85281",
    body: `Sarah,\n\nIt's been a while since we serviced your Pilot — I hope it's treating you well!\n\nWe're running a complimentary multi-point inspection this month, no strings attached. I'd love to get you back in before summer heat sets in.\n\nJust call or book online — takes two minutes.\n\nBest,\nTom`,
    vehicle: "2019 Honda Pilot",
    advisor: "Tom",
    offer: "Free multi-point inspection · No purchase required",
  },
  {
    recipient: "Robert & Linda Walsh",
    address: "2200 Sunrise Blvd",
    cityStateZip: "Gilbert, AZ 85234",
    body: `Robert & Linda,\n\nThank you for being such loyal customers over the years. It truly means a lot to our whole team.\n\nWe're holding a VIP appreciation event next Saturday — free coffee, complimentary tire rotation, and a first look at the new lineup.\n\nWe'd love to see you there.\n\nWarmly,\nThe Sunrise Team`,
    vehicle: "Multiple vehicles",
    advisor: "The Sunrise Team",
    offer: "VIP Appreciation Event · Saturday, 10am–2pm",
  },
];

// Two-layer paper fiber texture — anisotropic coarse fiber + fine grain
const PAPER_TEXTURE = [
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='pf'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.62%200.88' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23pf)' opacity='0.052'/%3E%3C/svg%3E")`,
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='pg'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23pg)' opacity='0.024'/%3E%3C/svg%3E")`,
].join(", ");

// ── Accent color system (local to preview demo) ───────────────

const ACCENT_META: Record<AccentColor, {
  label: string;
  offerBg: string;
  offerBorder: string;
  offerText: string;
  swatch: string;
  isHighlight: boolean;
  liftBadge?: string;
}> = {
  indigo: {
    label: "Indigo",
    offerBg: "#EEF2FF",
    offerBorder: "#6366F1",
    offerText: "#3730A3",
    swatch: "#6366F1",
    isHighlight: false,
  },
  yellow: {
    label: "Yellow",
    offerBg: "#FEF08A",
    offerBorder: "#CA8A04",
    offerText: "#713F12",
    swatch: "#EAB308",
    isHighlight: true,
    liftBadge: "+33% callbacks",
  },
  orange: {
    label: "Orange",
    offerBg: "#FED7AA",
    offerBorder: "#EA580C",
    offerText: "#7C2D12",
    swatch: "#F97316",
    isHighlight: true,
    liftBadge: "+28% callbacks",
  },
  pink: {
    label: "Pink",
    offerBg: "#FBCFE8",
    offerBorder: "#DB2777",
    offerText: "#831843",
    swatch: "#EC4899",
    isHighlight: true,
    liftBadge: "+22% callbacks",
  },
  green: {
    label: "Green",
    offerBg: "#BBF7D0",
    offerBorder: "#16A34A",
    offerText: "#14532D",
    swatch: "#22C55E",
    isHighlight: false,
  },
};

// ── Handwriting engine — 3-scale, prime-length arrays ─────────
// Different prime lengths (19 / 17 / 23) prevent visual periodicity
// across the line × word × character axes.

// Line-level (19 elements)
const L_DRIFT = [-1.0,-0.5,0.0,0.5,-0.8,-0.2,0.6,-0.6,0.3,-0.7,0.7,-0.3,0.9,-0.1,0.5,-0.8,0.2,-0.5,0.8] as const;

// Word-level (17 elements)
const W_DRIFT_Y = [-1.9,-1.2,-0.5,-0.1,0.2,0.7,1.2,1.8,-1.4,-0.7,-0.2,0.4,1.4,-0.9,0.9,-1.6,0.7] as const;
const W_LEAN    = [-0.55,-0.25,-0.1,0.0,0.1,0.25,0.48,-0.42,0.15,-0.15,0.35,-0.35,0.2,-0.2,0.32,-0.32,0.12] as const;

// Character-level (23 elements)
const C_ROT  = [-3.2,-2.4,-1.7,-1.0,-0.5,-0.2,0.1,0.5,0.9,1.6,2.3,3.0,-2.8,-1.8,-0.7,0.7,1.8,2.7,-1.1,-0.3,0.3,1.1,-2.0] as const;
const C_TY   = [-2.3,-1.7,-1.0,-0.5,-0.15,0.2,0.6,1.0,1.5,2.1,-1.9,-1.3,-0.6,0.0,0.5,1.0,1.4,-1.5,-0.8,0.3,-0.4,1.2,-0.9] as const;
// Wider pressure range (0.44–1.00) — more dramatic feathering on lifted strokes
const C_PRES = [0.44,0.54,0.63,0.73,0.82,0.88,0.93,0.97,1.00,0.99,0.95,0.90,0.84,0.77,0.70,0.64,0.92,0.85,0.75,0.80,0.88,0.67,0.96] as const;
const C_SX   = [0.93,0.95,0.97,0.98,0.99,1.00,1.01,1.02,1.03,0.96,0.98,1.00,1.02,0.94,0.99,1.01,0.97,1.03,0.95,1.00,0.98,1.02,0.96] as const;
const C_SY   = [0.95,0.97,0.98,0.99,1.00,1.01,1.02,0.96,0.98,1.01,0.97,0.99,1.01,0.95,1.00,0.98,1.02,0.97,0.99,1.00,0.96,1.03,0.98] as const;
// Wider opacity range (0.52–1.00) for more pronounced light/heavy stroke contrast
const C_OPQ  = [0.52,0.60,0.68,0.76,0.83,0.89,0.93,0.97,1.00,0.98,0.94,0.89,0.83,0.76,0.69,0.63,0.92,0.85,0.74,0.80,0.88,0.67,0.96] as const;
const C_SPC  = [-0.5,-0.3,-0.2,-0.1,0.0,0.1,0.2,0.3,-0.4,0.15,-0.15,0.25,-0.25,0.05,-0.05,0.2,-0.1,0.0,0.15,-0.2,0.3,-0.35,0.08] as const;

type LookupArr = readonly number[];
function pick(arr: LookupArr, n: number): number {
  return arr[((n % arr.length) + arr.length) % arr.length];
}

function hseed(charOff: number, code: number, li: number, pi: number): number {
  return (charOff * 31 + code * 17 + li * 7 + pi * 3) | 0;
}

// 6-layer ink shadow: nonlinear pressure + per-character jitter + pooling
function inkShadow(pressure: number, seed = 0): string {
  const jx = (((seed * 7919 + 13) & 0xff) / 255 - 0.5) * 0.18;
  const jy = (((seed * 6271 + 17) & 0xff) / 255 - 0.5) * 0.13;
  const jp = ((seed * 5003 + 23) & 0xff) / 255;
  const bleedRadius = (0.55 - 0.28 * pressure).toFixed(2);
  const sharpRadius = (0.18 + 0.22 * pressure).toFixed(2);
  const a1 = (pressure * pressure * 0.28).toFixed(3);
  const a2 = (pressure * 0.14 + (1 - pressure) * 0.09).toFixed(3);
  const a3 = ((1 - pressure) * 0.13 + pressure * 0.06).toFixed(3);
  const a4 = (pressure * 0.09).toFixed(3);
  const a5 = ((1 - pressure) * 0.09).toFixed(3);
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

function buildLayout(text: string): ParaInfo[] {
  let gci = 0;
  return text.split(/\n\n+/).map((para, pi) => {
    const lines: LineInfo[] = para.split("\n").map((line, li) => {
      const info = { text: line, charOffset: gci, lineIdx: li, paraIdx: pi };
      gci += line.length + 1;
      return info;
    });
    gci += 2;
    return { lines, paraIdx: pi };
  });
}

function HandwrittenWord({ text, wordIdx, lineIdx, paraIdx, startCharOffset }: {
  text: string;
  wordIdx: number;
  lineIdx: number;
  paraIdx: number;
  startCharOffset: number;
}) {
  const ws = (wordIdx * 7 + lineIdx * 11 + paraIdx * 3) | 0;
  const wordDriftY = pick(W_DRIFT_Y, ws);
  const wordLean   = pick(W_LEAN, ws + 5);
  return (
    <span style={{ display: "inline-block", transform: `translateY(${wordDriftY}px) rotate(${wordLean}deg)`, transformOrigin: "bottom left" }}>
      {text.split("").map((char, i) => {
        const code = char.charCodeAt(0);
        const s = hseed(startCharOffset + i, code, lineIdx, paraIdx);
        const pressure = pick(C_PRES, s + 9);
        return (
          <span
            key={startCharOffset + i}
            style={{
              display: "inline-block",
              transform: `rotate(${pick(C_ROT, s)}deg) translateY(${pick(C_TY, s + 3)}px) scaleX(${pick(C_SX, s + 7)}) scaleY(${pick(C_SY, s + 11)})`,
              transformOrigin: "bottom center",
              opacity: pick(C_OPQ, s + 5),
              letterSpacing: `${pick(C_SPC, s + 13)}px`,
              textShadow: inkShadow(pressure, s),
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

function HandwrittenLine({ text, charOffset, lineIdx, paraIdx }: LineInfo) {
  if (!text) return <span>&nbsp;</span>;
  const drift = pick(L_DRIFT, lineIdx * 11 + paraIdx * 7);

  // Split into word/space segments; track per-word index for word-level variation
  const parts = text.split(/(\s+)/);
  let pos = charOffset;
  let wordCount = 0;
  const segments = parts.map((part) => {
    const isSpace = /^\s+$/.test(part);
    const seg = { text: part, offset: pos, wordIdx: isSpace ? -1 : wordCount };
    if (!isSpace) wordCount++;
    pos += part.length;
    return seg;
  }).filter((s) => s.text.length > 0);

  return (
    <span style={{ display: "inline-block", transform: `translateY(${drift}px)` }}>
      {segments.map((seg, si) =>
        seg.wordIdx === -1 ? (
          <span key={si}>{" ".repeat(seg.text.length)}</span>
        ) : (
          <HandwrittenWord
            key={si}
            text={seg.text}
            wordIdx={seg.wordIdx}
            lineIdx={lineIdx}
            paraIdx={paraIdx}
            startCharOffset={seg.offset}
          />
        )
      )}
    </span>
  );
}

function HandwrittenBody({ text }: { text: string }) {
  const paras = buildLayout(text);
  return (
    <div>
      {paras.map((para, pi) => (
        <div key={pi} style={{ marginBottom: pi < paras.length - 1 ? "26px" : 0 }}>
          {para.lines.map((line, li) => (
            <div key={li} style={{ minHeight: "31px", display: "flex", alignItems: "flex-end" }}>
              <HandwrittenLine {...line} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── USPS Postmark SVG ─────────────────────────────────────────

function Postmark() {
  return (
    <div style={{ position: "relative", width: "58px", height: "58px", flexShrink: 0 }}>
      <svg width="58" height="58" viewBox="0 0 58 58" fill="none">
        <circle cx="29" cy="29" r="27" stroke="#CBD5E1" strokeWidth="1.5" fill="none" />
        <circle cx="29" cy="29" r="20" stroke="#CBD5E1" strokeWidth="0.8" fill="none" />
        <path d="M6 27 Q14.5 24 23 27 Q31.5 30 40 27 Q48.5 24 52 27" stroke="#CBD5E1" strokeWidth="0.9" fill="none" />
        <path d="M6 31 Q14.5 28 23 31 Q31.5 34 40 31 Q48.5 28 52 31" stroke="#CBD5E1" strokeWidth="0.9" fill="none" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
        <span style={{ fontSize: "6px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.14em", fontFamily: "Inter, sans-serif" }}>PHOENIX AZ</span>
        <span style={{ fontSize: "6px", color: "#94a3b8", letterSpacing: "0.06em", fontFamily: "Inter, sans-serif" }}>85001</span>
      </div>
    </div>
  );
}

// ── USPS-style stamp with perforations + cancellation marks ──

function Stamp({ accentColor }: { accentColor: string }) {
  const perfDotH = "radial-gradient(circle, #C4B9AB 55%, transparent 55%) repeat-x center / 6px 4px";
  const perfDotV = "radial-gradient(circle, #C4B9AB 55%, transparent 55%) repeat-y center / 4px 6px";
  return (
    <div style={{ position: "relative", width: "58px", height: "74px", flexShrink: 0 }}>
      {/* Perforated edges */}
      <div style={{ position: "absolute", top: 0, left: "4px", right: "4px", height: "4px", background: perfDotH }} />
      <div style={{ position: "absolute", bottom: 0, left: "4px", right: "4px", height: "4px", background: perfDotH }} />
      <div style={{ position: "absolute", left: 0, top: "4px", bottom: "4px", width: "4px", background: perfDotV }} />
      <div style={{ position: "absolute", right: 0, top: "4px", bottom: "4px", width: "4px", background: perfDotV }} />

      {/* Stamp body */}
      <div style={{
        position: "absolute",
        inset: "4px",
        border: "1px solid #CBD5E1",
        borderRadius: "1px",
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 1px 4px rgba(15,23,42,0.10)",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Flag top stripe */}
        <div style={{ height: "3px", background: "linear-gradient(90deg, #B91C1C 0 40%, #1D4ED8 40%)" }} />

        {/* Flag graphic */}
        <div style={{
          flex: 1,
          background: "linear-gradient(180deg, #1E3A5F 0%, #2563EB 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2px",
          padding: "3px 2px",
        }}>
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.92)", lineHeight: 1, letterSpacing: "1px" }}>★ ★</div>
          <div style={{ fontSize: "5px", fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: "0.08em", fontFamily: "Inter, sans-serif", textTransform: "uppercase" }}>
            FOREVER
          </div>
          <div style={{ fontSize: "4.5px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.10em", fontFamily: "Inter, sans-serif" }}>
            USA
          </div>
        </div>

        {/* Bottom denomination stripe */}
        <div style={{ height: "2px", background: "#B91C1C" }} />
      </div>

      {/* Cancellation wavy marks overlay */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.40 }}
        viewBox="0 0 58 74"
      >
        {[22, 33, 44, 55].map((y) => (
          <path
            key={y}
            d={`M-4,${y} C6,${y - 3} 16,${y + 3} 26,${y} S46,${y - 3} 62,${y}`}
            stroke="#475569"
            strokeWidth="0.9"
            fill="none"
          />
        ))}
      </svg>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function HandwritingPreview() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [accentColor, setAccentColor] = useState<AccentColor>("indigo");
  const [showBack, setShowBack] = useState(false);

  const sample = SAMPLE_MESSAGES[selectedIdx];
  const meta = ACCENT_META[accentColor];

  function selectSample(idx: number) {
    setSelectedIdx(idx);
    setAnimKey((k) => k + 1);
    setShowBack(false);
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-800">Handwriting Engine — Preview</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            3-scale engine: line drift × word lean/lift × per-character rotation, ink pressure, baseline, scale, spacing.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="chip chip-slate">CSS Demo</span>
          <span className="chip chip-emerald">Phase 1</span>
        </div>
      </div>

      {/* ── Accent color picker ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accent Color</p>
          {meta.isHighlight && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <Zap className="w-2.5 h-2.5" />{meta.liftBadge}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(Object.entries(ACCENT_META) as [AccentColor, typeof ACCENT_META[AccentColor]][]).map(([color, info]) => (
            <button
              key={color}
              onClick={() => setAccentColor(color)}
              className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] border text-xs font-semibold transition-all ${
                accentColor === color
                  ? "bg-white border-slate-300 shadow-sm text-slate-900"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              <div
                className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white"
                style={{ background: info.swatch, boxShadow: accentColor === color ? `0 0 0 1.5px ${info.swatch}` : "none" }}
              />
              {info.label}
              {info.liftBadge && (
                <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700 whitespace-nowrap">
                  ⚡ {info.liftBadge}
                </span>
              )}
            </button>
          ))}
        </div>
        {meta.isHighlight && (
          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2.5 py-1.5">
            Fluorescent accent colors on the offer strip are proven to increase response rates by up to 33% in direct mail studies (vs. standard ink).
          </p>
        )}
      </div>

      {/* ── Recipient selector ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => selectSample((selectedIdx + SAMPLE_MESSAGES.length - 1) % SAMPLE_MESSAGES.length)}
          className="w-10 h-10 rounded-[var(--radius)] border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-1.5 flex-1 flex-wrap">
          {SAMPLE_MESSAGES.map((msg, i) => (
            <button
              key={i}
              onClick={() => selectSample(i)}
              className={`min-h-[40px] px-4 py-2 rounded-[var(--radius)] text-xs font-semibold transition-all border ${
                selectedIdx === i
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-slate-700 bg-white"
              }`}
            >
              {msg.recipient.split(" ")[0]}
            </button>
          ))}
        </div>
        <button
          onClick={() => selectSample((selectedIdx + 1) % SAMPLE_MESSAGES.length)}
          className="w-10 h-10 rounded-[var(--radius)] border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-colors shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Front / Back toggle ── */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowBack(false)}
          className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
            !showBack ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          Front
        </button>
        <button
          onClick={() => setShowBack(true)}
          className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
            showBack ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          Back (Mailing Side)
        </button>
      </div>

      {/* ── Postcard ── */}
      <div className="relative overflow-x-auto -mx-1 px-1">
        <div key={animKey} className="relative mx-auto animate-fade-in" style={{ maxWidth: "580px", minWidth: "300px" }}>

          {!showBack ? (
            /* FRONT — lined paper, handwriting, logo, offer */
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: "#FDFCF8",
                border: "1px solid #E2D9C8",
                boxShadow: "0 4px 24px -4px rgba(15, 23, 42, 0.12), 0 1px 4px -1px rgba(15,23,42,0.06)",
                backgroundImage: [
                  PAPER_TEXTURE,
                  "repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(180,155,110,0.11) 30px, rgba(180,155,110,0.11) 31px)",
                ].join(", "),
                backgroundSize: "300px 300px, 100px 100px, 100% 31px",
                backgroundPositionY: "58px",
              }}
            >
              {/* Header: return address + logo + postmark + stamp */}
              <div
                className="flex items-start justify-between px-5 sm:px-6 pt-5 pb-4"
                style={{ borderBottom: "1px solid rgba(180,155,110,0.22)" }}
              >
                <div style={{ lineHeight: 1.6 }}>
                  {/* Logo placeholder */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <div style={{
                      width: "28px", height: "28px", borderRadius: "6px",
                      background: `linear-gradient(135deg, ${meta.swatch}22, ${meta.swatch}44)`,
                      border: `1.5px solid ${meta.swatch}66`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke={meta.swatch} strokeWidth="1.5" fill="none" />
                        <path d="M5 8l2 2 4-4" stroke={meta.swatch} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "14px", color: "#64748B", fontWeight: 700 }}>
                        Sunrise Ford
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", color: meta.swatch, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        Service Department
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "12px", color: "#94a3b8" }}>123 Auto Row, Phoenix AZ 85001</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Postmark />
                  <Stamp accentColor={meta.swatch} />
                </div>
              </div>

              {/* Recipient address */}
              <div className="px-5 sm:px-6 pt-4 pb-3">
                <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", lineHeight: 1.65 }}>
                  <div style={{ fontSize: "18px", color: "#1e293b", fontWeight: 700 }}>{sample.recipient}</div>
                  <div style={{ fontSize: "15px", color: "#475569" }}>{sample.address}</div>
                  <div style={{ fontSize: "14px", color: "#64748B" }}>{sample.cityStateZip}</div>
                </div>
              </div>

              {/* Dashed divider */}
              <div className="mx-5 sm:mx-6 my-1" style={{ borderTop: "1px dashed rgba(180,155,110,0.38)" }} />

              {/* Handwritten body */}
              <div
                className="px-5 sm:px-6 pt-4 pb-5"
                style={{
                  fontFamily: "'Patrick Hand', 'Caveat', cursive",
                  fontSize: "clamp(16px, 2.8vw, 18px)",
                  lineHeight: "31px",
                  color: "#1e293b",
                  letterSpacing: "0.012em",
                }}
              >
                <HandwrittenBody text={sample.body} />
              </div>

              {/* Offer strip */}
              <div className="px-5 sm:px-6 pb-6">
                <div style={{
                  padding: "8px 12px",
                  background: meta.isHighlight
                    ? `linear-gradient(105deg, ${meta.offerBg} 0%, ${meta.offerBg}cc 50%, ${meta.offerBg} 100%)`
                    : meta.offerBg,
                  borderLeft: `4px solid ${meta.offerBorder}`,
                  borderRadius: meta.isHighlight ? "2px 6px 6px 2px" : "4px",
                  fontSize: "12px",
                  color: meta.offerText,
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: meta.isHighlight ? 700 : 600,
                  letterSpacing: "0.01em",
                  boxShadow: meta.isHighlight ? `0 0 0 2px ${meta.offerBg}88` : undefined,
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {meta.isHighlight && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(90deg, ${meta.offerBorder}22 0%, transparent 50%, ${meta.offerBorder}11 100%)`,
                      pointerEvents: "none",
                    }} />
                  )}
                  <span style={{ position: "relative" }}>{sample.offer}</span>
                </div>
              </div>
            </div>
          ) : (
            /* BACK — USPS mailing side */
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "#FDFCF8",
                backgroundImage: PAPER_TEXTURE,
                border: "1px solid #E2D9C8",
                boxShadow: "0 4px 24px -4px rgba(15, 23, 42, 0.12), 0 1px 4px -1px rgba(15,23,42,0.06)",
              }}
            >
              {/* Top: return address + postage area */}
              <div className="flex items-start justify-between px-5 sm:px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(180,155,110,0.22)" }}>
                <div>
                  <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "13px", color: "#64748B", fontWeight: 700 }}>Sunrise Ford</div>
                  <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "12px", color: "#94a3b8" }}>123 Auto Row</div>
                  <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", fontSize: "12px", color: "#94a3b8" }}>Phoenix, AZ 85001</div>
                </div>
                <div style={{
                  width: "90px", height: "60px",
                  border: "1.5px solid #CBD5E1",
                  borderRadius: "4px",
                  background: "#F8FAFC",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "2px",
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: "6px", fontWeight: 700, color: meta.swatch, letterSpacing: "0.12em" }}>FIRST CLASS</div>
                  <div style={{ fontSize: "5px", color: "#94a3b8", letterSpacing: "0.06em" }}>U.S. POSTAGE PAID</div>
                  <div style={{ fontSize: "5px", color: "#94a3b8" }}>PERMIT NO. 1</div>
                </div>
              </div>

              {/* USPS mandate line */}
              <div style={{
                height: "1px",
                margin: "0 20px",
                background: "repeating-linear-gradient(90deg, #CBD5E1 0, #CBD5E1 6px, transparent 6px, transparent 12px)",
              }} />

              {/* Recipient address */}
              <div className="px-5 sm:px-6 pt-5 pb-4">
                <div style={{ fontSize: "7.5px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.10em", marginBottom: "10px", fontFamily: "Inter, sans-serif", textTransform: "uppercase" }}>
                  DELIVER TO:
                </div>
                <div style={{ fontFamily: "'Patrick Hand', 'Caveat', cursive", lineHeight: 1.65 }}>
                  <div style={{ fontSize: "20px", color: "#1e293b", fontWeight: 700 }}>{sample.recipient}</div>
                  <div style={{ fontSize: "16px", color: "#475569" }}>{sample.address}</div>
                  <div style={{ fontSize: "15px", color: "#64748B" }}>{sample.cityStateZip}</div>
                </div>
              </div>

              {/* Intelligent Mail Barcode (decorative) */}
              <div className="px-5 sm:px-6 pb-6">
                <div style={{ display: "flex", gap: "1.5px", alignItems: "flex-end", height: "22px" }}>
                  {Array.from({ length: 65 }, (_, i) => {
                    const h = [8, 16, 22, 16][i % 4];
                    return <div key={i} style={{ width: "2px", height: `${h}px`, background: "#94a3b8", borderRadius: "1px" }} />;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Paper stack shadow */}
          <div
            className="absolute -bottom-1 rounded-b-2xl blur-sm -z-10"
            style={{ left: "12px", right: "12px", height: "10px", background: "rgba(180,155,110,0.16)" }}
          />
        </div>
      </div>

      {/* ── Metadata footer ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white border border-slate-200 rounded-[var(--radius)] shadow-card px-5 py-4">
        <div className="space-y-1.5 text-xs text-slate-500 flex-1">
          <p><span className="font-semibold text-slate-700">Vehicle:</span> {sample.vehicle}</p>
          <p><span className="font-semibold text-slate-700">Format:</span> 6×9 postcard, 100lb uncoated stock</p>
          <p><span className="font-semibold text-slate-700">Accent:</span> {meta.label}{meta.isHighlight ? " (fluorescent highlight)" : " (standard)"}</p>
          <p><span className="font-semibold text-slate-700">Fulfillment:</span> PostGrid (robotic pen + USPS First Class)</p>
        </div>
        <div className="flex sm:flex-col gap-2 shrink-0">
          <button
            onClick={() => setAnimKey((k) => k + 1)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-[var(--radius)] border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
          <button
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[40px] px-5 py-2 rounded-[var(--radius)] text-xs font-bold transition-all shadow-sm"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10B981 100%)", color: "#fff", border: "1px solid rgba(5,150,105,0.7)", boxShadow: "0 1px 3px rgba(5,150,105,0.30), 0 4px 12px rgba(5,150,105,0.18)" }}
          >
            <Printer className="w-3.5 h-3.5" /> Send Test Mail
          </button>
        </div>
      </div>

      {/* ── Architecture notes ── */}
      <div className="bg-slate-900 rounded-[var(--radius)] px-5 py-4">
        <p className="text-[10px] font-mono text-slate-500 mb-2.5 uppercase tracking-widest">// Production pipeline</p>
        <div className="space-y-1.5">
          {[
            "1. Creative Agent generates personalized copy per customer",
            "2. Post-processor normalizes spacing, paragraphs, and punctuation",
            "3. Copy + accent color → PostGrid API with custom handwriting font profile",
            "4. PostGrid prints on 100lb uncoated stock with robotic pen",
            "5. Fluorescent ink applied to offer strip (yellow/orange/pink = +22–33% callback)",
            "6. USPS First Class mail → 2–3 day delivery",
            "7. Delivery confirmation webhook → communications table",
            "8. Optimization Agent tracks response rate per accent + template combination",
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-[10px] font-mono text-slate-600 shrink-0 mt-0.5">{line.slice(0, 2)}</span>
              <span className="text-[11px] font-mono text-emerald-400 leading-relaxed">{line.slice(3)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
