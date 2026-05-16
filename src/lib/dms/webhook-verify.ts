/**
 * Shared HMAC-SHA256 signature verification for CRM inbound webhooks.
 *
 * All three CRM providers (VinSolutions, Dealertrack, Elead) sign their
 * webhook payloads with HMAC-SHA256 using the secret we provide at
 * registration time.  The signature appears in a provider-specific header:
 *
 *   VinSolutions  X-VinSolutions-Signature: sha256=<hex>
 *   Dealertrack   X-DT-Signature:           <hex>          (bare)
 *   Elead         X-Elead-Signature:        sha256=<hex>
 *
 * We handle both "sha256=<hex>" and bare "<hex>" formats.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an HMAC-SHA256 webhook signature.
 *
 * @param rawBody   The raw request body string (must not be parsed first).
 * @param secret    The webhook secret stored per-connection in metadata.
 * @param sigHeader The value of the signature header sent by the CRM.
 * @returns true if the signature is valid, false otherwise.
 */
export function verifyWebhookSignature(
  rawBody: string,
  secret: string,
  sigHeader: string
): boolean {
  if (!secret || !sigHeader) return false;

  // Strip "sha256=" prefix if present (VinSolutions, Elead style)
  const provided = sigHeader.startsWith("sha256=")
    ? sigHeader.slice(7)
    : sigHeader;

  // Reject obviously malformed signatures early (avoids timingSafeEqual error)
  if (!/^[0-9a-f]+$/i.test(provided)) return false;

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided.toLowerCase(), "hex")
    );
  } catch {
    return false; // Different lengths → safe to reject
  }
}

/**
 * Generate a cryptographically random webhook secret (64 hex chars = 32 bytes).
 * Import from "node:crypto" is intentional — this runs server-side only.
 */
export function generateWebhookSecret(): string {
  // Dynamic import avoids bundling crypto in client chunks
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return randomBytes(32).toString("hex");
}

/**
 * Generate a unique webhook routing token (UUID v4).
 * Used in the query string of the webhook endpoint URL to identify which
 * dealership connection the incoming request belongs to.
 */
export function generateWebhookToken(): string {
  return crypto.randomUUID();
}
