-- ============================================================
-- AI Budget Allocator & Bid Optimizer
-- Migration: 20250516_budget_allocator
-- ============================================================
-- Creates:
--   budget_rules        — per-dealership constraints and settings
--   budget_allocations  — daily AI allocation decisions (audit trail)

-- ── 1. budget_rules ───────────────────────────────────────────
-- Constraints the allocator must respect before pushing any budget changes.

CREATE TABLE IF NOT EXISTS budget_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  -- Global monthly cap across all channels (hard ceiling)
  monthly_cap_usd numeric(10,2),

  -- Per-channel daily budget constraints
  -- JSON object: { "google_ads": { min: 50, max: 500 }, "meta_ads": { min: 30, max: 400 }, ... }
  channel_limits  jsonb       NOT NULL DEFAULT '{}',

  -- Minimum change threshold before pushing a budget update (avoid micro-changes)
  min_change_pct  numeric(5,2) NOT NULL DEFAULT 10.0,  -- only push if delta ≥ 10%

  -- Auto-push: if false, allocator writes recommendations but does NOT call ad APIs
  auto_push       boolean     NOT NULL DEFAULT false,

  -- Channels the allocator is allowed to touch
  -- Array: ["google_ads", "meta_ads", "tiktok_ads"]
  managed_channels jsonb      NOT NULL DEFAULT '["google_ads","meta_ads"]',

  -- Blackout windows: array of { start: "HH:MM", end: "HH:MM", tz: "America/Chicago" }
  -- Allocator will not push updates during these windows
  blackout_windows jsonb      NOT NULL DEFAULT '[]',

  -- Optimization objective per channel (overrides default ROAS)
  -- { "google_ads": "roas", "meta_ads": "cpa", "tiktok_ads": "cpm" }
  channel_objectives jsonb    NOT NULL DEFAULT '{}',

  -- Minimum data requirement before allocator acts (impressions per campaign in lookback window)
  min_impressions_threshold integer NOT NULL DEFAULT 500,

  -- Lookback window for performance analysis
  lookback_days   smallint    NOT NULL DEFAULT 14,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT budget_rules_one_per_dealership UNIQUE (dealership_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_rules_dealership
  ON budget_rules (dealership_id);

ALTER TABLE budget_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage budget_rules"
  ON budget_rules FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role budget_rules"
  ON budget_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 2. budget_allocations ─────────────────────────────────────
-- One row per daily allocation run per dealership.
-- Full audit trail: what the AI recommended, what was pushed, why.

CREATE TABLE IF NOT EXISTS budget_allocations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  -- When this allocation was computed
  allocation_date date        NOT NULL DEFAULT CURRENT_DATE,

  -- Total daily budget across all channels (USD)
  total_budget_usd numeric(10,2) NOT NULL,

  -- Channel-level allocations (array of allocation objects)
  -- Shape: [{ channel, campaign_id, campaign_name, current_usd, recommended_usd,
  --           predicted_roas, confidence, pushed, push_error, rationale }]
  allocations     jsonb       NOT NULL DEFAULT '[]',

  -- Swarm reasoning: data agent summary, channel agent decisions, orchestrator review
  swarm_reasoning jsonb       NOT NULL DEFAULT '{}',
  -- Shape: { dataAgentSummary, channelDecisions, orchestratorNotes, riskFlags }

  -- High-level AI narrative (shown in dashboard)
  summary         text,

  -- Execution
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','computing','ready','pushing','applied','failed')),
  pushed_at       timestamptz,
  push_errors     jsonb       NOT NULL DEFAULT '[]',

  -- Performance attribution (filled in next day by cron)
  -- Compares predicted_roas vs actual_roas after the day runs
  attribution_date date,
  actual_spend_usd numeric(10,2),
  actual_roas     numeric(8,4),
  prediction_error_pct numeric(6,2),  -- (actual - predicted) / predicted * 100

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT budget_allocations_one_per_day UNIQUE (dealership_id, allocation_date)
);

CREATE INDEX IF NOT EXISTS idx_budget_allocations_dealership
  ON budget_allocations (dealership_id, allocation_date DESC);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_status
  ON budget_allocations (status, allocation_date DESC);

ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can view budget_allocations"
  ON budget_allocations FOR SELECT
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "dealership members can insert budget_allocations"
  ON budget_allocations FOR INSERT
  WITH CHECK (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role budget_allocations"
  ON budget_allocations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 3. Updated-at trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_budget_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_budget_rules_updated_at       ON budget_rules;
DROP TRIGGER IF EXISTS trg_budget_allocations_updated_at ON budget_allocations;

CREATE TRIGGER trg_budget_rules_updated_at
  BEFORE UPDATE ON budget_rules
  FOR EACH ROW EXECUTE FUNCTION update_budget_updated_at();

CREATE TRIGGER trg_budget_allocations_updated_at
  BEFORE UPDATE ON budget_allocations
  FOR EACH ROW EXECUTE FUNCTION update_budget_updated_at();
