"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Printer } from "lucide-react";

// Sample messages — in production, Creative Agent generates these per customer
const SAMPLE_MESSAGES = [
  {
    recipient: "James Chen",
    address: "4821 Oak Creek Dr, Scottsdale, AZ 85254",
    body: `Hi James,\n\nWe noticed your 2021 Tacoma is coming up on its 30,000-mile service soon. I wanted to personally reach out — we have a $30 off coupon just for you, good any Tuesday or Wednesday this month.\n\nHope to see you soon!\n\nMike\nYour Service Advisor`,
    vehicle: "2021 Toyota Tacoma",
  },
  {
    recipient: "Sarah Martinez",
    address: "711 Mesa View Ln, Tempe, AZ 85281",
    body: `Sarah,\n\nIt's been a while since we serviced your Pilot — I hope it's treating you well! We're running a complimentary multi-point inspection this month, and I'd love to get you back in.\n\nGive me a call or just book online.\n\nBest,\nTom`,
    vehicle: "2019 Honda Pilot",
  },
  {
    recipient: "Robert & Linda Walsh",
    address: "2200 Sunrise Blvd, Gilbert, AZ 85234",
    body: `Robert & Linda,\n\nThank you for being such loyal customers over the years. As a small thank-you, we're holding a VIP appreciation event next Saturday — free coffee, complimentary tire rotation, and a look at the new lineup.\n\nWe'd love to see you there.\n\nWarmly,\nThe Sunrise Team`,
    vehicle: "Multiple vehicles",
  },
];

// Character-level variation component for realistic handwriting simulation
function HandwrittenText({ text }: { text: string }) {
  return (
    <span className="font-handwriting text-[17px] leading-relaxed text-gray-800">
      {text.split("").map((char, i) => {
        // Each character gets a small, pseudo-random but deterministic transform
        const seed = (i * 7 + char.charCodeAt(0)) % 13;
        const rotation = [-1.2, 0.4, -0.5, 0.8, -0.3, 1.1, -0.7, 0.2, -0.9, 0.6, -0.4, 0.3, -1.0][seed];
        const translateY = [-0.8, 0.5, -0.3, 0.9, -0.6, 0.3, -1.0, 0.4, -0.5, 0.8, -0.2, 0.7, -0.4][seed];
        const scale = [0.97, 1.01, 0.98, 1.02, 0.99, 1.01, 0.97, 1.02, 0.98, 1.00, 0.99, 1.01, 0.97][seed];

        if (char === "\n") return <br key={i} />;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `rotate(${rotation}deg) translateY(${translateY}px) scale(${scale})`,
              transformOrigin: "bottom center",
              // Subtle ink-density variation via opacity
              opacity: 0.85 + (seed % 5) * 0.03,
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

export function HandwritingPreview() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const sample = SAMPLE_MESSAGES[selectedIdx];

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">Direct Mail Preview — Handwriting Engine</CardTitle>
              <CardDescription className="mt-1">
                Character-level variation simulates realistic handwritten notes. In production,
                each letter is printed by a robotic pen with slight ink-density and angle variation.
              </CardDescription>
            </div>
            <div className="flex gap-2 shrink-0">
              <Badge variant="secondary">CSS Demo</Badge>
              <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">Phase 1</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recipient selector */}
          <div className="flex gap-2 flex-wrap">
            {SAMPLE_MESSAGES.map((msg, i) => (
              <Button
                key={i}
                variant={selectedIdx === i ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setSelectedIdx(i)}
              >
                {msg.recipient.split(" ")[0]}
              </Button>
            ))}
          </div>

          {/* Envelope preview */}
          <div className="relative">
            {/* Outer envelope */}
            <div
              className="rounded-xl border-2 border-amber-200 bg-amber-50 p-8 shadow-lg relative overflow-hidden"
              style={{ minHeight: "340px", backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, #e5e7eb 27px, #e5e7eb 28px)" }}
            >
              {/* Stamp placeholder */}
              <div className="absolute top-4 right-4 w-14 h-16 border-2 border-dashed border-amber-300 rounded flex items-center justify-center">
                <span className="text-[9px] text-amber-400 text-center font-medium leading-tight">FIRST<br/>CLASS</span>
              </div>

              {/* Return address */}
              <div className="absolute top-4 left-4 text-[10px] text-gray-400 font-handwriting">
                <p>Sunrise Ford</p>
                <p>123 Auto Row</p>
                <p>Phoenix, AZ 85001</p>
              </div>

              {/* Main content area */}
              <div className="mt-12 space-y-4">
                {/* Recipient address block */}
                <div className="font-handwriting text-sm text-gray-600 leading-snug">
                  <HandwrittenText text={sample.recipient} />
                  <br />
                  <HandwrittenText text={sample.address} />
                </div>

                {/* Horizontal rule — like a fold line */}
                <div className="border-t border-dashed border-amber-300 my-4" />

                {/* Message body */}
                <div className="leading-loose">
                  <HandwrittenText text={sample.body} />
                </div>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-slate-50 rounded-lg px-4 py-3 border">
            <div className="space-y-0.5">
              <p><span className="font-medium">Vehicle:</span> {sample.vehicle}</p>
              <p><span className="font-medium">Format:</span> 4×6 postcard, 100lb uncoated stock</p>
              <p><span className="font-medium">Fulfillment:</span> Lob.com API (Phase 2)</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate
              </Button>
              <Button size="sm" className="h-8 text-xs">
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Send to Print
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical notes */}
      <Card className="border-0 shadow-sm bg-slate-900 text-slate-100">
        <CardContent className="py-4 px-5">
          <p className="text-xs font-mono text-slate-400 mb-1">// Handwriting engine — production architecture</p>
          <pre className="text-xs font-mono text-green-400 leading-relaxed whitespace-pre-wrap">{`1. Creative Agent generates personalized copy (per customer)
2. Copy → Lob.com API with custom handwriting font profile
3. Lob prints on 100lb uncoated stock with robotic pen
4. USPS First Class mail → 2-3 day delivery
5. Delivery confirmation webhook → communications table
6. Optimization Agent tracks response rate per template`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
