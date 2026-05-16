-- ============================================================
-- Dynamic Creative A/B Testing for Paid Channels
-- Migration: 20250516_paid_ab_tests
-- ============================================================
-- Tracks A/B (or multi-variant) creative tests running on
-- Google Ads and Meta Ads.  Agent #6 creates tests, the daily
-- cron evaluates statistical significance, and auto-promotes
-- winners while pausing losers.

-- ── paid_ab_tests: one test per experiment ───────────────────
CREATE TABLE IF NOT EXISTS paid_ab_tests (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id         uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  platform              text        NOT NULL
                        CHECK (platform IN ('google_ads','meta_ads','tiktok_ads')),

  -- What the experiment is measuring
  hypothesis            text,
  primary_metric        text        NOT NULL DEFAULT 'ctr'
                        CHECK (primary_metric IN ('ctr','cvr','cpa','roas','clicks')),

  -- Where the test is running (platform resource IDs)
  platform_campaign_id  text,
  platform_ad_group_id  text,

  -- Evaluation guardrails
  min_impressions       bigint      NOT NULL DEFAULT 1000, -- per variant before evaluation
  confidence_threshold  numeric(4,2) NOT NULL DEFAULT 0.95, -- 95% confidence to declare winner

  -- Lifecycle
  status                text        NOT NULL DEFAULT 'active'
                        CHECK (status IN (
                          'draft','active','paused',
                          'winner_declared','completed','failed'
                        )),
  winner_variant_id     uuid,       -- FK to paid_ab_variants (set after evaluation)
  auto_optimize         boolean     NOT NULL DEFAULT true, -- allow cron to auto-pause losers
  budget_scale_pct      integer     NOT NULL DEFAULT 20,   -- % to increase winner budget

  -- Agent metadata
  agent_run_id          uuid,
  created_by_agent      boolean     NOT NULL DEFAULT false,
  notes                 text,

  started_at            timestamptz NOT NULL DEFAULT now(),
  ended_at              timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paid_ab_tests_dealership
  ON paid_ab_tests (dealership_id, status, created_at DESC);

ALTER TABLE paid_ab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage paid_ab_tests"
  ON paid_ab_tests FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role paid_ab_tests"
  ON paid_ab_tests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── paid_ab_variants: one row per variant in the test ────────
CREATE TABLE IF NOT EXISTS paid_ab_variants (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id               uuid        NOT NULL REFERENCES paid_ab_tests(id) ON DELETE CASCADE,
  dealership_id         uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  name                  text        NOT NULL,      -- e.g. "Control", "Urgency Headlines"
  is_control            boolean     NOT NULL DEFAULT false,

  -- Platform identifiers (set after ad is pushed)
  platform_ad_id        text,                      -- Google/Meta/TikTok ad ID
  platform_ad_group_id  text,
  platform_campaign_id  text,

  -- The creative spec used to generate this variant
  creative              jsonb       NOT NULL DEFAULT '{}',
  -- Shape for Google RSA: { headlines: [{text,pinnedField?}], descriptions: [{text,pinnedField?}], path1?, path2?, finalUrl }
  -- Shape for Meta:       { headline, primaryText, description?, callToAction, imageUrl, finalUrl }

  -- Live KPI cache (refreshed by sync or optimizer run)
  impressions           bigint      NOT NULL DEFAULT 0,
  clicks                bigint      NOT NULL DEFAULT 0,
  conversions           numeric(12,2) NOT NULL DEFAULT 0,
  spend_usd             numeric(12,2) NOT NULL DEFAULT 0,
  -- Computed columns for fast comparison
  ctr                   numeric(10,8) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN clicks::numeric / impressions ELSE 0 END
  ) STORED,
  cvr                   numeric(10,8) GENERATED ALWAYS AS (
    CASE WHEN clicks > 0 THEN conversions / clicks ELSE 0 END
  ) STORED,
  cpa                   numeric(10,4) GENERATED ALWAYS AS (
    CASE WHEN conversions > 0 THEN spend_usd / conversions ELSE 0 END
  ) STORED,
  roas                  numeric(8,4),  -- set from ads_performance on sync

  -- Statistical result for this variant vs control
  win_probability       numeric(6,4),  -- 0–1, Bayesian win probability
  z_score               numeric(8,4),  -- z-score vs control for primary metric
  p_value               numeric(8,6),  -- two-tailed p-value

  -- Lifecycle
  status                text        NOT NULL DEFAULT 'active'
                        CHECK (status IN (
                          'draft','active','paused','winner','eliminated'
                        )),
  platform_status       text,         -- raw status from platform API

  last_kpi_sync_at      timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paid_ab_variants_test
  ON paid_ab_variants (test_id, status);
CREATE INDEX IF NOT EXISTS idx_paid_ab_variants_platform_ad
  ON paid_ab_variants (platform_ad_id)
  WHERE platform_ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paid_ab_variants_dealership
  ON paid_ab_variants (dealership_id, status, created_at DESC);

ALTER TABLE paid_ab_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage paid_ab_variants"
  ON paid_ab_variants FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role paid_ab_variants"
  ON paid_ab_variants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── paid_ab_optimization_log: audit trail ───────────────────
-- Every time the optimizer runs on a test, record what it did.
CREATE TABLE IF NOT EXISTS paid_ab_optimization_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  test_id         uuid        NOT NULL REFERENCES paid_ab_tests(id) ON DELETE CASCADE,
  action          text        NOT NULL
                  CHECK (action IN (
                    'evaluated','winner_declared','variant_paused',
                    'budget_scaled','pattern_saved','no_action'
                  )),
  variant_id      uuid        REFERENCES paid_ab_variants(id) ON DELETE SET NULL,
  details         jsonb       NOT NULL DEFAULT '{}',
  -- e.g. { winner_variant: "...", confidence: 0.97, lift_pct: 34, metric: "ctr" }
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paid_ab_opt_log_test
  ON paid_ab_optimization_log (test_id, created_at DESC);

ALTER TABLE paid_ab_optimization_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can read optimization_log"
  ON paid_ab_optimization_log FOR SELECT
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role optimization_log"
  ON paid_ab_optimization_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── FK constraint for winner_variant_id (added after both tables exist) ──
ALTER TABLE paid_ab_tests
  ADD CONSTRAINT fk_paid_ab_tests_winner_variant
  FOREIGN KEY (winner_variant_id)
  REFERENCES paid_ab_variants(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ── updated_at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_paid_ab_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_paid_ab_tests_updated_at    ON paid_ab_tests;
DROP TRIGGER IF EXISTS trg_paid_ab_variants_updated_at ON paid_ab_variants;

CREATE TRIGGER trg_paid_ab_tests_updated_at
  BEFORE UPDATE ON paid_ab_tests
  FOR EACH ROW EXECUTE FUNCTION update_paid_ab_updated_at();

CREATE TRIGGER trg_paid_ab_variants_updated_at
  BEFORE UPDATE ON paid_ab_variants
  FOR EACH ROW EXECUTE FUNCTION update_paid_ab_updated_at();
