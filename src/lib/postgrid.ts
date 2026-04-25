/**
 * PostGrid REST API client — print & mail fulfillment.
 * Docs: https://docs.postgrid.com
 *
 * Test keys (test_sk_...) produce real API responses but never print/mail anything.
 * Live keys (live_sk_...) trigger real jobs billed per piece.
 *
 * Pricing (approx as of 2024):
 *   - 6×9 Postcard: ~$0.80–$1.20 incl. postage
 *   - Letter: ~$1.20–$1.80 incl. envelope + postage
 */
import type { Customer, Dealership, MailTemplateType, LayoutSpec, DesignStyle } from "@/types";

const POSTGRID_BASE = "https://api.postgrid.com/print-mail/v1";

// ── Types ─────────────────────────────────────────────────────

export interface PostGridAddress {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  provinceOrState: string;
  postalOrZip: string;
  country: string;
}

export interface PostGridMailResult {
  id: string;
  object: "postcard" | "letter";
  status: string;
  url?: string;           // proof PDF URL
  estimatedDeliveryDate?: string;
  sendDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendMailPieceParams {
  customer: Customer;
  dealership: Dealership;
  templateType: MailTemplateType;
  personalizedText: string;
  variables: Record<string, unknown>;
  qrCodeDataUrl: string;
  trackingUrl: string;
  layoutSpec?: LayoutSpec;
  designStyle?: DesignStyle;
}

// ── Address helpers ───────────────────────────────────────────

function customerToAddress(customer: Customer): PostGridAddress {
  const addr = customer.address ?? {};
  return {
    firstName: customer.first_name,
    lastName: customer.last_name,
    addressLine1: addr.street ?? "123 Main St",     // fallback — validate upstream
    city: addr.city ?? "Phoenix",
    provinceOrState: addr.state ?? "AZ",
    postalOrZip: addr.zip ?? "85001",
    country: "US",
  };
}

function dealershipToAddress(dealership: Dealership): PostGridAddress {
  const addr = dealership.address ?? {};
  return {
    companyName: dealership.name,
    addressLine1: addr.street ?? "123 Auto Row",
    city: addr.city ?? "Phoenix",
    provinceOrState: addr.state ?? "AZ",
    postalOrZip: addr.zip ?? "85001",
    country: "US",
  };
}

// ── HTML Template builders ────────────────────────────────────
// PostGrid renders HTML to PDF via headless Chromium.
// Fonts from Google Fonts are supported. Inline CSS recommended.

export function buildPostcardFrontHTML(
  personalizedText: string,
  dealershipName: string,
  qrCodeDataUrl: string,
  variables: Record<string, unknown> = {}
): string {
  // Newline → <br> for rendering in HTML
  const htmlText = personalizedText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .join("<br>");

  const vehicle = variables.vehicle ? `<p style="font-size:11pt;color:#6b7280;margin-top:6pt;">${variables.vehicle}</p>` : "";
  const offer = variables.offer ? `<div style="margin-top:12pt;padding:8pt 12pt;background:#eff6ff;border-left:3pt solid #2563eb;border-radius:4pt;font-size:11pt;color:#1e40af;">${variables.offer}</div>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 6in;
    height: 9in;
    background: #fefce8;
    padding: 0.45in 0.5in;
    position: relative;
    overflow: hidden;
  }
  /* Subtle ruled lines — like cream stationery */
  body::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: repeating-linear-gradient(
      transparent, transparent 29pt, #e5e7eb 29pt, #e5e7eb 30pt
    );
    opacity: 0.5;
    pointer-events: none;
  }
  .header {
    font-family: 'Inter', sans-serif;
    font-size: 9pt;
    font-weight: 600;
    color: #2563eb;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 14pt;
    border-bottom: 1pt solid #dbeafe;
    padding-bottom: 6pt;
  }
  .message {
    font-family: 'Caveat', cursive;
    font-size: 18pt;
    line-height: 1.7;
    color: #1f2937;
    position: relative;
    z-index: 1;
  }
  .qr-block {
    position: absolute;
    bottom: 0.4in;
    right: 0.4in;
    text-align: center;
  }
  .qr-block img {
    width: 72pt;
    height: 72pt;
    display: block;
  }
  .qr-label {
    font-family: 'Inter', sans-serif;
    font-size: 7pt;
    color: #6b7280;
    margin-top: 4pt;
  }
</style>
</head>
<body>
  <div class="header">${dealershipName}</div>
  <div class="message">
    ${htmlText}
    ${vehicle}
    ${offer}
  </div>
  <div class="qr-block">
    <img src="${qrCodeDataUrl}" alt="QR Code" />
    <div class="qr-label">Scan for offer</div>
  </div>
</body>
</html>`;
}

export function buildPostcardBackHTML(
  customerName: string,
  dealershipName: string,
  dealershipAddress: PostGridAddress
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 6in;
    height: 9in;
    background: #ffffff;
    font-family: 'Inter', sans-serif;
    position: relative;
  }
  /* Vertical center divider (standard postcard back layout) */
  .divider {
    position: absolute;
    left: 50%;
    top: 0.5in;
    bottom: 0.5in;
    width: 1pt;
    background: #e5e7eb;
  }
  /* Left side: return address + message area */
  .left {
    position: absolute;
    left: 0.25in;
    top: 0.4in;
    width: 2.6in;
  }
  .return-address {
    font-size: 8pt;
    color: #374151;
    line-height: 1.5;
  }
  .return-name {
    font-weight: 600;
    color: #111827;
  }
  /* Right side: stamp + mailing address */
  .right {
    position: absolute;
    right: 0.25in;
    top: 0.4in;
    width: 2.6in;
  }
  .stamp-area {
    width: 1in;
    height: 1.25in;
    border: 1.5pt dashed #d1d5db;
    border-radius: 4pt;
    float: right;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .stamp-text {
    font-size: 7pt;
    color: #9ca3af;
    text-align: center;
    line-height: 1.4;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .mailing-address {
    clear: both;
    margin-top: 0.6in;
    font-size: 11pt;
    line-height: 1.6;
    color: #111827;
  }
  .lines {
    margin-top: 0.9in;
  }
  .write-line {
    border-bottom: 1pt solid #e5e7eb;
    height: 24pt;
    margin-bottom: 4pt;
  }
  .write-label {
    font-size: 7pt;
    color: #9ca3af;
    margin-bottom: 20pt;
  }
  /* USPS barcode area */
  .usps-bar {
    position: absolute;
    bottom: 0.2in;
    left: 0.25in;
    right: 0.25in;
    height: 12pt;
    display: flex;
    gap: 2pt;
    align-items: flex-end;
  }
</style>
</head>
<body>
  <div class="divider"></div>

  <!-- Left: return address -->
  <div class="left">
    <div class="return-address">
      <div class="return-name">${dealershipName}</div>
      <div>${dealershipAddress.addressLine1}</div>
      <div>${dealershipAddress.city}, ${dealershipAddress.provinceOrState} ${dealershipAddress.postalOrZip}</div>
    </div>
    <div class="lines">
      <div class="write-label">Personal message:</div>
      <div class="write-line"></div>
      <div class="write-line"></div>
      <div class="write-line"></div>
    </div>
  </div>

  <!-- Right: stamp + address -->
  <div class="right">
    <div class="stamp-area">
      <div class="stamp-text">First<br>Class<br>Mail</div>
    </div>
    <div class="mailing-address">
      <!-- PostGrid injects the recipient address here via their template engine -->
      {{to.firstName}} {{to.lastName}}<br>
      {{to.addressLine1}}<br>
      {{to.city}}, {{to.provinceOrState}} {{to.postalOrZip}}
    </div>
  </div>
</body>
</html>`;
}

export function buildLetterHTML(
  personalizedText: string,
  dealershipName: string,
  dealershipAddress: PostGridAddress,
  customerName: string,
  variables: Record<string, unknown> = {}
): string {
  const htmlText = personalizedText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .join("<br>");

  const today = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 8.5in;
    min-height: 11in;
    background: #ffffff;
    padding: 1in 1.25in;
    font-family: 'Caveat', cursive;
    color: #1f2937;
  }
  .letterhead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5in;
    padding-bottom: 12pt;
    border-bottom: 2pt solid #2563eb;
  }
  .dealer-name {
    font-family: 'Inter', sans-serif;
    font-size: 18pt;
    font-weight: 600;
    color: #1e3a8a;
  }
  .dealer-info {
    font-family: 'Inter', sans-serif;
    font-size: 9pt;
    color: #6b7280;
    text-align: right;
    line-height: 1.5;
  }
  .date {
    font-family: 'Inter', sans-serif;
    font-size: 10pt;
    color: #6b7280;
    margin-bottom: 20pt;
  }
  .salutation {
    font-size: 18pt;
    margin-bottom: 10pt;
    color: #374151;
  }
  .body {
    font-size: 17pt;
    line-height: 1.85;
    color: #1f2937;
  }
  .signature {
    margin-top: 30pt;
    font-size: 16pt;
    color: #374151;
  }
  .footer {
    margin-top: 0.6in;
    padding-top: 10pt;
    border-top: 1pt solid #e5e7eb;
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    color: #9ca3af;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="letterhead">
    <div class="dealer-name">${dealershipName}</div>
    <div class="dealer-info">
      ${dealershipAddress.addressLine1}<br>
      ${dealershipAddress.city}, ${dealershipAddress.provinceOrState} ${dealershipAddress.postalOrZip}<br>
      ${variables.phone ? `${variables.phone}` : ""}
    </div>
  </div>

  <div class="date">${today}</div>

  <div class="body">
    ${htmlText}
  </div>

  <div class="footer">
    © ${new Date().getFullYear()} ${dealershipName} · This is a personalized communication for ${customerName}
  </div>
</body>
</html>`;
}

// ── Advanced HTML builders ────────────────────────────────────

export function buildMultiPanelPostcardHTML(
  personalizedText: string,
  dealershipName: string,
  qrCodeDataUrl: string,
  layoutSpec: LayoutSpec,
  variables: Record<string, unknown> = {}
): string {
  const front = layoutSpec.panels.find((p) => p.role === "front") ?? layoutSpec.panels[0];
  const cs = layoutSpec.colorScheme;
  const imgZone = front?.imageZone;
  const heroSrc = imgZone?.imageUrl ?? "";
  const heroHeight = imgZone?.heightPx ?? 200;
  const headline = front?.headline ?? dealershipName;
  const cta = front?.cta ?? "Schedule Now";
  const offer = variables.offer as string | undefined;

  const htmlBody = personalizedText
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .split("\n").join("<br>");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<!-- PRINT HOUSE NOTE: Multi-panel 6x9 postcard. Bleed 0.125in all sides. Safe zone 0.125in inside trim. -->
${layoutSpec.dieCutInstructions ? `<!-- DIE-CUT: ${layoutSpec.dieCutInstructions} -->` : ""}
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 6in; height: 9in; background: ${cs.background}; overflow: hidden; font-family: 'Inter', sans-serif; position: relative; }
  .hero {
    width: 100%; height: ${heroHeight}px;
    background: ${cs.primary}33;
    ${heroSrc ? `background-image: url('${heroSrc}'); background-size: cover; background-position: center;` : ""}
    display: flex; align-items: flex-end;
    padding: 0 0.4in 16pt;
    position: relative;
  }
  .hero::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(to bottom, transparent 30%, ${cs.primary}99 100%);
  }
  .hero-headline {
    font-size: 22pt; font-weight: 800; color: #fff;
    line-height: 1.15; position: relative; z-index: 1;
    text-shadow: 0 2px 8px rgba(0,0,0,0.4);
    max-width: 4.2in;
  }
  .dealership-badge {
    position: absolute; top: 12pt; left: 0.4in;
    font-size: 8pt; font-weight: 700; color: rgba(255,255,255,0.9);
    letter-spacing: 0.08em; text-transform: uppercase;
    background: ${cs.primary}cc; padding: 3pt 8pt; border-radius: 2pt;
    z-index: 2;
  }
  .content { padding: 14pt 0.4in 0; }
  .message {
    font-family: 'Caveat', cursive; font-size: 17pt; line-height: 1.75;
    color: ${cs.text}; margin-bottom: 12pt;
  }
  .offer-strip {
    background: ${cs.accent}22; border-left: 4pt solid ${cs.accent};
    padding: 7pt 12pt; border-radius: 0 4pt 4pt 0;
    font-size: 11pt; font-weight: 700; color: ${cs.primary};
    margin-bottom: 12pt;
  }
  .cta-row { display: flex; align-items: center; gap: 16pt; }
  .cta-btn {
    background: ${cs.accent}; color: ${cs.accentIsNeon ? "#000" : "#fff"};
    font-size: 11pt; font-weight: 800; padding: 8pt 18pt; border-radius: 4pt;
    letter-spacing: 0.02em; text-transform: uppercase; white-space: nowrap;
  }
  .qr-block { text-align: center; }
  .qr-block img { width: 58pt; height: 58pt; border-radius: 4pt; }
  .qr-label { font-size: 6.5pt; color: #94a3b8; margin-top: 2pt; font-family: 'Inter'; letter-spacing: 0.04em; }
</style>
</head>
<body>
  <div class="hero">
    <div class="dealership-badge">${dealershipName}</div>
    ${heroSrc ? "" : `<!-- PRINT HOUSE: Place hero vehicle image here — ${imgZone?.placeholder ?? "Exterior vehicle photo"} -->`}
    <div class="hero-headline">${headline}</div>
  </div>
  <div class="content">
    <div class="message">${htmlBody}</div>
    ${offer ? `<div class="offer-strip">${offer}</div>` : ""}
    <div class="cta-row">
      <div class="cta-btn">${cta}</div>
      <div class="qr-block">
        <img src="${qrCodeDataUrl}" alt="Scan for offer">
        <div class="qr-label">SCAN FOR OFFER</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildPremiumFluorescentHTML(
  personalizedText: string,
  dealershipName: string,
  qrCodeDataUrl: string,
  layoutSpec: LayoutSpec,
  variables: Record<string, unknown> = {}
): string {
  const front = layoutSpec.panels.find((p) => p.role === "front") ?? layoutSpec.panels[0];
  const cs = layoutSpec.colorScheme;
  const bg = cs.background || "#0F172A";
  const accent = cs.accent || "#FFE500";
  const textColor = cs.text || "#F1F5F9";
  const headline = front?.headline ?? "We've saved a spot for you.";
  const subheadline = front?.subheadline ?? "";
  const cta = front?.cta ?? "Book Your Appointment";
  const offer = variables.offer as string | undefined;
  const isNeon = cs.accentIsNeon !== false;

  const htmlBody = personalizedText
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .split("\n").join("<br>");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<!-- PRINT HOUSE NOTE: Premium fluorescent postcard. Accent color ${accent} = ${isNeon ? "NEON/FLUORESCENT INK — specify Pantone fluorescent equivalent. " : ""}Use 100lb gloss cover stock. Bleed 0.125in. -->
${layoutSpec.printNotes ? `<!-- PRINT SPECS: ${layoutSpec.printNotes} -->` : ""}
${layoutSpec.dieCutInstructions ? `<!-- DIE-CUT: ${layoutSpec.dieCutInstructions} -->` : ""}
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 6in; height: 9in; background: ${bg}; overflow: hidden; font-family: 'Inter', sans-serif; position: relative; }
  /* Subtle texture overlay */
  body::before {
    content: ''; position: absolute; inset: 0; opacity: 0.03;
    background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0);
    background-size: 24pt 24pt;
  }
  .accent-bar { height: 6pt; background: ${accent}; width: 100%; }
  .content { padding: 0.35in 0.45in; position: relative; z-index: 1; }
  .logo-line {
    font-size: 8pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: ${accent}; margin-bottom: 20pt; opacity: 0.9;
  }
  .headline {
    font-size: 28pt; font-weight: 900; color: ${textColor}; line-height: 1.1;
    letter-spacing: -0.02em; margin-bottom: ${subheadline ? "6pt" : "18pt"};
  }
  .headline em { color: ${accent}; font-style: normal; }
  .subheadline {
    font-size: 13pt; font-weight: 400; color: ${textColor}cc;
    margin-bottom: 18pt; line-height: 1.4;
  }
  .divider { width: 32pt; height: 3pt; background: ${accent}; border-radius: 2pt; margin-bottom: 18pt; }
  .message {
    font-family: 'Caveat', cursive; font-size: 16pt; line-height: 1.75;
    color: ${textColor}dd; margin-bottom: 18pt;
  }
  ${offer ? `.offer-badge {
    display: inline-block; background: ${accent}; color: ${isNeon ? "#000" : "#fff"};
    font-size: 10pt; font-weight: 800; padding: 6pt 14pt; border-radius: 3pt;
    letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 18pt;
  }` : ""}
  .cta-row { display: flex; align-items: center; gap: 18pt; }
  .cta-btn {
    background: ${accent}; color: ${isNeon ? "#000" : "#fff"};
    font-size: 11pt; font-weight: 900; padding: 10pt 20pt; border-radius: 3pt;
    letter-spacing: 0.03em; text-transform: uppercase;
  }
  .qr-wrap { text-align: center; }
  .qr-wrap img { width: 56pt; height: 56pt; border-radius: 4pt; border: 1.5pt solid ${accent}44; }
  .qr-label { font-size: 6pt; color: ${textColor}66; margin-top: 3pt; letter-spacing: 0.06em; }
  .bottom-bar {
    position: absolute; bottom: 0; left: 0; right: 0; height: 0.45in;
    background: ${accent}18; border-top: 1pt solid ${accent}33;
    display: flex; align-items: center; padding: 0 0.45in;
    font-size: 8pt; color: ${textColor}55; font-weight: 500; gap: 6pt;
  }
  .bottom-bar strong { color: ${accent}; }
</style>
</head>
<body>
  <div class="accent-bar"></div>
  <div class="content">
    <div class="logo-line">${dealershipName}</div>
    <div class="headline">${headline}</div>
    ${subheadline ? `<div class="subheadline">${subheadline}</div>` : ""}
    <div class="divider"></div>
    <div class="message">${htmlBody}</div>
    ${offer ? `<div class="offer-badge">${offer}</div>` : ""}
    <div class="cta-row">
      <div class="cta-btn">${cta}</div>
      <div class="qr-wrap">
        <img src="${qrCodeDataUrl}" alt="Scan">
        <div class="qr-label">SCAN TO BOOK</div>
      </div>
    </div>
  </div>
  <div class="bottom-bar">
    <!-- PRINT HOUSE: Ensure accent color is fluorescent ink -->
    <strong>${dealershipName}</strong> · Personal appointment offer
  </div>
</body>
</html>`;
}

export function buildComplexFoldHTML(
  dealershipName: string,
  dealershipAddress: PostGridAddress,
  customerName: string,
  layoutSpec: LayoutSpec,
  qrCodeDataUrl: string,
  variables: Record<string, unknown> = {}
): string {
  const cover = layoutSpec.panels.find((p) => p.role === "cover") ?? layoutSpec.panels[0];
  const innerLeft = layoutSpec.panels.find((p) => p.role === "inner-left") ?? layoutSpec.panels[1];
  const innerRight = layoutSpec.panels.find((p) => p.role === "inner-right") ?? layoutSpec.panels[2];
  const cs = layoutSpec.colorScheme;
  const accent = cs.accent || "#2563EB";
  const isNeon = cs.accentIsNeon ?? false;
  const offer = variables.offer as string | undefined;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  function toHtml(text: string) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").split("\n").join("<br>");
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<!-- PRINT HOUSE NOTE: TRI-FOLD letter on 8.5x11 stock. -->
<!-- FOLD INSTRUCTIONS: ${layoutSpec.foldInstructions ?? "Standard letter fold: fold bottom third up, then top third down (C-fold)."} -->
${layoutSpec.dieCutInstructions ? `<!-- DIE-CUT: ${layoutSpec.dieCutInstructions} -->` : ""}
${layoutSpec.printNotes ? `<!-- PRINT SPECS: ${layoutSpec.printNotes} -->` : ""}
<!-- Three equal horizontal panels: Cover (bottom), Inner-Left (middle), Inner-Right (top when unfolded) -->
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 8.5in; background: #fff; font-family: 'Inter', sans-serif; }
  /* Three panels stacked vertically = three horizontal fold panels */
  .panel { width: 8.5in; height: 3.667in; position: relative; overflow: hidden; }
  /* ── Cover panel ─── */
  .panel-cover { background: ${cs.background || cs.primary || "#0F172A"}; }
  .cover-inner { padding: 0.45in 0.6in; display: flex; flex-direction: column; justify-content: center; height: 100%; }
  .cover-logo { font-size: 9pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${accent}; margin-bottom: 12pt; }
  .cover-headline { font-size: 30pt; font-weight: 900; color: #fff; line-height: 1.1; margin-bottom: 8pt; }
  .cover-sub { font-size: 12pt; color: rgba(255,255,255,0.6); line-height: 1.4; }
  .cover-accent-bar { position: absolute; right: 0; top: 0; bottom: 0; width: 0.35in; background: ${accent}; }
  /* ── Inner-left panel ─── */
  .panel-inner-left { background: #FAFAFA; border-top: 1pt dashed #E2E8F0; border-bottom: 1pt dashed #E2E8F0; }
  .inner-left-content { padding: 0.4in 0.55in; }
  .inner-date { font-size: 9pt; color: #94a3b8; margin-bottom: 8pt; }
  .inner-name { font-size: 13pt; font-weight: 700; color: #1e293b; margin-bottom: 12pt; }
  .inner-message { font-family: 'Caveat', cursive; font-size: 16pt; line-height: 1.8; color: #334155; }
  /* ── Inner-right (action) panel ─── */
  .panel-inner-right { background: #fff; }
  .action-content { padding: 0.4in 0.55in; display: grid; grid-template-columns: 1fr auto; gap: 0.3in; height: 100%; align-content: start; }
  .action-left {}
  .action-headline { font-size: 14pt; font-weight: 800; color: #1e293b; margin-bottom: 10pt; }
  ${offer ? `.offer-box {
    background: ${accent}15; border: 2pt solid ${accent};
    padding: 10pt 14pt; border-radius: 4pt; margin-bottom: 12pt;
    font-size: 11pt; font-weight: 700; color: ${accent}; line-height: 1.4;
  }` : ""}
  .business-card { font-size: 9pt; color: #64748b; line-height: 1.7; border-top: 1pt solid #e2e8f0; padding-top: 10pt; }
  .business-name { font-size: 11pt; font-weight: 700; color: #1e293b; }
  .action-right { display: flex; flex-direction: column; align-items: center; gap: 6pt; padding-top: 2pt; }
  .qr-img { width: 80pt; height: 80pt; border-radius: 4pt; border: 1.5pt solid #e2e8f0; }
  .qr-label { font-size: 7pt; color: #94a3b8; letter-spacing: 0.06em; text-align: center; line-height: 1.4; }
  .cta-btn {
    background: ${accent}; color: ${isNeon ? "#000" : "#fff"};
    font-size: 9pt; font-weight: 800; padding: 6pt 12pt; border-radius: 3pt;
    letter-spacing: 0.04em; text-transform: uppercase; text-align: center; width: 80pt;
  }
</style>
</head>
<body>

<!-- ══ COVER PANEL (visible when folded — back of mailer) ══ -->
<div class="panel panel-cover">
  <div class="cover-inner">
    <div class="cover-logo">${dealershipName}</div>
    <div class="cover-headline">${cover?.headline ?? "We'd love to see you again."}</div>
    <div class="cover-sub">${cover?.subheadline ?? "A personal note from your service team."}</div>
  </div>
  <div class="cover-accent-bar"></div>
</div>

<!-- ══ INNER-LEFT PANEL (personalized story) ══ -->
<div class="panel panel-inner-left">
  <div class="inner-left-content">
    <div class="inner-date">${today}</div>
    <div class="inner-name">Dear ${customerName},</div>
    <div class="inner-message">${toHtml(innerLeft?.body ?? "")}</div>
  </div>
</div>

<!-- ══ INNER-RIGHT PANEL (action / offer / business card) ══ -->
<div class="panel panel-inner-right">
  <div class="action-content">
    <div class="action-left">
      <div class="action-headline">${innerRight?.headline ?? "Ready when you are."}</div>
      ${offer ? `<div class="offer-box">${offer}</div>` : ""}
      <div class="business-card">
        <div class="business-name">${dealershipName}</div>
        <div>${dealershipAddress.addressLine1}</div>
        <div>${dealershipAddress.city}, ${dealershipAddress.provinceOrState} ${dealershipAddress.postalOrZip}</div>
        ${variables.phone ? `<div>${variables.phone}</div>` : ""}
      </div>
    </div>
    <div class="action-right">
      <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-img">
      <div class="qr-label">SCAN TO<br>SCHEDULE</div>
      <div class="cta-btn">${innerRight?.cta ?? "Book Now"}</div>
    </div>
  </div>
</div>

</body>
</html>`;
}

// ── PostGrid API calls ────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.POSTGRID_API_KEY;
  if (!key) throw new Error("POSTGRID_API_KEY environment variable is not set");
  return key;
}

async function postGridRequest<T>(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${POSTGRID_BASE}${path}`, {
    method,
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`PostGrid API error ${res.status}: ${errBody}`);
  }

  return res.json() as Promise<T>;
}

async function sendPostcard(params: {
  to: PostGridAddress;
  from: PostGridAddress;
  front: string;
  back: string;
  size: "6x9";
  description?: string;
}): Promise<PostGridMailResult> {
  return postGridRequest<PostGridMailResult>("/postcards", "POST", {
    to: params.to,
    from: params.from,
    front: params.front,
    back: params.back,
    size: params.size,
    description: params.description,
  });
}

async function sendLetter(params: {
  to: PostGridAddress;
  from: PostGridAddress;
  html: string;
  doubleSided?: boolean;
  description?: string;
}): Promise<PostGridMailResult> {
  return postGridRequest<PostGridMailResult>("/letters", "POST", {
    to: params.to,
    from: params.from,
    html: params.html,
    doubleSided: params.doubleSided ?? false,
    description: params.description,
  });
}

export async function getMailStatus(
  type: "postcard" | "letter",
  postgridId: string
): Promise<PostGridMailResult> {
  const path = type === "postcard" ? `/postcards/${postgridId}` : `/letters/${postgridId}`;
  return postGridRequest<PostGridMailResult>(path, "GET");
}

// ── Main unified send function ────────────────────────────────

export async function sendMailPiece(
  params: SendMailPieceParams
): Promise<PostGridMailResult & { isTestMode: boolean }> {
  const toAddr = customerToAddress(params.customer);
  const fromAddr = dealershipToAddress(params.dealership);
  const description = `AutoCDP: ${params.dealership.name} → ${params.customer.first_name} ${params.customer.last_name}`;
  const isTestMode = (process.env.POSTGRID_API_KEY ?? "").startsWith("test_");

  let result: PostGridMailResult;

  const spec = params.layoutSpec;
  const designStyle = spec?.style ?? params.designStyle ?? "standard";

  if (params.templateType === "postcard_6x9") {
    let front: string;
    if (designStyle === "multi-panel" && spec) {
      front = buildMultiPanelPostcardHTML(params.personalizedText, params.dealership.name, params.qrCodeDataUrl, spec, params.variables);
    } else if (designStyle === "premium-fluorescent" && spec) {
      front = buildPremiumFluorescentHTML(params.personalizedText, params.dealership.name, params.qrCodeDataUrl, spec, params.variables);
    } else {
      front = buildPostcardFrontHTML(params.personalizedText, params.dealership.name, params.qrCodeDataUrl, params.variables);
    }
    const back = buildPostcardBackHTML(
      `${params.customer.first_name} ${params.customer.last_name}`,
      params.dealership.name,
      fromAddr
    );
    result = await sendPostcard({ to: toAddr, from: fromAddr, front, back, size: "6x9", description });
  } else {
    // letter_6x9, letter_8.5x11 — use complex-fold builder when spec present
    let html: string;
    if (designStyle === "complex-fold" && spec) {
      html = buildComplexFoldHTML(
        params.dealership.name,
        fromAddr,
        `${params.customer.first_name} ${params.customer.last_name}`,
        spec,
        params.qrCodeDataUrl,
        { ...params.variables, phone: params.dealership.phone ?? undefined }
      );
    } else {
      html = buildLetterHTML(
        params.personalizedText,
        params.dealership.name,
        fromAddr,
        `${params.customer.first_name} ${params.customer.last_name}`,
        { ...params.variables, phone: params.dealership.phone ?? undefined }
      );
    }
    result = await sendLetter({ to: toAddr, from: fromAddr, html, description });
  }

  return { ...result, isTestMode };
}

// ── PostGrid webhook event types ──────────────────────────────

export const POSTGRID_WEBHOOK_EVENTS = [
  "mail.created",
  "mail.rendered",
  "mail.in_transit",
  "mail.processed_for_delivery",
  "mail.delivered",
  "mail.returned_to_sender",
] as const;

export type PostGridWebhookEvent = (typeof POSTGRID_WEBHOOK_EVENTS)[number];

// Maps PostGrid event → our mail_piece_status
export const POSTGRID_STATUS_MAP: Record<string, string> = {
  "mail.created": "processing",
  "mail.rendered": "in_production",
  "mail.in_transit": "in_transit",
  "mail.processed_for_delivery": "in_transit",
  "mail.delivered": "delivered",
  "mail.returned_to_sender": "returned",
};
