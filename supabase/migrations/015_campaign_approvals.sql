-- ============================================================
-- 015 — Campaign Approvals
-- Every live campaign send requires a GM approval token.
-- Token stored as SHA-256 hash; plain token travels only in email.
-- ============================================================

CREATE TABLE IF NOT EXISTS campaign_approvals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id        UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  -- Requestor (staff who built the campaign)
  requested_by         UUID REFERENCES auth.users(id),
  requested_by_email   TEXT,

  -- Approver (GM / owner)
  gm_email             TEXT NOT NULL,
  gm_name              TEXT,

  -- Full set of params needed to re-execute the campaign
  campaign_snapshot    JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Lifecycle
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected','expired','executed')),
  token_hash           TEXT NOT NULL UNIQUE,
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Post-decision audit
  approved_at          TIMESTAMPTZ,
  rejected_at          TIMESTAMPTZ,
  executed_at          TIMESTAMPTZ,
  approver_ip          TEXT,
  approver_notes       TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_approvals_token
  ON campaign_approvals (token_hash);

CREATE INDEX IF NOT EXISTS idx_campaign_approvals_dealership
  ON campaign_approvals (dealership_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_approvals_pending_expiry
  ON campaign_approvals (expires_at)
  WHERE status = 'pending';

-- RLS: service-role only — this table is accessed via service client
ALTER TABLE campaign_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_campaign_approvals"
  ON campaign_approvals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
