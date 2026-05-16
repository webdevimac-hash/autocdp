-- ============================================================
-- Digital Ads Performance & Creative Push
-- Migration: 20250515_ads_performance
-- ============================================================

-- ads_performance: pulled from Google Ads + Meta Ads on each sync
CREATE TABLE IF NOT EXISTS ads_performance (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id     uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  platform          text        NOT NULL CHECK (platform IN ('google_ads', 'meta_ads')),
  account_id        text        NOT NULL,          -- Google customer_id / Meta act_XXXXXX
  campaign_id       text        NOT NULL,
  campaign_name     text,
  ad_group_id       text,
  ad_group_name     text,
  ad_id             text,

  -- Time window this row covers (daily granularity)
  date_start        date        NOT NULL,
  date_end          date        NOT NULL,

  -- Core KPIs
  impressions       bigint      NOT NULL DEFAULT 0,
  clicks            bigint      NOT NULL DEFAULT 0,
  conversions       numeric(12,2) NOT NULL DEFAULT 0,
  spend_usd         numeric(12,2) NOT NULL DEFAULT 0,  -- always in USD
  roas              numeric(8,4),                       -- revenue / spend; null if no conv value

  -- Derived convenience columns (re-computed on insert)
  ctr               numeric(8,6) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN clicks::numeric / impressions ELSE 0 END
  ) STORED,
  cpc               numeric(10,4) GENERATED ALWAYS AS (
    CASE WHEN clicks > 0 THEN spend_usd / clicks ELSE 0 END
  ) STORED,
  cost_per_conv     numeric(10,4) GENERATED ALWAYS AS (
    CASE WHEN conversions > 0 THEN spend_usd / conversions ELSE 0 END
  ) STORED,

  -- Platform-specific extras
  metadata          jsonb       NOT NULL DEFAULT '{}',
  synced_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (dealership_id, platform, campaign_id, ad_id, date_start)
);

CREATE INDEX IF NOT EXISTS ads_performance_dealership_date
  ON ads_performance (dealership_id, date_start DESC);

CREATE INDEX IF NOT EXISTS ads_performance_platform
  ON ads_performance (dealership_id, platform, date_start DESC);

-- RLS
ALTER TABLE ads_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can read their ads_performance"
  ON ads_performance FOR SELECT
  USING (
    dealership_id IN (
      SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
    )
  );

-- ads_push_log: track every creative/budget rule the swarm has pushed
CREATE TABLE IF NOT EXISTS ads_push_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  platform        text        NOT NULL CHECK (platform IN ('google_ads', 'meta_ads')),
  push_type       text        NOT NULL CHECK (push_type IN ('creative', 'budget_rule', 'headline_test')),
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'succeeded', 'failed')),
  platform_id     text,        -- Google ad ID / Meta creative ID returned after push
  payload         jsonb       NOT NULL DEFAULT '{}',   -- what we sent
  response        jsonb       NOT NULL DEFAULT '{}',   -- what the platform returned
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ads_push_log_dealership
  ON ads_push_log (dealership_id, created_at DESC);

ALTER TABLE ads_push_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage their ads_push_log"
  ON ads_push_log FOR ALL
  USING (
    dealership_id IN (
      SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
    )
  );
