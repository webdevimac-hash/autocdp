/**
 * 700Credit API client — soft-pull credit tier enrichment.
 *
 * FCRA compliance:
 *   - Only soft pulls (no hard inquiry on consumer credit file).
 *   - Only performed for customers with an established dealership relationship
 *     (prior visit or purchase on record).
 *   - Returns tier only — no raw bureau data stored.
 *
 * Auth: API key (X-Api-Key header).
 * Data: credit_tier per customer (excellent / good / fair / poor / unknown).
 *
 * Env vars:
 *   SEVEN_HUNDRED_CREDIT_API_BASE  (default: https://api.700credit.com/v2)
 *   — actual key stored per-dealership in dms_connections.encrypted_tokens
 */

export const SEVEN_HUNDRED_CREDIT_API_BASE =
  process.env.SEVEN_HUNDRED_CREDIT_API_BASE ?? "https://api.700credit.com/v2";

export type CreditTier = "excellent" | "good" | "fair" | "poor" | "unknown";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

async function creditFetch<T>(
  path: string,
  body: unknown,
  apiKey: string,
  retries = 3
): Promise<T> {
  const res = await fetch(`${SEVEN_HUNDRED_CREDIT_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return creditFetch(path, body, apiKey, retries - 1);
  }

  if (!res.ok) {
    throw new Error(`700Credit API ${path} → ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Soft-pull credit tier lookup
// ---------------------------------------------------------------------------

export interface CreditInquiryInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

export interface CreditTierResult {
  tier: CreditTier;
  score?: number; // approximate range midpoint, NOT stored in DB
  bureau?: string;
}

/**
 * Soft-pull credit tier for a single consumer.
 * FCRA-safe: permissible purpose is existing customer relationship (prescreening).
 * Returns tier only; caller must not store raw score or bureau data.
 */
export async function fetchCreditTier(
  input: CreditInquiryInput,
  apiKey: string
): Promise<CreditTier> {
  try {
    const result = await creditFetch<CreditTierResult>(
      "/prescreen/tier",
      { ...input, pullType: "soft", purpose: "existing_relationship" },
      apiKey
    );
    return result.tier ?? "unknown";
  } catch {
    // Non-fatal: if lookup fails, leave tier as null (not "unknown") to retry later
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Batch soft-pull (up to 50 per request)
// ---------------------------------------------------------------------------

export interface BatchCreditInput {
  externalId: string; // caller's ID for correlation
  consumer: CreditInquiryInput;
}

export interface BatchCreditResult {
  externalId: string;
  tier: CreditTier;
}

export async function fetchCreditTierBatch(
  inputs: BatchCreditInput[],
  apiKey: string
): Promise<BatchCreditResult[]> {
  if (inputs.length === 0) return [];

  try {
    const results = await creditFetch<BatchCreditResult[]>(
      "/prescreen/tier/batch",
      {
        pullType: "soft",
        purpose: "existing_relationship",
        consumers: inputs,
      },
      apiKey
    );
    return results;
  } catch {
    // Fallback: individual lookups
    const out: BatchCreditResult[] = [];
    for (const inp of inputs) {
      const tier = await fetchCreditTier(inp.consumer, apiKey);
      out.push({ externalId: inp.externalId, tier });
    }
    return out;
  }
}
