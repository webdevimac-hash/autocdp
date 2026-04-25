-- 011_baseline_mail_examples.sql
-- Dealer-uploaded historical direct mail examples used as few-shot style context
-- for the Creative Agent swarm.

CREATE TABLE IF NOT EXISTS baseline_mail_examples (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  example_text  TEXT NOT NULL,
  mail_type     TEXT,           -- e.g. "service_reminder", "conquest", "lease_pull", "oil_change"
  date_sent     DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS baseline_mail_examples_dealership_idx
  ON baseline_mail_examples (dealership_id, created_at DESC);

-- RLS
ALTER TABLE baseline_mail_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "baseline_mail_examples_select" ON baseline_mail_examples
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "baseline_mail_examples_insert" ON baseline_mail_examples
  FOR INSERT TO authenticated
  WITH CHECK (dealership_id = auth_dealership_id());

CREATE POLICY "baseline_mail_examples_update" ON baseline_mail_examples
  FOR UPDATE TO authenticated
  USING (dealership_id = auth_dealership_id())
  WITH CHECK (dealership_id = auth_dealership_id());

CREATE POLICY "baseline_mail_examples_delete" ON baseline_mail_examples
  FOR DELETE TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "baseline_mail_examples_service_all" ON baseline_mail_examples
  FOR ALL TO service_role USING (true) WITH CHECK (true);
