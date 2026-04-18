-- ============================================================
-- AutoCDP Migration 005 — Inventory
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  vin             TEXT,
  year            INTEGER,
  make            TEXT,
  model           TEXT,
  trim            TEXT,
  color           TEXT,
  mileage         INTEGER,
  condition       TEXT CHECK (condition IN ('new', 'used', 'certified')),
  price           NUMERIC(10, 2),
  days_on_lot     INTEGER DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'reserved', 'pending')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealership members can manage their inventory"
  ON inventory FOR ALL
  USING (dealership_id = auth_dealership_id());

CREATE INDEX inventory_dealership_idx ON inventory (dealership_id, status, created_at DESC);
CREATE INDEX inventory_vin_idx ON inventory (vin) WHERE vin IS NOT NULL;
CREATE INDEX inventory_model_idx ON inventory (dealership_id, make, model, year);
