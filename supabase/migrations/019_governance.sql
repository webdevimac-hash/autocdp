-- ============================================================
-- 019: Governance layer
--
-- 1. dealership_memories — add strength (soft/hard) + compliance category
--    Hard memories are MUST-FOLLOW constraints (compliance rules, legal limits).
--    Soft memories are strong suggestions the swarm can override with data.
--
-- 2. No audit_log changes needed — details (JSONB) already carries
--    memories_used, hard_constraints, override_count payloads.
-- ============================================================

-- Add strength column (soft = default guidance; hard = must follow)
ALTER TABLE dealership_memories
  ADD COLUMN IF NOT EXISTS strength TEXT NOT NULL DEFAULT 'soft'
    CHECK (strength IN ('soft', 'hard'));

-- Add 'compliance' category (APR floors, required disclaimers, banned terms, etc.)
-- Must drop and recreate the CHECK constraint (ALTER CONSTRAINT not supported in Postgres)
ALTER TABLE dealership_memories DROP CONSTRAINT IF EXISTS chk_memory_category;
ALTER TABLE dealership_memories
  ADD CONSTRAINT chk_memory_category
    CHECK (category IN ('tone', 'offers', 'avoid', 'style', 'general', 'compliance'));

-- Index: quickly find hard/active constraints per dealership
CREATE INDEX IF NOT EXISTS idx_dealership_memories_hard
  ON dealership_memories (dealership_id, strength, is_active)
  WHERE is_active = true;

COMMENT ON COLUMN dealership_memories.strength IS
  'soft = strong suggestion, swarm may override with data evidence; '
  'hard = must-follow (compliance rules, legal constraints, GM directives)';

COMMENT ON COLUMN dealership_memories.category IS
  'tone=voice/style; offers=promotions; avoid=banned content; '
  'style=format; compliance=legal/regulatory rules; general=misc guidance';
