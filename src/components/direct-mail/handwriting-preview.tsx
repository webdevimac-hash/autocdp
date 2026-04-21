"use client";

import { useState } from "react";
import { RefreshCw, Printer, ChevronLeft, ChevronRight } from "lucide-react";

const SAMPLE_MESSAGES = [
  {
    recipient: "James Chen",
    address: "4821 Oak Creek Dr, Scottsdale, AZ 85254",
    body: `James,\n\nYour 2021 Tacoma is coming up on its 30,000-mile service. I wanted to reach out personally — we have a $30 coupon just for you, good any Tuesday or Wednesday this month.\n\nWould love to see you back in. Just give us a call or book online anytime.\n\nWarmly,\nMike`,
    vehicle: "2021 Toyota Tacoma",
    advisor: "Mike",
  },
  {
    recipient: "Sarah Martinez",
    address: "711 Mesa View Ln, Tempe, AZ 85281",
    body: `Sarah,\n\nIt's been a while since we serviced your Pilot — I hope it's treating you well!\n\nWe're running a complimentary multi-point inspection this month, no strings attached. I'd love to get you back in before summer heat sets in.\n\nJust call or book online — takes two minutes.\n\nBest,\nTom`,
    vehicle: "2019 Honda Pilot",
    advisor: "Tom",
  },
  {
    recipient: "Robert & Linda Walsh",
    address: "2200 Sunrise Blvd, Gilbert, AZ 85234",
    body: `Robert & Linda,\n\nThank you for being such loyal customers over the years. It truly means a lot to our whole team.\n\nWe're holding a VIP appreciation event next Saturday — free coffee, complimentary tire rotation, and a first look at the new lineup.\n\nWe'd love to see you there.\n\nWarmly,\nThe Sunrise Team`,
    vehicle: "Multiple vehicles",
    advisor: "The Sunrise Team",
  },
];

// Deterministic pseudo-random values per character position
function charSeed(i: number, code: number) {
  return (i * 7 + code * 3) % 13;
}

const ROTATIONS = [-1.2, 0.4, -0.5, 0.8, -0.3, 1.1, -0.7, 0.2, -0.9, 0.6, -0.4, 0.3, -1.0];
const TRANSLATE_Y = [-0.6, 0.4, -0.3, 0.7, -0.5, 0.3, -0.8, 0.4, -0.4, 0.6, -0.2, 0.5, -0.3];
const SCALES = [0.98, 1.01, 0.99, 1.02, 0.98, 1.01, 0.97, 1.02, 0.99, 1.00, 0.98, 1.01, 0.97];
const OPACITIES = [0.88, 0.91, 0.86, 0.93, 0.89, 0.92, 0.87, 0.90, 0.88, 0.93, 0.86, 0.91, 0.89];

// Render a single line with character-level variation
function HandwrittenLine({ text, charOffset = 0 }: { text: string; charOffset?: number }) {
  return (
    <span
      style={{
        fontFamily: "'Caveat', 'Segoe Script', cursive",
        fontSize: "18px",
        lineHeight: "1.85",
        color: "#1e293b",
        display: "inline",
      }}
    >
      {text.split("").map((char, i) => {
        const idx = charOffset + i;
        const seed = charSeed(idx, char.charCodeAt(0));
        return (
          <span
            key={idx}
            style={{
              display: "inline-block",
              transform: `rotate(${ROTATIONS[seed]}deg) translateY(${TRANSLATE_Y[seed]}px) scale(${SCALES[seed]})`,
              transformOrigin: "bottom center",
              opacity: OPACITIES[seed],
              letterSpacing: char === " " ? "0.02em" : undefined,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </span>
  );
}

// Render the full body with paragraph and line-break awareness
function HandwrittenBody({ text }: { text: string }) {
  // Split into paragraphs on double newlines first
  const paragraphs = text.split(/\n\n+/);
  let charOffset = 0;

  return (
    <div className="space-y-4">
      {paragraphs.map((para, pi) => {
        // Within each paragraph, split on single newlines
        const lines = para.split("\n");
        const paraEl = (
          <div
            key={pi}
            style={{
              fontFamily: "'Caveat', 'Segoe Script', cursive",
              fontSize: "18px",
              lineHeight: "1.85",
              color: "#1e293b",
            }}
          >
            {lines.map((line, li) => {
              const offset = charOffset;
              charOffset += line.length + 1; // +1 for the \n
              return (
                <div key={li}>
                  <HandwrittenLine text={line} charOffset={offset} />
                </div>
              );
            })}
          </div>
        );
        charOffset += 2; // for the \n\n
        return paraEl;
      })}
    </div>
  );
}

function SmallHandwritten({ text }: { text: string }) {
  return (
    <span
      style={{
        fontFamily: "'Caveat', 'Segoe Script', cursive",
        fontSize: "13px",
        color: "#94a3b8",
        opacity: 0.9,
      }}
    >
      {text}
    </span>
  );
}

export function HandwritingPreview() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const sample = SAMPLE_MESSAGES[selectedIdx];

  function prev() { setSelectedIdx((i) => (i + SAMPLE_MESSAGES.length - 1) % SAMPLE_MESSAGES.length); }
  function next() { setSelectedIdx((i) => (i + 1) % SAMPLE_MESSAGES.length); }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Handwriting Engine — Preview</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Character-level variation simulates realistic pen strokes. Each piece is unique per customer.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">CSS Demo</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Phase 1</span>
        </div>
      </div>

      {/* Recipient tabs */}
      <div className="flex items-center gap-2">
        <button onClick={prev} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-1.5 flex-1 flex-wrap">
          {SAMPLE_MESSAGES.map((msg, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                selectedIdx === i
                  ? "bg-slate-900 text-white border-slate-900"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {msg.recipient.split(" ")[0]}
            </button>
          ))}
        </div>
        <button onClick={next} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Card / Envelope preview */}
      <div className="relative">
        {/* Paper card */}
        <div
          className="rounded-2xl border border-slate-200 bg-white shadow-xl relative overflow-hidden"
          style={{
            minHeight: "420px",
            backgroundImage: [
              "repeating-linear-gradient(0deg, transparent, transparent 32px, #f1f5f9 32px, #f1f5f9 33px)",
            ].join(", "),
            backgroundSize: "100% 33px",
            backgroundPositionY: "52px",
          }}
        >
          {/* Top strip — mimics card header / postmark zone */}
          <div className="relative flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100/80">
            {/* Return address */}
            <div className="space-y-0.5">
              <SmallHandwritten text="Sunrise Ford" />
              <div><SmallHandwritten text="123 Auto Row, Phoenix AZ 85001" /></div>
            </div>
            {/* Stamp zone */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-[52px] h-[62px] border-2 border-dashed border-slate-200 rounded-sm flex flex-col items-center justify-center">
                <span className="text-[8px] font-bold text-slate-300 tracking-widest text-center leading-tight">
                  FIRST<br/>CLASS
                </span>
              </div>
            </div>
          </div>

          {/* Recipient address */}
          <div className="px-6 pt-4 pb-2">
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: "17px", lineHeight: "1.6", color: "#334155" }}>
              <div>{sample.recipient}</div>
              <div style={{ opacity: 0.75, fontSize: "15px" }}>{sample.address}</div>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-6 my-3 border-t border-dashed border-slate-200" />

          {/* Message body */}
          <div className="px-6 pb-7">
            <HandwrittenBody text={sample.body} />
          </div>
        </div>

        {/* Subtle paper shadow */}
        <div className="absolute -bottom-1 left-4 right-4 h-3 rounded-b-2xl bg-slate-200/60 blur-sm -z-10" />
      </div>

      {/* Metadata footer */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
        <div className="space-y-1 text-xs text-slate-500">
          <p><span className="font-medium text-slate-700">Vehicle:</span> {sample.vehicle}</p>
          <p><span className="font-medium text-slate-700">Format:</span> 6×9 postcard, 100lb uncoated stock</p>
          <p><span className="font-medium text-slate-700">Fulfillment:</span> PostGrid (robotic pen + USPS First Class)</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-white hover:border-slate-300 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-all">
            <Printer className="w-3.5 h-3.5" /> Send to Print
          </button>
        </div>
      </div>

      {/* Technical notes */}
      <div className="bg-slate-900 rounded-xl px-5 py-4">
        <p className="text-[10px] font-mono text-slate-500 mb-2">// Handwriting engine — production architecture</p>
        <pre className="text-[11px] font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap">{`1. Creative Agent generates personalized copy per customer
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
