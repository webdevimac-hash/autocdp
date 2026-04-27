-- ============================================================
-- AUDIT LOG  (compliance trail for user and agent actions)
-- ============================================================
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,       -- e.g. "campaign.sent", "agent.run.completed"
  resource_type   TEXT,                -- "campaign", "customer", "agent_run", etc.
  resource_id     UUID,
  metadata        JSONB DEFAULT '{}',  -- channel, count, dryRun, etc.
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON audit_log (dealership_id, created_at DESC);
CREATE INDEX ON audit_log (dealership_id, action, created_at DESC);

-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Dealership members can read their own log
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT TO authenticated
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));

-- Inserts are service-role only (API routes use createServiceClient)
CREATE POLICY "audit_log_service_insert" ON audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);
