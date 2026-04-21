"use client";

import { useState } from "react";
import { RefreshCw, Printer, ChevronLeft, ChevronRight } from "lucide-react";

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

// Deterministic seed per character — subtler values, no opacity reduction
const ROT   = [-0.7, 0.3, -0.4, 0.6, -0.2, 0.8, -0.5, 0.2, -0.6, 0.4, -0.3, 0.5, -0.5];
const TY    = [-0.4, 0.3, -0.2, 0.5, -0.3, 0.2, -0.5, 0.3, -0.3, 0.4, -0.1, 0.3, -0.2];
const SC    = [0.99, 1.01, 0.99, 1.01, 0.99, 1.01, 0.98, 1.01, 0.99, 1.00, 0.99, 1.01, 0.98];

function seed(i: number, code: number) {
  return (i * 7 + code * 3) % 13;
}

function HandwrittenLine({ text, charOffset = 0 }: { text: string; charOffset?: number }) {
  if (!text) return <span>&nbsp;</span>;
  return (
    <span>
      {text.split("").map((char, i) => {
        const s = seed(charOffset + i, char.charCodeAt(0));
        return (
          <span
            key={charOffset + i}
            style={{
              display: "inline-block",
              transform: `rotate(${ROT[s]}deg) translateY(${TY[s]}px) scale(${SC[s]})`,
              transformOrigin: "bottom center",
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </span>
  );
}

function HandwrittenBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);
  let charOffset = 0;

  return (
    <div>
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n");
        const el = (
          <div
            key={pi}
            style={{ marginBottom: pi < paragraphs.length - 1 ? "20px" : 0 }}
          >
            {lines.map((line, li) => {
              const offset = charOffset;
              charOffset += line.length + 1;
              return (
                <div key={li} style={{ minHeight: "1em" }}>
                  <HandwrittenLine text={line} charOffset={offset} />
                </div>
              );
            })}
          </div>
        );
        charOffset += 2;
        return el;
      })}
    </div>
  );
}

// ── Postmark SVG ──────────────────────────────────────────────
function Postmark() {
  return (
    <div style={{ position: "relative", width: "58px", height: "58px" }}>
      <svg width="58" height="58" viewBox="0 0 58 58" fill="none">
        <circle cx="29" cy="29" r="27" stroke="#CBD5E1" strokeWidth="1.5" fill="none" />
        <circle cx="29" cy="29" r="20" stroke="#CBD5E1" strokeWidth="0.8" fill="none" />
        <path d="M6 27 Q14.5 24 23 27 Q31.5 30 40 27 Q48.5 24 52 27" stroke="#CBD5E1" strokeWidth="0.8" fill="none" />
        <path d="M6 31 Q14.5 28 23 31 Q31.5 34 40 31 Q48.5 28 52 31" stroke="#CBD5E1" strokeWidth="0.8" fill="none" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px" }}>
        <span style={{ fontSize: "6px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", fontFamily: "Inter, sans-serif" }}>PHOENIX AZ</span>
        <span style={{ fontSize: "6px", color: "#94a3b8", letterSpacing: "0.06em", fontFamily: "Inter, sans-serif" }}>85001</span>
      </div>
    </div>
  );
}

// ── USPS-style stamp ──────────────────────────────────────────
function Stamp() {
  return (
    <div
      style={{
        width: "52px",
        height: "68px",
        border: "1.5px solid #CBD5E1",
        borderRadius: "3px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "#F8FAFC",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.8)",
      }}
    >
      {/* Colored top bar */}
      <div style={{ height: "4px", background: "linear-gradient(90deg, #6366F1, #8B5CF6)" }} />
      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px", padding: "4px 2px" }}>
        <div style={{
          width: "34px",
          height: "26px",
          background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
          borderRadius: "2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="4" width="12" height="8" rx="1" stroke="#6366F1" strokeWidth="1.2" fill="none"/>
            <path d="M2 6l6 4 6-4" stroke="#6366F1" strokeWidth="1.2"/>
          </svg>
        </div>
        <span style={{ fontSize: "5.5px", fontWeight: 700, color: "#6366F1", letterSpacing: "0.1em", fontFamily: "Inter, sans-serif", textAlign: "center", lineHeight: 1.2 }}>
          FIRST{"\n"}CLASS
        </span>
      </div>
      {/* Bottom bar */}
      <div style={{ height: "3px", background: "#6366F1", opacity: 0.3 }} />
    </div>
  );
}

export function HandwritingPreview() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const sample = SAMPLE_MESSAGES[selectedIdx];

  function prev() {
    setSelectedIdx((i) => (i + SAMPLE_MESSAGES.length - 1) % SAMPLE_MESSAGES.length);
  }
  function next() {
    setSelectedIdx((i) => (i + 1) % SAMPLE_MESSAGES.length);
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-800">Handwriting Engine — Preview</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Character-level variation simulates realistic pen strokes. Each piece is unique per customer.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="chip chip-slate">CSS Demo</span>
          <span className="chip chip-emerald">Phase 1</span>
        </div>
      </div>

      {/* ── Recipient selector ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={prev}
          className="w-10 h-10 rounded-[var(--radius)] border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-1.5 flex-1 flex-wrap">
          {SAMPLE_MESSAGES.map((msg, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
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
          onClick={next}
          className="w-10 h-10 rounded-[var(--radius)] border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-colors shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Postcard ── */}
      <div className="relative overflow-x-auto -mx-1 px-1">
        <div
          className="relative rounded-2xl overflow-hidden mx-auto"
          style={{
            maxWidth: "580px",
            minWidth: "320px",
            background: "#FDFCF8",
            border: "1px solid #E2D9C8",
            boxShadow: "0 4px 24px -4px rgba(15, 23, 42, 0.12), 0 1px 4px -1px rgba(15,23,42,0.06)",
            backgroundImage: [
              "repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(180,155,110,0.12) 30px, rgba(180,155,110,0.12) 31px)",
            ].join(", "),
            backgroundSize: "100% 31px",
            backgroundPositionY: "58px",
          }}
        >
          {/* Top strip: return address + postmark + stamp */}
          <div
            className="relative flex items-start justify-between px-6 pt-5 pb-4"
            style={{ borderBottom: "1px solid rgba(180,155,110,0.2)" }}
          >
            {/* Return address */}
            <div style={{ fontFamily: "'Caveat', cursive", lineHeight: 1.55 }}>
              <div style={{ fontSize: "13px", color: "#64748B", fontWeight: 600 }}>Sunrise Ford</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>123 Auto Row, Phoenix AZ 85001</div>
            </div>

            {/* Postmark + Stamp */}
            <div className="flex items-center gap-3 shrink-0">
              <Postmark />
              <Stamp />
            </div>
          </div>

          {/* Recipient address */}
          <div className="px-6 pt-5 pb-3">
            <div style={{ fontFamily: "'Caveat', cursive", lineHeight: 1.65 }}>
              <div style={{ fontSize: "17px", color: "#1e293b", fontWeight: 600 }}>{sample.recipient}</div>
              <div style={{ fontSize: "15px", color: "#475569", opacity: 0.85 }}>{sample.address}</div>
              <div style={{ fontSize: "14px", color: "#64748B", opacity: 0.75 }}>{sample.cityStateZip}</div>
            </div>
          </div>

          {/* Divider */}
          <div
            className="mx-6 my-1"
            style={{ borderTop: "1px dashed rgba(180,155,110,0.35)" }}
          />

          {/* Letter body */}
          <div
            className="px-6 pt-4 pb-8"
            style={{
              fontFamily: "'Caveat', cursive",
              fontSize: "clamp(17px, 3vw, 19px)",
              lineHeight: "31px",
              color: "#1e293b",
              letterSpacing: "0.01em",
            }}
          >
            <HandwrittenBody text={sample.body} />
          </div>
        </div>

        {/* Paper shadow */}
        <div
          className="absolute -bottom-1 mx-auto rounded-b-2xl blur-sm -z-10"
          style={{ left: "8px", right: "8px", height: "12px", background: "rgba(180,155,110,0.18)" }}
        />
      </div>

      {/* ── Offer chip ── */}
      {sample.offer && (
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-slate-100" />
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
            style={{ background: "#EEF2FF", color: "#4338CA", border: "1px solid #C7D2FE" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            {sample.offer}
          </div>
          <div className="h-px flex-1 bg-slate-100" />
        </div>
      )}

      {/* ── Metadata footer ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white border border-slate-200 rounded-[var(--radius)] shadow-card px-5 py-4">
        <div className="space-y-1.5 text-xs text-slate-500 flex-1">
          <p><span className="font-semibold text-slate-700">Vehicle:</span> {sample.vehicle}</p>
          <p><span className="font-semibold text-slate-700">Format:</span> 6×9 postcard, 100lb uncoated stock</p>
          <p><span className="font-semibold text-slate-700">Fulfillment:</span> PostGrid (robotic pen + USPS First Class)</p>
        </div>
        <div className="flex sm:flex-col gap-2 shrink-0">
          <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-[var(--radius)] border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
          <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-[var(--radius)] bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:bg-slate-700 transition-all">
            <Printer className="w-3.5 h-3.5" /> Send to Print
          </button>
        </div>
      </div>

      {/* ── Technical notes ── */}
      <div className="bg-slate-900 rounded-[var(--radius)] px-5 py-4">
        <p className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-wider">
          // Handwriting engine — production architecture
        </p>
        <pre className="text-xs font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap">{`1. Creative Agent generates personalized copy per customer
2. Post-processor normalizes spacing, paragraphs, and punctuation
3. Copy → PostGrid API with custom handwriting font profile
4. PostGrid prints on 100lb uncoated stock with robotic pen
5. USPS First Class mail → 2–3 day delivery
6. Delivery confirmation webhook → communications table
7. Optimization Agent tracks response rate per template`}</pre>
      </div>
    </div>
  );
}
