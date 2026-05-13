-- ============================================================
-- 025 — Customer Activity timeline
-- ============================================================
-- Generic timeline rows that don't fit the communications.channel
-- CHECK constraint ('sms','email','direct_mail') — i.e. notes, calls,
-- tasks, appointments, personalized video drafts, and system events
-- (lifecycle changes, AI swarm runs).
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Matches the composer ids in customer-detail-panel.tsx
  type            TEXT NOT NULL
                  CHECK (type IN (
                    'note','call','email','text','video','task','appt','system'
                  )),

  -- Free-form title shown in the timeline, e.g. "Note", "Call logged"
  title           TEXT NOT NULL,
  body            TEXT,

  -- Planned vs past — task and appt default to planned, everything else past.
  planned         BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,

  -- Optional structured metadata: due_date, location, phone_number, etc.
  metadata        JSONB DEFAULT '{}',

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_activity_lookup
  ON customer_activity (dealership_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_activity_planned
  ON customer_activity (dealership_id, customer_id, planned, created_at DESC);

-- ============================================================
-- RLS — isolate by dealership exactly like customers
-- ============================================================

ALTER TABLE customer_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_activity_select" ON customer_activity
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "customer_activity_insert" ON customer_activity
  FOR INSERT TO authenticated
  WITH CHECK (dealership_id = auth_dealership_id());

CREATE POLICY "customer_activity_update" ON customer_activity
  FOR UPDATE TO authenticated
  USING (dealership_id = auth_dealership_id())
  WITH CHECK (dealership_id = auth_dealership_id());

CREATE POLICY "customer_activity_delete" ON customer_activity
  FOR DELETE TO authenticated
  USING (
    dealership_id = auth_dealership_id()
    AND auth_dealership_role() IN ('owner','admin')
  );

-- Service-role bypass for trusted server code.
CREATE POLICY "customer_activity_service_all" ON customer_activity
  FOR ALL TO service_role USING (true) WITH CHECK (true);
