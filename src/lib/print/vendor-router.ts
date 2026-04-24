/**
 * Print vendor router — selects the optimal print house per batch.
 *
 * Priority matrix:
 *   PostGrid   — default, best for < 500 pieces, same-day API, CASS/NCOA certified
 *   Taradel    — best for large postcards, Every Door Direct Mail (EDDM) campaigns
 *   PFL        — premium quality, poly-bagging, variable data at scale (500–50k)
 *   Click2Mail — USPS-native, best for First-Class letters, lowest cost for 1-off
 */

export type PrintVendor = "postgrid" | "taradel" | "pfl" | "click2mail";

export type MailFormat = "postcard_6x9" | "letter_6x9" | "letter_8.5x11";

export interface BatchRoutingInput {
  quantity: number;
  format: MailFormat;
  isEddm: boolean;           // Every Door Direct Mail (no address list)
  isPremiumQuality: boolean; // Poly-bagged, heavier stock
  isFirstClass: boolean;     // First-Class vs Standard/Marketing postage
  budgetCentsPerPiece?: number;
}

export interface VendorConfig {
  vendor: PrintVendor;
  reason: string;
  estimatedCentsPerPiece: number;
  estimatedTurnaroundDays: number;
  supportsTestMode: boolean;
  apiKeyEnvVar: string;
}

const VENDOR_SPECS: Record<PrintVendor, {
  maxQuantityOptimal: number;
  supportsEddm: boolean;
  supportsPremium: boolean;
  supportsFirstClass: boolean;
  baseCentsPerPiece: Record<MailFormat, number>;
  turnaroundDays: number;
  supportsTestMode: boolean;
  apiKeyEnvVar: string;
}> = {
  postgrid: {
    maxQuantityOptimal: 500,
    supportsEddm: false,
    supportsPremium: false,
    supportsFirstClass: true,
    baseCentsPerPiece: { postcard_6x9: 80, letter_6x9: 110, "letter_8.5x11": 130 },
    turnaroundDays: 5,
    supportsTestMode: true,
    apiKeyEnvVar: "POSTGRID_API_KEY",
  },
  taradel: {
    maxQuantityOptimal: 100_000,
    supportsEddm: true,
    supportsPremium: false,
    supportsFirstClass: false,
    baseCentsPerPiece: { postcard_6x9: 55, letter_6x9: 90, "letter_8.5x11": 110 },
    turnaroundDays: 7,
    supportsTestMode: false,
    apiKeyEnvVar: "TARADEL_API_KEY",
  },
  pfl: {
    maxQuantityOptimal: 50_000,
    supportsEddm: false,
    supportsPremium: true,
    supportsFirstClass: true,
    baseCentsPerPiece: { postcard_6x9: 120, letter_6x9: 160, "letter_8.5x11": 190 },
    turnaroundDays: 6,
    supportsTestMode: false,
    apiKeyEnvVar: "PFL_API_KEY",
  },
  click2mail: {
    maxQuantityOptimal: 5_000,
    supportsEddm: false,
    supportsPremium: false,
    supportsFirstClass: true,
    baseCentsPerPiece: { postcard_6x9: 70, letter_6x9: 95, "letter_8.5x11": 115 },
    turnaroundDays: 4,
    supportsTestMode: true,
    apiKeyEnvVar: "CLICK2MAIL_API_KEY",
  },
};

/** Returns the configured vendors that have an API key set in the environment. */
function availableVendors(): PrintVendor[] {
  return (Object.keys(VENDOR_SPECS) as PrintVendor[]).filter(
    (v) => !!process.env[VENDOR_SPECS[v].apiKeyEnvVar]
  );
}

/**
 * Select the optimal print vendor for a batch.
 * Falls back to PostGrid if no other vendor is available/configured.
 */
export function selectVendor(input: BatchRoutingInput): VendorConfig {
  const available = availableVendors();

  // EDDM requires Taradel
  if (input.isEddm && available.includes("taradel")) {
    const spec = VENDOR_SPECS.taradel;
    return {
      vendor: "taradel",
      reason: "EDDM campaign selected — Taradel is the only vendor supporting Every Door Direct Mail",
      estimatedCentsPerPiece: spec.baseCentsPerPiece[input.format],
      estimatedTurnaroundDays: spec.turnaroundDays,
      supportsTestMode: spec.supportsTestMode,
      apiKeyEnvVar: spec.apiKeyEnvVar,
    };
  }

  // Premium quality → PFL
  if (input.isPremiumQuality && available.includes("pfl")) {
    const spec = VENDOR_SPECS.pfl;
    return {
      vendor: "pfl",
      reason: "Premium quality (poly-bag, heavy stock) selected — PFL specializes in high-quality variable data print",
      estimatedCentsPerPiece: spec.baseCentsPerPiece[input.format],
      estimatedTurnaroundDays: spec.turnaroundDays,
      supportsTestMode: spec.supportsTestMode,
      apiKeyEnvVar: spec.apiKeyEnvVar,
    };
  }

  // Large batch (> 500) → Taradel or PFL for economies of scale
  if (input.quantity > 500) {
    if (available.includes("taradel") && !input.isFirstClass) {
      const spec = VENDOR_SPECS.taradel;
      return {
        vendor: "taradel",
        reason: `Large batch (${input.quantity} pieces) with Marketing postage — Taradel offers best per-piece rate at scale`,
        estimatedCentsPerPiece: spec.baseCentsPerPiece[input.format],
        estimatedTurnaroundDays: spec.turnaroundDays,
        supportsTestMode: spec.supportsTestMode,
        apiKeyEnvVar: spec.apiKeyEnvVar,
      };
    }
    if (available.includes("pfl") && input.quantity > 500) {
      const spec = VENDOR_SPECS.pfl;
      return {
        vendor: "pfl",
        reason: `Large First-Class batch (${input.quantity} pieces) — PFL handles high-volume variable data at competitive rates`,
        estimatedCentsPerPiece: spec.baseCentsPerPiece[input.format],
        estimatedTurnaroundDays: spec.turnaroundDays,
        supportsTestMode: spec.supportsTestMode,
        apiKeyEnvVar: spec.apiKeyEnvVar,
      };
    }
  }

  // Budget-sensitive small batch → Click2Mail
  const budgetLimit = input.budgetCentsPerPiece;
  if (budgetLimit && budgetLimit < 80 && available.includes("click2mail")) {
    const spec = VENDOR_SPECS.click2mail;
    return {
      vendor: "click2mail",
      reason: `Budget constraint (< $${(budgetLimit / 100).toFixed(2)}/piece) — Click2Mail offers lowest cost for small runs`,
      estimatedCentsPerPiece: spec.baseCentsPerPiece[input.format],
      estimatedTurnaroundDays: spec.turnaroundDays,
      supportsTestMode: spec.supportsTestMode,
      apiKeyEnvVar: spec.apiKeyEnvVar,
    };
  }

  // Default → PostGrid
  const spec = VENDOR_SPECS.postgrid;
  return {
    vendor: "postgrid",
    reason: "Default vendor — PostGrid offers same-day API, test mode, and CASS/NCOA address certification",
    estimatedCentsPerPiece: spec.baseCentsPerPiece[input.format],
    estimatedTurnaroundDays: spec.turnaroundDays,
    supportsTestMode: spec.supportsTestMode,
    apiKeyEnvVar: spec.apiKeyEnvVar,
  };
}

/** Estimate total batch cost in cents. */
export function estimateBatchCost(input: BatchRoutingInput): {
  vendor: PrintVendor;
  totalCents: number;
  perPieceCents: number;
  turnaroundDays: number;
} {
  const config = selectVendor(input);
  return {
    vendor: config.vendor,
    totalCents: config.estimatedCentsPerPiece * input.quantity,
    perPieceCents: config.estimatedCentsPerPiece,
    turnaroundDays: config.estimatedTurnaroundDays,
  };
}
