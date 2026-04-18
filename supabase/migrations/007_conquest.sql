-- ============================================================
-- AutoCDP Migration 007 — Conquest Data Feed
-- ============================================================

CREATE TABLE IF NOT EXISTS conquest_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT,
  phone           TEXT,
  address         JSONB,
  vehicle_interest TEXT,
  source          TEXT DEFAULT 'import',
  score           INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'disqualified')),
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE conquest_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealership members can manage their conquest leads"
  ON conquest_leads FOR ALL
  USING (dealership_id = auth_dealership_id());

CREATE INDEX conquest_dealership_idx ON conquest_leads (dealership_id, status, score DESC, created_at DESC);
