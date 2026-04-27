-- Migration 012: Per-dealership daily limits
-- Allows each dealership to override the global hardcoded DAILY_LIMITS.
-- Null values fall through to the global defaults in rate-limit.ts.

CREATE TABLE IF NOT EXISTS dealership_limits (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id         UUID        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  -- Daily send limits (NULL = use global default)
  mail_piece_sent       INTEGER     CHECK (mail_piece_sent IS NULL OR mail_piece_sent >= 0),
  agent_run             INTEGER     CHECK (agent_run IS NULL OR agent_run >= 0),
  sms_sent              INTEGER     CHECK (sms_sent IS NULL OR sms_sent >= 0),
  email_sent            INTEGER     CHECK (email_sent IS NULL OR email_sent >= 0),

  -- Daily spend guard — pause sends when this is exceeded (0 = no cap)
  daily_cost_limit_cents INTEGER    NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(dealership_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_dealership_limits_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dealership_limits_updated_at
  BEFORE UPDATE ON dealership_limits
  FOR EACH ROW EXECUTE FUNCTION update_dealership_limits_updated_at();

-- RLS
ALTER TABLE dealership_limits ENABLE ROW LEVEL SECURITY;

-- Anyone in the dealership can read
CREATE POLICY "dealership_limits_select"
  ON dealership_limits FOR SELECT
  USING (dealership_id = auth_dealership_id());

-- Only owner/admin can modify
CREATE POLICY "dealership_limits_write"
  ON dealership_limits FOR ALL
  USING (
    dealership_id = auth_dealership_id()
    AND auth_dealership_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    dealership_id = auth_dealership_id()
    AND auth_dealership_role() IN ('owner', 'admin')
  );

-- Service role bypasses RLS
CREATE POLICY "dealership_limits_service_all"
  ON dealership_limits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
