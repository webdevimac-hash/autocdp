"use client";

import { Badge } from "@/components/ui/badge";
import { buildPreviewQRImageUrl } from "@/lib/qrcode-gen";
import type { MailTemplateType } from "@/types";

interface TemplatePreviewProps {
  templateType: MailTemplateType;
  content: string;
  dealershipName: string;
  customerName?: string;
  vehicle?: string | null;
  offer?: string | null;
  qrPreviewUrl?: string;   // override — if not provided, generates from tracking preview URL
}

// Character-level transform for handwriting simulation (same technique as handwriting-preview.tsx)
function HandwrittenText({ text }: { text: string }) {
  return (
    <span style={{ fontFamily: "'Caveat', cursive", fontSize: "inherit", lineHeight: "inherit" }}>
      {text.split("").map((char, i) => {
        if (char === "\n") return <br key={i} />;
        const seed = (i * 7 + char.charCodeAt(0)) % 13;
        const rotations = [-1.2, 0.4, -0.5, 0.8, -0.3, 1.1, -0.7, 0.2, -0.9, 0.6, -0.4, 0.3, -1.0];
        const translateYs = [-0.8, 0.5, -0.3, 0.9, -0.6, 0.3, -1.0, 0.4, -0.5, 0.8, -0.2, 0.7, -0.4];
        const scales = [0.97, 1.01, 0.98, 1.02, 0.99, 1.01, 0.97, 1.02, 0.98, 1.00, 0.99, 1.01, 0.97];
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `rotate(${rotations[seed]}deg) translateY(${translateYs[seed]}px) scale(${scales[seed]})`,
              transformOrigin: "bottom center",
              opacity: 0.85 + (seed % 5) * 0.03,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </span>
  );
}

// ── Postcard 6x9 Preview ─────────────────────────────────────

function Postcard6x9Preview({
  content,
  dealershipName,
  offer,
  qrPreviewUrl,
}: {
  content: string;
  dealershipName: string;
  offer?: string | null;
  qrPreviewUrl: string;
}) {
  const lines = content.split("\n");

  return (
    <div className="relative" style={{ perspective: "1000px" }}>
      {/* Front */}
      <div
        className="rounded-xl border-2 border-amber-200 shadow-xl overflow-hidden"
        style={{
          width: "100%",
          maxWidth: "480px",
          aspectRatio: "6/9",
          background: "#fefce8",
          backgroundImage: "repeating-linear-gradient(transparent, transparent 29px, #e5e7eb 29px, #e5e7eb 30px)",
          padding: "20px 22px",
          position: "relative",
        }}
      >
        {/* Dealership header */}
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "9px",
            fontWeight: 600,
            color: "#2563eb",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            borderBottom: "1px solid #dbeafe",
            paddingBottom: "6px",
            marginBottom: "12px",
          }}
        >
          {dealershipName}
        </div>

        {/* Handwritten message */}
        <div style={{ fontSize: "17px", lineHeight: "1.75", color: "#1f2937" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ marginBottom: "2px" }}>
              {line ? <HandwrittenText text={line} /> : <br />}
            </div>
          ))}
        </div>

        {/* Offer callout */}
        {offer && (
          <div
            style={{
              marginTop: "10px",
              padding: "6px 10px",
              background: "#eff6ff",
              borderLeft: "3px solid #2563eb",
              borderRadius: "3px",
              fontSize: "11px",
              color: "#1e40af",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {offer}
          </div>
        )}

        {/* QR code — bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: "14px",
            right: "14px",
            textAlign: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrPreviewUrl}
            alt="Tracking QR"
            width={64}
            height={64}
            style={{ display: "block", borderRadius: "4px" }}
          />
          <div style={{ fontSize: "7px", color: "#6b7280", marginTop: "3px", fontFamily: "'Inter', sans-serif" }}>
            Scan for offer
          </div>
        </div>
      </div>

      {/* Back side preview — collapsed pill */}
      <div className="mt-2 text-center">
        <Badge variant="secondary" className="text-[10px]">
          ↑ Front · Back has mailing address + postage area
        </Badge>
      </div>
    </div>
  );
}

// ── Letter Preview ────────────────────────────────────────────

function LetterPreview({
  content,
  dealershipName,
  templateType,
}: {
  content: string;
  dealershipName: string;
  templateType: MailTemplateType;
}) {
  const aspectRatio = templateType === "letter_8.5x11" ? "8.5/11" : "6/9";
  const lines = content.split("\n");
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div
      className="rounded-xl border border-gray-200 shadow-xl bg-white overflow-hidden"
      style={{
        width: "100%",
        maxWidth: templateType === "letter_8.5x11" ? "480px" : "360px",
        aspectRatio,
        padding: templateType === "letter_8.5x11" ? "24px 28px" : "18px 20px",
        position: "relative",
      }}
    >
      {/* Letterhead */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "2px solid #2563eb",
          paddingBottom: "8px",
          marginBottom: "12px",
        }}
      >
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "15px", fontWeight: 700, color: "#1e3a8a" }}>
          {dealershipName}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", color: "#6b7280", textAlign: "right" }}>
          {today}
        </div>
      </div>

      {/* Body */}
      <div style={{ fontSize: "14px", lineHeight: "1.8", color: "#1f2937" }}>
        {lines.map((line, i) => (
          <div key={i} style={{ marginBottom: "1px" }}>
            {line ? <HandwrittenText text={line} /> : <br />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────

export function TemplatePreview({
  templateType,
  content,
  dealershipName,
  offer,
  qrPreviewUrl: qrPropUrl,
}: TemplatePreviewProps) {
  // Use provided URL or fall back to a generic preview URL
  const qrUrl = qrPropUrl ?? buildPreviewQRImageUrl(
    `${typeof window !== "undefined" ? window.location.origin : ""}/track/preview`,
    80
  );

  if (!content) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
        <p className="text-sm text-muted-foreground">Generate copy to preview your mail piece</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      {templateType === "postcard_6x9" ? (
        <Postcard6x9Preview
          content={content}
          dealershipName={dealershipName}
          offer={offer}
          qrPreviewUrl={qrUrl}
        />
      ) : (
        <LetterPreview
          content={content}
          dealershipName={dealershipName}
          templateType={templateType}
        />
      )}
    </div>
  );
}
