-- ============================================================
-- 009_dms_external_id.sql
--
-- Adds dms_external_id TEXT to customers, visits, and inventory
-- so DMS sync upserts have a real indexed unique constraint to
-- resolve conflicts on — instead of the invalid JSONB path syntax.
--
-- Format stored: "<provider>:<dms_record_id>"
--   e.g.  "cdk_fortellis:CUST-0042"
--         "reynolds:RO-8811"
--
-- The WHERE dms_external_id IS NOT NULL partial index keeps the index
-- small: hand-entered / CSV-imported records remain unaffected.
-- ============================================================

-- customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS dms_external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS customers_dms_external_id_idx
  ON customers (dealership_id, dms_external_id)
  WHERE dms_external_id IS NOT NULL;

-- visits
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS dms_external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS visits_dms_external_id_idx
  ON visits (dealership_id, dms_external_id)
  WHERE dms_external_id IS NOT NULL;

-- inventory  (VIN index already exists but is not UNIQUE; add dms key)
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS dms_external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_dms_external_id_idx
  ON inventory (dealership_id, dms_external_id)
  WHERE dms_external_id IS NOT NULL;
