-- Migration 010: New DMS Integrations
-- Adds credit_tier for 700Credit; no new tables needed (reuse customers/visits/inventory).
-- VinSolutions, vAuto, general-crm all use existing dms_external_id upsert pattern.

-- ── customers: credit tier for 700Credit soft-pull enrichment ────────────────

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS credit_tier TEXT
  CHECK (credit_tier IN ('excellent', 'good', 'fair', 'poor', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_customers_credit_tier
  ON customers (dealership_id, credit_tier)
  WHERE credit_tier IS NOT NULL;

-- ── dms_connections: provider column already accepts any TEXT value ───────────
-- Existing CHECK constraint (if any) would block new providers; drop and re-add permissively.
-- If no constraint exists this is a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'dms_connections'
      AND constraint_name = 'dms_connections_provider_check'
  ) THEN
    ALTER TABLE dms_connections DROP CONSTRAINT dms_connections_provider_check;
  END IF;
END
$$;

-- ── sync_jobs: same permissive provider ──────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sync_jobs'
      AND constraint_name = 'sync_jobs_provider_check'
  ) THEN
    ALTER TABLE sync_jobs DROP CONSTRAINT sync_jobs_provider_check;
  END IF;
END
$$;
