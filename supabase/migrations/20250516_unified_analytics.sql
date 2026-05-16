-- ============================================================
-- Unified Analytics & Cross-Channel Attribution
-- Migration: 20250516_unified_analytics
-- ============================================================

-- ua_touchpoint_revenue: explicit revenue attribution records.
-- Links a known revenue event (vehicle sale / service visit) to the
-- marketing channel that drove it.  Populated by:
--   1. Automatic trigger: dm_attribution INSERT with touch_type='sale'
--   2. CRM webhook sync (DealerTrack, VinSolutions, eLead)
--   3. Manual entry from the Unified Analytics UI
--   4. Linear-model computation run by Agent #6

CREATE TABLE IF NOT EXISTS ua_touchpoint_revenue (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id     uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  customer_id       uuid        REFERENCES customers(id) ON DELETE SET NULL,
  visit_id          uuid        REFERENCES visits(id) ON DELETE SET NULL,
  attribution_id    uuid        REFERENCES dm_attribution(id) ON DELETE SET NULL,

  -- The revenue event
  revenue_usd       numeric(12,2) NOT NULL DEFAULT 0,
  revenue_type      text        NOT NULL DEFAULT 'sale'
                    CHECK (revenue_type IN ('sale','service','parts','other')),

  -- Attribution model that produced this row
  model             text        NOT NULL DEFAULT 'last_touch'
                    CHECK (model IN ('first_touch','last_touch','linear','time_decay')),

  -- Credited channel (denormalized for fast GROUP BY)
  credited_channel  text        NOT NULL
                    CHECK (credited_channel IN (
                      'google_ads','meta_ads','tiktok_ads',
                      'direct_mail','sms','email','organic','referral'
                    )),

  -- For linear / time-decay models: fraction of revenue credited here (0–1)
  credited_fraction numeric(6,4) NOT NULL DEFAULT 1.0
                    CHECK (credited_fraction BETWEEN 0 AND 1),

  -- Derived: actual dollar amount credited to this channel/touch
  credited_amount   numeric(12,2) GENERATED ALWAYS AS (
    revenue_usd * credited_fraction
  ) STORED,

  campaign_name     text,
  notes             text,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ua_revenue_dealership
  ON ua_touchpoint_revenue (dealership_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ua_revenue_channel
  ON ua_touchpoint_revenue (dealership_id, credited_channel, model, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ua_revenue_customer
  ON ua_touchpoint_revenue (customer_id, occurred_at DESC)
  WHERE customer_id IS NOT NULL;

ALTER TABLE ua_touchpoint_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ua_touchpoint_revenue_dealership_read"
  ON ua_touchpoint_revenue FOR SELECT
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));

CREATE POLICY "ua_touchpoint_revenue_service_all"
  ON ua_touchpoint_revenue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Auto-populate last_touch rows from dm_attribution sales ──────────────────
-- When Agent #6 or a CRM webhook inserts a dm_attribution row with
-- touch_type='sale' and a revenue_usd value, create a last_touch record
-- automatically.  This seeds the attribution table without manual work.

CREATE OR REPLACE FUNCTION ua_auto_attribute_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.touch_type = 'sale'
     AND NEW.revenue_usd IS NOT NULL
     AND NEW.revenue_usd > 0
  THEN
    INSERT INTO ua_touchpoint_revenue (
      dealership_id,
      customer_id,
      attribution_id,
      revenue_usd,
      revenue_type,
      model,
      credited_channel,
      credited_fraction,
      campaign_name,
      occurred_at
    ) VALUES (
      NEW.dealership_id,
      NEW.customer_id,
      NEW.id,
      NEW.revenue_usd,
      'sale',
      'last_touch',
      NEW.touch_channel,
      1.0,
      NEW.campaign_name,
      NEW.occurred_at
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ua_auto_attribute_sale ON dm_attribution;
CREATE TRIGGER trg_ua_auto_attribute_sale
  AFTER INSERT ON dm_attribution
  FOR EACH ROW EXECUTE FUNCTION ua_auto_attribute_sale();

-- ── ua_channel_cost_config: per-dealership owned-channel cost overrides ───────
-- Defaults: SMS $0.02, Email $0.001, Direct Mail $1.20 (from billing_events)

CREATE TABLE IF NOT EXISTS ua_channel_cost_config (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE UNIQUE,
  sms_cost_cents  integer     NOT NULL DEFAULT 2,      -- cents per SMS
  email_cost_cents integer    NOT NULL DEFAULT 0,      -- cents per email (plan-included)
  mail_cost_cents  integer    NOT NULL DEFAULT 120,    -- cents per mail piece (PostGrid)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ua_channel_cost_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ua_channel_cost_config_all"
  ON ua_channel_cost_config FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));

-- ── Index to speed up cross-table attribution analytics ──────────────────────

-- Fast look-up of all touch events for a customer in a time window
-- (used for path analysis in the Unified Analytics page)
CREATE INDEX IF NOT EXISTS idx_dm_attribution_customer_time
  ON dm_attribution (dealership_id, customer_id, occurred_at DESC)
  WHERE customer_id IS NOT NULL;

-- Pre-filter for just the sale events (needed for attribution path computation)
CREATE INDEX IF NOT EXISTS idx_dm_attribution_sales
  ON dm_attribution (dealership_id, touch_type, occurred_at DESC)
  WHERE touch_type = 'sale';
