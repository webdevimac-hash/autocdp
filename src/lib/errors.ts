/**
 * Centralized error handling for AutoCDP.
 *
 * Usage in API routes:
 *   } catch (error) {
 *     const { error: msg, code, statusCode } = toApiError(error);
 *     return NextResponse.json({ error: msg, code }, { status: statusCode });
 *   }
 */

export class AppError extends Error {
  constructor(
    public readonly userMessage: string,
    technicalDetail: string,
    public readonly statusCode = 500,
    public readonly code = "APP_ERROR"
  ) {
    super(technicalDetail);
    this.name = "AppError";
  }
}

interface ErrorRule {
  match: (msg: string) => boolean;
  userMessage: string;
  statusCode: number;
  code: string;
}

// Ordered: most specific first
const ERROR_RULES: ErrorRule[] = [
  // ── Guardrails ────────────────────────────────────────────────
  {
    match: (m) => m.includes("blocked by guardrails"),
    userMessage:
      "This copy was flagged for compliance. Try rephrasing the offer — avoid specific APR claims, guaranteed approval language, or prize claims.",
    statusCode: 422,
    code: "GUARDRAIL_BLOCK",
  },

  // ── Internal rate limits ──────────────────────────────────────
  {
    match: (m) => m.includes("DAILY_LIMIT") || m.includes("daily limit"),
    userMessage:
      "You've reached your daily limit for this action. Limits reset at midnight UTC. Contact support to increase your plan limits.",
    statusCode: 429,
    code: "DAILY_LIMIT_EXCEEDED",
  },

  // ── Scoring pre-filter ────────────────────────────────────────
  {
    match: (m) => m.includes("scored below threshold") || m.includes("below threshold"),
    userMessage:
      "All selected customers scored too low for this campaign. Try including customers with more recent visit history or a higher spend tier.",
    statusCode: 422,
    code: "SCORE_THRESHOLD",
  },

  // ── Customers not found ───────────────────────────────────────
  {
    match: (m) =>
      m.includes("CUSTOMER_NOT_FOUND") || m.includes("No valid customers"),
    userMessage:
      "No customers found for this campaign. Ensure the selected customers belong to your dealership.",
    statusCode: 404,
    code: "CUSTOMERS_NOT_FOUND",
  },

  // ── Address validation ────────────────────────────────────────
  {
    match: (m) => m.includes("INCOMPLETE_ADDRESS"),
    userMessage:
      "One or more customers have incomplete addresses. Direct mail requires a full street address, city, state, and ZIP.",
    statusCode: 422,
    code: "INCOMPLETE_ADDRESS",
  },

  // ── Anthropic / AI service ────────────────────────────────────
  {
    match: (m) =>
      m.includes("ANTHROPIC_API_KEY") ||
      m.includes("not configured") && m.includes("AI"),
    userMessage:
      "AI service is not configured. Add your ANTHROPIC_API_KEY to the environment settings.",
    statusCode: 503,
    code: "AI_NOT_CONFIGURED",
  },
  {
    match: (m) =>
      m.includes("rate_limit_error") ||
      m.includes("overloaded_error") ||
      m.includes("529"),
    userMessage:
      "The AI service is temporarily at capacity. Please wait 30 seconds and try again.",
    statusCode: 429,
    code: "AI_RATE_LIMITED",
  },
  {
    match: (m) =>
      m.includes("invalid_api_key") || m.includes("authentication_error"),
    userMessage:
      "AI API key is invalid. Check your ANTHROPIC_API_KEY in Settings.",
    statusCode: 401,
    code: "AI_AUTH_ERROR",
  },

  // ── PostGrid / Direct Mail ────────────────────────────────────
  {
    match: (m) =>
      m.includes("POSTGRID_API_KEY") ||
      (m.toLowerCase().includes("postgrid") && m.includes("not configured")),
    userMessage:
      "Direct mail service is not configured. Add your POSTGRID_API_KEY or enable Dry Run mode for testing.",
    statusCode: 503,
    code: "POSTGRID_NOT_CONFIGURED",
  },
  {
    match: (m) =>
      m.toLowerCase().includes("postgrid") && !m.includes("not configured"),
    userMessage:
      "PostGrid returned an error processing this mail piece. Check address formatting and try again.",
    statusCode: 502,
    code: "POSTGRID_ERROR",
  },

  // ── Twilio / SMS ──────────────────────────────────────────────
  {
    match: (m) =>
      m.toLowerCase().includes("twilio") || m.includes("TWILIO"),
    userMessage:
      "SMS service is not configured. Add your Twilio credentials to the environment settings.",
    statusCode: 503,
    code: "SMS_NOT_CONFIGURED",
  },

  // ── Resend / Email ────────────────────────────────────────────
  {
    match: (m) =>
      m.toLowerCase().includes("resend") && m.includes("not configured"),
    userMessage:
      "Email service is not configured. Add your RESEND_API_KEY to the environment settings.",
    statusCode: 503,
    code: "EMAIL_NOT_CONFIGURED",
  },

  // ── DMS integrations ──────────────────────────────────────────
  {
    match: (m) =>
      m.toLowerCase().includes("cdk") || m.toLowerCase().includes("fortellis"),
    userMessage:
      "Could not connect to CDK Fortellis. Check your API credentials in Integrations → CDK.",
    statusCode: 502,
    code: "DMS_CDK_ERROR",
  },
  {
    match: (m) => m.toLowerCase().includes("reynolds"),
    userMessage:
      "Could not connect to Reynolds & Reynolds. Check your credentials in Integrations → Reynolds.",
    statusCode: 502,
    code: "DMS_REYNOLDS_ERROR",
  },

  // ── Supabase / DB ─────────────────────────────────────────────
  {
    match: (m) =>
      m.includes("duplicate key") || m.includes("unique_violation"),
    userMessage:
      "This record already exists. It may have been added in a previous import.",
    statusCode: 409,
    code: "DUPLICATE_RECORD",
  },
  {
    match: (m) =>
      m.includes("JWT expired") || m.includes("invalid JWT"),
    userMessage: "Your session has expired. Please sign in again.",
    statusCode: 401,
    code: "SESSION_EXPIRED",
  },
];

export function mapError(error: unknown): {
  userMessage: string;
  technicalDetail: string;
  statusCode: number;
  code: string;
} {
  if (error instanceof AppError) {
    return {
      userMessage: error.userMessage,
      technicalDetail: error.message,
      statusCode: error.statusCode,
      code: error.code,
    };
  }

  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  for (const rule of ERROR_RULES) {
    if (rule.match(message)) {
      return {
        userMessage: rule.userMessage,
        technicalDetail: message,
        statusCode: rule.statusCode,
        code: rule.code,
      };
    }
  }

  return {
    userMessage:
      "Something went wrong. Please try again or contact support if the issue persists.",
    technicalDetail: message,
    statusCode: 500,
    code: "INTERNAL_ERROR",
  };
}

/**
 * For use in API route catch blocks.
 * Logs the technical detail server-side and returns a safe client payload.
 */
export function toApiError(error: unknown): {
  error: string;
  code: string;
  statusCode: number;
} {
  const mapped = mapError(error);
  console.error(`[AutoCDP ${mapped.code}]`, mapped.technicalDetail);
  return {
    error: mapped.userMessage,
    code: mapped.code,
    statusCode: mapped.statusCode,
  };
}
