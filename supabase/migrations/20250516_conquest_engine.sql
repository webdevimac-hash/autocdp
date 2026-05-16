-- ============================================================
-- Full Conquest & Retargeting Engine
-- Migration: 20250516_conquest_engine
-- ============================================================
-- Extends conquest_leads with enrichment columns and adds:
--   conquest_audiences  — named, criteria-based audience segments
--   retargeting_events  — pixel-fired website behaviour events
--   retargeting_audiences — pixel-derived audience buckets pushed to ad platforms

-- ── 1. Extend conquest_leads ─────────────────────────────────
-- Safe: all ALTER TABLE ADD COLUMN IF NOT EXISTS

ALTER TABLE conquest_leads
  ADD COLUMN IF NOT EXISTS credit_tier      text
    CHECK (credit_tier IN ('excellent','good','fair','poor','unknown')),
  ADD COLUMN IF NOT EXISTS credit_enriched_at timestamptz,

  -- In-market signal: did this person recently search/apply for credit?
  ADD COLUMN IF NOT EXISTS in_market_signal  boolean    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_market_updated_at timestamptz,

  -- Estimated trade equity (pulled from vehicle history if available)
  ADD COLUMN IF NOT EXISTS estimated_equity_usd numeric(10,2),

  -- Audience membership
  ADD COLUMN IF NOT EXISTS audience_id       uuid,  -- FK set after conquest_audiences is created
  ADD COLUMN IF NOT EXISTS audience_synced_at timestamptz,

  -- Platform retargeting
  ADD COLUMN IF NOT EXISTS retargeted_google boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retargeted_meta   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retargeted_tiktok boolean NOT NULL DEFAULT false,

  -- Vehicle interest enrichment
  ADD COLUMN IF NOT EXISTS make_interest     text,
  ADD COLUMN IF NOT EXISTS model_interest    text,
  ADD COLUMN IF NOT EXISTS year_min          smallint,
  ADD COLUMN IF NOT EXISTS year_max          smallint,
  ADD COLUMN IF NOT EXISTS price_max_usd     numeric(10,2),

  -- Import source enrichment
  ADD COLUMN IF NOT EXISTS import_batch_id   uuid,
  ADD COLUMN IF NOT EXISTS data_provider     text;  -- '700credit','experian','polk','manual','crm'

CREATE INDEX IF NOT EXISTS idx_conquest_leads_credit
  ON conquest_leads (dealership_id, credit_tier, score DESC);
CREATE INDEX IF NOT EXISTS idx_conquest_leads_in_market
  ON conquest_leads (dealership_id, in_market_signal, score DESC)
  WHERE in_market_signal = true;

-- ── 2. conquest_audiences ─────────────────────────────────────
-- Named audience segments built from conquest_leads + CRM customers.

CREATE TABLE IF NOT EXISTS conquest_audiences (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id       uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  name                text        NOT NULL,  -- e.g. "Prime SUV In-Market — 30 mi"
  description         text,

  -- Segment criteria (stored as JSONB; engine evaluates at build time)
  criteria            jsonb       NOT NULL DEFAULT '{}',
  -- Shape: {
  --   credit_tiers?:    ["excellent","good"],
  --   min_score?:       60,
  --   in_market?:       true,
  --   vehicle_interests?: ["SUV","Truck"],
  --   makes?:           ["Toyota","Honda"],
  --   max_price_usd?:   50000,
  --   radius_miles?:    30,
  --   zip_codes?:       ["33101","33102"],
  --   sources?:         ["700credit","crm"],
  --   statuses?:        ["new","contacted"],
  --   exclude_customers?: true   -- exclude existing CRM customers
  -- }

  -- Live counts (updated on each build)
  lead_count          integer     NOT NULL DEFAULT 0,
  enriched_count      integer     NOT NULL DEFAULT 0,  -- has credit_tier
  in_market_count     integer     NOT NULL DEFAULT 0,

  -- Platform sync state
  google_audience_id  text,  -- Google Ads Customer Match user list resource name
  meta_audience_id    text,  -- Meta Custom Audience ID
  tiktok_audience_id  text,

  google_synced_at    timestamptz,
  meta_synced_at      timestamptz,
  tiktok_synced_at    timestamptz,

  -- Lifecycle
  status              text        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','building','ready','syncing','error')),
  last_built_at       timestamptz,
  build_error         text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conquest_audiences_dealership
  ON conquest_audiences (dealership_id, status, updated_at DESC);

ALTER TABLE conquest_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage conquest_audiences"
  ON conquest_audiences FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role conquest_audiences"
  ON conquest_audiences FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Deferred FK from conquest_leads.audience_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_conquest_leads_audience'
      AND table_name = 'conquest_leads'
  ) THEN
    ALTER TABLE conquest_leads
      ADD CONSTRAINT fk_conquest_leads_audience
      FOREIGN KEY (audience_id)
      REFERENCES conquest_audiences(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ── 3. retargeting_events ─────────────────────────────────────
-- High-volume table — one row per pixel-fired website event.
-- Partitioned by created_at week would be ideal; keep flat for now.

CREATE TABLE IF NOT EXISTS retargeting_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  -- Session identity (anonymous until matched to a customer)
  session_id      text        NOT NULL,  -- UUID generated by pixel JS
  customer_id     uuid        REFERENCES customers(id) ON DELETE SET NULL,
  conquest_lead_id uuid       REFERENCES conquest_leads(id) ON DELETE SET NULL,

  -- What happened
  event_type      text        NOT NULL
                  CHECK (event_type IN (
                    'homepage_view','srp_view','vdp_view',
                    'lead_form_start','lead_form_submit',
                    'phone_click','chat_start','trade_tool',
                    'finance_tool','test_drive_request'
                  )),

  -- VDP-specific
  vin             text,
  vehicle_make    text,
  vehicle_model   text,
  vehicle_year    smallint,
  vehicle_price   numeric(10,2),

  page_url        text,
  referrer_url    text,
  user_agent      text,
  ip_hash         text,  -- SHA-256 of IP — never store raw IP
  country_code    text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retargeting_events_session
  ON retargeting_events (dealership_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retargeting_events_type
  ON retargeting_events (dealership_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retargeting_events_vdp
  ON retargeting_events (dealership_id, vin, created_at DESC)
  WHERE vin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_retargeting_events_time
  ON retargeting_events (dealership_id, created_at DESC);

ALTER TABLE retargeting_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can read retargeting_events"
  ON retargeting_events FOR SELECT
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role retargeting_events"
  ON retargeting_events FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Allow public inserts for pixel endpoint (no auth)
CREATE POLICY "pixel can insert events"
  ON retargeting_events FOR INSERT
  WITH CHECK (true);

-- ── 4. retargeting_audiences ─────────────────────────────────
-- Pixel-derived audience buckets (separate from CRM-based conquest_audiences).

CREATE TABLE IF NOT EXISTS retargeting_audiences (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  name            text        NOT NULL,  -- e.g. "VDP Viewers — Last 30 Days"
  rule_type       text        NOT NULL
                  CHECK (rule_type IN (
                    'all_visitors','vdp_viewers','srp_viewers',
                    'lead_form_starters','high_intent',
                    'specific_vin_viewers','price_range_viewers'
                  )),
  rule_config     jsonb       NOT NULL DEFAULT '{}',
  -- Shape varies by rule_type:
  --   all_visitors:         { days: 30 }
  --   vdp_viewers:          { days: 14, min_views: 1 }
  --   specific_vin_viewers: { vin: "1HGBH41JXMN109186", days: 30 }
  --   price_range_viewers:  { min_price: 20000, max_price: 40000, days: 14 }
  --   high_intent:          { days: 7, events: ["lead_form_start","trade_tool"] }

  session_count   integer     NOT NULL DEFAULT 0,  -- unique sessions matching rule
  matched_crm     integer     NOT NULL DEFAULT 0,  -- matched to known CRM customers

  google_audience_id text,
  meta_audience_id   text,
  google_synced_at   timestamptz,
  meta_synced_at     timestamptz,

  status          text        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','ready','syncing','error')),
  last_built_at   timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retargeting_audiences_dealership
  ON retargeting_audiences (dealership_id, status);

ALTER TABLE retargeting_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage retargeting_audiences"
  ON retargeting_audiences FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role retargeting_audiences"
  ON retargeting_audiences FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 5. Updated-at triggers ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_conquest_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conquest_audiences_updated_at    ON conquest_audiences;
DROP TRIGGER IF EXISTS trg_retargeting_audiences_updated_at ON retargeting_audiences;

CREATE TRIGGER trg_conquest_audiences_updated_at
  BEFORE UPDATE ON conquest_audiences
  FOR EACH ROW EXECUTE FUNCTION update_conquest_updated_at();

CREATE TRIGGER trg_retargeting_audiences_updated_at
  BEFORE UPDATE ON retargeting_audiences
  FOR EACH ROW EXECUTE FUNCTION update_conquest_updated_at();
