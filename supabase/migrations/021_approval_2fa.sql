-- ── Campaign approval 2FA fields ───────────────────────────────────────────
-- confirmation_code_hash: SHA-256 of the 6-digit code sent in the email
-- approver_user_agent:    browser/device string captured at approval time
-- approver_confirmed:     GM checked the explicit consent checkbox

ALTER TABLE campaign_approvals
  ADD COLUMN IF NOT EXISTS confirmation_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS approver_user_agent     TEXT,
  ADD COLUMN IF NOT EXISTS approver_confirmed      BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Plan tier on dealerships ─────────────────────────────────────────────────
-- Drives credit compliance display on the billing page.
-- Defaults to 'trial' so all existing dealerships are in trial mode.

ALTER TABLE dealerships
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'trial'
    CHECK (plan_tier IN ('trial', 'starter', 'growth', 'enterprise'));
