/**
 * QR code generation helpers — server-side only (Node.js).
 * Uses the `qrcode` npm package.
 *
 * Do NOT import this in Client Components — it relies on Node.js APIs.
 * For browser previews, use the QR image URL pattern in components instead.
 */
import QRCode from "qrcode";

/**
 * Generate a QR code as a base64 PNG data URL.
 * Suitable for embedding in PostGrid HTML templates as <img src="data:image/png;base64,...">
 */
export async function generateQRDataURL(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    type: "image/png",
    width: 200,           // 200px → renders cleanly at 72pt in PostGrid
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#1e3a8a",    // brand blue dots
      light: "#fefce8",   // match postcard background
    },
  });
}

/**
 * Generate a QR code as an SVG string.
 * Useful for email templates or web previews.
 */
export async function generateQRSVG(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

/**
 * Build a tracking URL for a mail piece.
 * The /track/[id] page logs the scan and shows the dealership's landing page.
 */
export function buildTrackingUrl(mailPieceId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/track/${mailPieceId}`;
}

/**
 * Build a browser-safe QR image URL (no server required).
 * Use in Client Components for preview — not for actual mail pieces.
 */
export function buildPreviewQRImageUrl(trackingUrl: string, size = 100): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(trackingUrl)}&color=1e3a8a&bgcolor=fefce8`;
}
