/**
 * 700Credit / Experian integration — FCRA-safe soft pull.
 *
 * COMPLIANCE REQUIREMENTS (do not alter):
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. PERMISSIBLE PURPOSE: Soft pulls are only permitted for customers who have
 *    an existing relationship with the dealership (i.e., visit history ≥ 1).
 *    Never pull credit for prospect-only or conquest-only contacts.
 *
 * 2. SOFT PULL ONLY: This integration ONLY performs soft inquiries (account
 *    review / pre-qualification). Hard inquiries (which affect consumer credit
 *    scores) are NOT initiated here and must go through a separate F&I workflow.
 *
 * 3. ADVERSE ACTION: If any adverse action is taken based on credit data,
 *    the dealership is required to send an Adverse Action Notice (AANs) per
 *    FCRA § 615(a). This system does NOT automate AANs — route through F&I.
 *
 * 4. DATA RETENTION: Credit data returned here must not be stored beyond 90
 *    days per the 700Credit data agreement. Use the `expiresAt` field.
 *
 * 5. DISCLOSURE: The verbatim disclosure below MUST be presented to any
 *    consumer-facing UI before a soft pull is initiated. Do not paraphrase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** FCRA verbatim disclosure — do not alter this string. */
export const FCRA_SOFT_PULL_DISCLOSURE = `By proceeding, you authorize ${"{dealershipName}"} and its financing partners to obtain a soft credit inquiry from Experian and/or other consumer reporting agencies. This is a soft inquiry and will NOT affect your credit score. This inquiry may be used to pre-qualify you for financing offers and vehicle services. You have the right to request a free copy of your credit report under the Fair Credit Reporting Act (FCRA). For questions, contact the dealership or visit www.annualcreditreport.com.`;

/** FCRA adverse action notice reminder — do not alter this string. */
export const FCRA_ADVERSE_ACTION_REMINDER = `NOTICE: If adverse action is taken based on information in a consumer credit report, you must provide the consumer with an Adverse Action Notice as required by FCRA § 615(a). Contact your F&I department or legal counsel before taking any adverse action.`;

// ── API types ─────────────────────────────────────────────────

export interface SoftPullConfig {
  /** 700Credit API endpoint */
  baseUrl: string;
  /** API key from 700Credit partner portal */
  apiKey: string;
  /** Dealer code assigned by 700Credit */
  dealerCode: string;
}

export interface SoftPullRequest {
  firstName: string;
  lastName: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  ssn?: string;          // last 4 digits only — never collect full SSN here
  dateOfBirth?: string;  // YYYY-MM-DD
}

export interface SoftPullScore {
  bureau: "experian" | "equifax" | "transunion";
  score: number;
  scoreModel: string;
  riskGrade: "A" | "B" | "C" | "D" | "F";
  /** Factors that may lower the score (verbatim from bureau) */
  adverseFactors: string[];
}

export interface SoftPullResult {
  requestId: string;
  customerId: string;
  dealershipId: string;
  scores: SoftPullScore[];
  /** ISO timestamp — data must not be stored beyond this date */
  expiresAt: string;
  /** Bureau reference number for dispute resolution */
  referenceNumber: string | null;
  pulledAt: string;
}

export interface SoftPullError {
  code: string;
  message: string;
  retryable: boolean;
}

// ── Visit history gate ────────────────────────────────────────

export interface VisitGateResult {
  permitted: boolean;
  visitCount: number;
  reason: string;
}

/**
 * Gate: customer must have at least one visit in the dealership's records.
 * Call this BEFORE initiating any soft pull.
 */
export function checkVisitHistoryGate(visitCount: number): VisitGateResult {
  if (visitCount >= 1) {
    return {
      permitted: true,
      visitCount,
      reason: "Customer has existing visit history — permissible purpose established.",
    };
  }
  return {
    permitted: false,
    visitCount,
    reason:
      "Soft pull not permitted: customer has no visit history with this dealership. " +
      "FCRA permissible purpose (account review) requires an existing business relationship.",
  };
}

// ── 700Credit client ──────────────────────────────────────────

export class SevenHundredCreditClient {
  private config: SoftPullConfig;

  constructor(config: SoftPullConfig) {
    this.config = config;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.config.apiKey,
        "X-Dealer-Code": this.config.dealerCode,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { code?: string; message?: string };
      throw {
        code: err.code ?? `HTTP_${res.status}`,
        message: err.message ?? `700Credit API error ${res.status}`,
        retryable: res.status >= 500,
      } as SoftPullError;
    }

    return res.json() as Promise<T>;
  }

  /**
   * Perform a soft credit pull.
   *
   * IMPORTANT: Call `checkVisitHistoryGate()` and verify `permitted === true`
   * before calling this method. Soft pulls on customers without visit history
   * may violate FCRA permissible purpose requirements.
   */
  async softPull(
    request: SoftPullRequest,
    customerId: string,
    dealershipId: string
  ): Promise<SoftPullResult> {
    const raw = await this.post<{
      requestId: string;
      referenceNumber: string | null;
      scores: Array<{
        bureau: string;
        score: number;
        scoreModel: string;
        riskGrade: string;
        adverseFactors: string[];
      }>;
    }>("/v2/softpull", {
      dealerCode: this.config.dealerCode,
      consumer: {
        firstName: request.firstName,
        lastName: request.lastName,
        address: request.address,
        ...(request.ssn ? { ssnLast4: request.ssn } : {}),
        ...(request.dateOfBirth ? { dob: request.dateOfBirth } : {}),
      },
      pullType: "soft",
      bureaus: ["experian"],
    });

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    return {
      requestId: raw.requestId,
      customerId,
      dealershipId,
      scores: raw.scores.map((s) => ({
        bureau: s.bureau as SoftPullScore["bureau"],
        score: s.score,
        scoreModel: s.scoreModel,
        riskGrade: s.riskGrade as SoftPullScore["riskGrade"],
        adverseFactors: s.adverseFactors ?? [],
      })),
      expiresAt,
      referenceNumber: raw.referenceNumber,
      pulledAt: new Date().toISOString(),
    };
  }
}

/** Format the FCRA disclosure with actual dealership name. */
export function formatFcraDisclosure(dealershipName: string): string {
  return FCRA_SOFT_PULL_DISCLOSURE.replace("{dealershipName}", dealershipName);
}

/** Map a risk grade to a human-readable financing tier description. */
export function describeRiskGrade(grade: SoftPullScore["riskGrade"]): string {
  const map: Record<SoftPullScore["riskGrade"], string> = {
    A: "Excellent credit — likely qualifies for prime financing rates",
    B: "Good credit — likely qualifies for near-prime rates",
    C: "Fair credit — may qualify for standard financing with higher rates",
    D: "Below-average credit — may require special finance options",
    F: "Poor credit — likely requires buy-here-pay-here or subprime options",
  };
  return map[grade];
}
