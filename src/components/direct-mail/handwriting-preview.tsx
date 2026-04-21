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

function charSeed(i: number, code: number) {
  return (i * 7 + code * 3) % 13;
}

const ROTATIONS = [-1.2, 0.4, -0.5, 0.8, -0.3, 1.1, -0.7, 0.2, -0.9, 0.6, -0.4, 0.3, -1.0];
const TRANSLATE_Y = [-0.6, 0.4, -0.3, 0.7, -0.5, 0.3, -0.8, 0.4, -0.4, 0.6, -0.2, 0.5, -0.3];
const SCALES = [0.98, 1.01, 0.99, 1.02, 0.98, 1.01, 0.97, 1.02, 0.99, 1.00, 0.98, 1.01, 0.97];
const OPACITIES = [0.88, 0.91, 0.86, 0.93, 0.89, 0.92, 0.87, 0.90, 0.88, 0.93, 0.86, 0.91, 0.89];

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

function HandwrittenBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);
  let charOffset = 0;

  return (
    <div className="space-y-4">
      {paragraphs.map((para, pi) => {
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
              charOffset += line.length + 1;
              return (
                <div key={li}>
                  <HandwrittenLine text={line} charOffset={offset} />
                </div>
              );
            })}
          </div>
        );
        charOffset += 2;
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

      {/* Recipient selector */}
      <div className="flex items-center gap-2">
        <button onClick={prev} className="w-11 h-11 rounded-[var(--radius)] border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-1.5 flex-1 flex-wrap">
          {SAMPLE_MESSAGES.map((msg, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`min-h-[44px] px-4 py-2 rounded-[var(--radius)] text-xs font-semibold transition-all border ${
                selectedIdx === i
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-[0_1px_2px_0_rgb(79_70_229/0.22)]"
                  : "border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-slate-700 bg-white"
              }`}
            >
              {msg.recipient.split(" ")[0]}
            </button>
          ))}
        </div>
        <button onClick={next} className="w-11 h-11 rounded-[var(--radius)] border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-colors shrink-0">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Paper card */}
      <div className="relative overflow-x-auto">
        <div
          className="rounded-2xl border border-slate-200 bg-white shadow-xl relative overflow-hidden min-w-[300px]"
          style={{
            minHeight: "420px",
            backgroundImage: [
              "repeating-linear-gradient(0deg, transparent, transparent 32px, #f1f5f9 32px, #f1f5f9 33px)",
            ].join(", "),
            backgroundSize: "100% 33px",
            backgroundPositionY: "52px",
          }}
        >
          {/* Top strip — return address + postmark */}
          <div className="relative flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100/80">
            <div className="space-y-0.5">
              <SmallHandwritten text="Sunrise Ford" />
              <div><SmallHandwritten text="123 Auto Row, Phoenix AZ 85001" /></div>
            </div>
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

        {/* Paper shadow */}
        <div className="absolute -bottom-1 left-4 right-4 h-3 rounded-b-2xl bg-slate-200/60 blur-sm -z-10" />
      </div>

      {/* Metadata footer */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white border border-slate-200 rounded-[var(--radius)] shadow-card px-5 py-4">
        <div className="space-y-1.5 text-xs text-slate-500 flex-1">
          <p><span className="font-semibold text-slate-700">Vehicle:</span> {sample.vehicle}</p>
          <p><span className="font-semibold text-slate-700">Format:</span> 6×9 postcard, 100lb uncoated stock</p>
          <p><span className="font-semibold text-slate-700">Fulfillment:</span> PostGrid (robotic pen + USPS First Class)</p>
        </div>
        <div className="flex sm:flex-col gap-2 shrink-0">
          <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-[var(--radius)] border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
          <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-[var(--radius)] bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:bg-slate-700 transition-all shadow-[0_1px_2px_0_rgb(15_23_42/0.28)]">
            <Printer className="w-3.5 h-3.5" /> Send to Print
          </button>
        </div>
      </div>

      {/* Technical notes */}
      <div className="bg-slate-900 rounded-[var(--radius)] px-5 py-4">
        <p className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-wider">// Handwriting engine — production architecture</p>
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
