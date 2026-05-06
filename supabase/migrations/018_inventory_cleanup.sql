-- ============================================================
-- AutoCDP Migration 018 — Inventory deduplication + unique constraint
-- ============================================================

-- 1. Remove blank records created by pre-DriveCentric imports
--    (rows where the vehicle was never identified — no year, make, or model)
DELETE FROM inventory
WHERE year IS NULL AND make IS NULL AND model IS NULL;

-- 2. Among any remaining duplicates by VIN, keep the most recently updated row
DELETE FROM inventory
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY dealership_id, vin
             ORDER BY updated_at DESC, id DESC
           ) AS rn
    FROM inventory
    WHERE vin IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- 3. Add unique constraint so VIN-based inserts never create duplicates going forward
ALTER TABLE inventory
  ADD CONSTRAINT inventory_vin_dealership_unique UNIQUE (vin, dealership_id);
