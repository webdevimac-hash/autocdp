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
import type { Customer, Dealership, MailTemplateType } from "@/types";

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

  if (params.templateType === "postcard_6x9") {
    const front = buildPostcardFrontHTML(
      params.personalizedText,
      params.dealership.name,
      params.qrCodeDataUrl,
      params.variables
    );
    const back = buildPostcardBackHTML(
      `${params.customer.first_name} ${params.customer.last_name}`,
      params.dealership.name,
      fromAddr
    );
    result = await sendPostcard({ to: toAddr, from: fromAddr, front, back, size: "6x9", description });
  } else {
    // letter_6x9 and letter_8.5x11 both use the letter API
    const html = buildLetterHTML(
      params.personalizedText,
      params.dealership.name,
      fromAddr,
      `${params.customer.first_name} ${params.customer.last_name}`,
      { ...params.variables, phone: params.dealership.phone ?? undefined }
    );
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
