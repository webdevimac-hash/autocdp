"use client";

import { buildPreviewQRImageUrl } from "@/lib/qrcode-gen";
import type { MailTemplateType } from "@/types";

interface TemplatePreviewProps {
  templateType: MailTemplateType;
  content: string;
  dealershipName: string;
  customerName?: string;
  vehicle?: string | null;
  offer?: string | null;
  qrPreviewUrl?: string;
  logoUrl?: string | null;
}

// Character-level transform for handwriting simulation
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

function HandwrittenContent({ text, fontSize = 17, lineHeight = 1.8 }: { text: string; fontSize?: number; lineHeight?: number }) {
  const paragraphs = text.split(/\n\n+/);
  return (
    <div style={{ fontSize: `${fontSize}px`, lineHeight, color: "#1e293b" }}>
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n");
        return (
          <div key={pi} style={{ marginBottom: pi < paragraphs.length - 1 ? `${fontSize * 0.65}px` : 0 }}>
            {lines.map((line, li) => (
              <div key={li}>
                {line ? <HandwrittenText text={line} /> : null}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Postcard 6x9 Preview ─────────────────────────────────────

function Postcard6x9Preview({
  content,
  dealershipName,
  offer,
  qrPreviewUrl,
  logoUrl,
}: {
  content: string;
  dealershipName: string;
  offer?: string | null;
  qrPreviewUrl: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="relative" style={{ perspective: "1000px" }}>
      {/* Drop shadow layer */}
      <div
        className="absolute -bottom-1.5 left-3 right-3 h-4 rounded-b-xl blur-sm -z-10"
        style={{ background: "rgba(15, 23, 42, 0.10)" }}
      />

      {/* Card */}
      <div
        className="rounded-xl border border-slate-200 shadow-xl overflow-hidden"
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          backgroundImage: "repeating-linear-gradient(transparent, transparent 30px, #f1f5f9 30px, #f1f5f9 31px)",
          backgroundPositionY: "46px",
          padding: "18px 22px 76px 22px",
          position: "relative",
        }}
      >
        {/* Dealership header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: "1px solid #E0E7FF",
            paddingBottom: "6px",
            marginBottom: "14px",
          }}
        >
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={dealershipName}
              style={{ height: "22px", width: "auto", maxWidth: "64px", objectFit: "contain", display: "block" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "9px",
            fontWeight: 700,
            color: "#6366F1",
            letterSpacing: "0.09em",
            textTransform: "uppercase",
          }}>
            {dealershipName}
          </span>
        </div>

        {/* Handwritten message */}
        <HandwrittenContent text={content} fontSize={16} lineHeight={1.8} />

        {/* Offer callout */}
        {offer && (
          <div
            style={{
              marginTop: "12px",
              padding: "7px 11px",
              background: "#EEF2FF",
              borderLeft: "3px solid #6366F1",
              borderRadius: "4px",
              fontSize: "11px",
              color: "#3730A3",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
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
            width={56}
            height={56}
            style={{ display: "block", borderRadius: "5px", border: "1px solid #E2E8F0" }}
          />
          <div style={{ fontSize: "7px", color: "#94a3b8", marginTop: "3px", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "0.04em" }}>
            SCAN FOR OFFER
          </div>
        </div>
      </div>

      {/* Back side badge */}
      <div className="mt-2 text-center">
        <span className="chip chip-slate text-[10px]">↑ Front · Back has mailing address + postage area</span>
      </div>
    </div>
  );
}

// ── Letter Preview ────────────────────────────────────────────

function LetterPreview({
  content,
  dealershipName,
  templateType,
  logoUrl,
}: {
  content: string;
  dealershipName: string;
  templateType: MailTemplateType;
  logoUrl?: string | null;
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "2px solid #6366F1",
          paddingBottom: "8px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={dealershipName}
              style={{ height: "30px", width: "auto", maxWidth: "80px", objectFit: "contain", display: "block" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "15px", fontWeight: 700, color: "#1E2937" }}>
            {dealershipName}
          </span>
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "8px", color: "#94A3B8", textAlign: "right", fontWeight: 500 }}>
          {today}
        </div>
      </div>

      {/* Body */}
      <HandwrittenContent text={content} fontSize={14} lineHeight={1.85} />
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
  logoUrl,
}: TemplatePreviewProps) {
  const qrUrl = qrPropUrl ?? buildPreviewQRImageUrl(
    `${typeof window !== "undefined" ? window.location.origin : ""}/track/preview`,
    80
  );

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
        <Postcard6x9Preview
          content={content}
          dealershipName={dealershipName}
          offer={offer}
          qrPreviewUrl={qrUrl}
          logoUrl={logoUrl}
        />
      ) : (
        <LetterPreview
          content={content}
          dealershipName={dealershipName}
          templateType={templateType}
          logoUrl={logoUrl}
        />
      )}
    </div>
  );
}
