/**
 * Structured error type for CRM write-back failures.
 *
 * Every push function in the DMS adapters (vinsolutions.ts, dealertrack.ts,
 * elead.ts) throws a WritebackError when the upstream API returns an error.
 * The retry queue inspects `isRetryable` to decide whether to schedule a
 * retry or immediately mark the row as dead.
 */

export class WritebackError extends Error {
  /** HTTP status code from the upstream CRM API (0 = network / unknown) */
  readonly httpStatus: number;
  /** Raw response body string (best-effort) */
  readonly errorBody: string;
  /** True for transient failures (5xx, 429, 0) — should be retried */
  readonly isRetryable: boolean;

  constructor(message: string, httpStatus: number, errorBody = "") {
    super(message);
    this.name = "WritebackError";
    this.httpStatus = httpStatus;
    this.errorBody = errorBody;
    // 4xx (except 429 rate-limit) are permanent client errors — no retry
    this.isRetryable =
      httpStatus === 0 ||
      httpStatus === 429 ||
      httpStatus >= 500;
  }
}

/**
 * Helper: try to parse a fetch Response into a WritebackError.
 * Reads the body text (best-effort) so the error includes context.
 */
export async function responseToWritebackError(
  res: Response,
  context: string
): Promise<WritebackError> {
  let body = "";
  try { body = await res.text(); } catch { /* ignore */ }
  return new WritebackError(
    `${context} → HTTP ${res.status}`,
    res.status,
    body.slice(0, 500)
  );
}
