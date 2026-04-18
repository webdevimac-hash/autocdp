-- ============================================================
-- AutoCDP — Initial Schema Migration
-- Run in Supabase SQL Editor or via: supabase db push
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";          -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- fuzzy text search on names

-- ============================================================
-- DEALERSHIPS
-- ============================================================
CREATE TABLE dealerships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,            -- url-safe identifier
  website_url     TEXT,
  logo_url        TEXT,
  address         JSONB DEFAULT '{}',              -- {street, city, state, zip}
  phone           TEXT,
  hours           JSONB DEFAULT '{}',              -- {mon: "8am-6pm", ...}
  settings        JSONB DEFAULT '{}',              -- feature flags, preferences
  onboarded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER ↔ DEALERSHIP MEMBERSHIP
-- Supports multi-dealership groups (e.g., dealer groups)
-- ============================================================
CREATE TABLE user_dealerships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'admin', 'member')),
  invited_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, dealership_id)
);

-- ============================================================
-- CUSTOMERS  (with pgvector for last-visit memory)
-- ============================================================
CREATE TABLE customers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id         UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  address               JSONB DEFAULT '{}',        -- {street, city, state, zip}
  tags                  TEXT[] DEFAULT '{}',        -- ["loyal", "lapsed", "vip"]
  lifecycle_stage       TEXT DEFAULT 'prospect'
                        CHECK (lifecycle_stage IN (
                          'prospect','active','at_risk','lapsed','vip'
                        )),
  -- pgvector embedding of last-visit context (1536-dim for text-embedding-3-small)
  last_visit_embedding  vector(1536),
  -- Denormalized quick stats (updated by triggers)
  total_visits          INTEGER DEFAULT 0,
  total_spend           DECIMAL(12,2) DEFAULT 0,
  last_visit_date       TIMESTAMPTZ,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat index for approximate nearest-neighbor search on embeddings
CREATE INDEX ON customers USING ivfflat (last_visit_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Standard indexes
CREATE INDEX ON customers (dealership_id, lifecycle_stage);
CREATE INDEX ON customers (dealership_id, last_visit_date DESC);
CREATE INDEX ON customers USING gin (tags);

-- ============================================================
-- VISITS  (service history)
-- ============================================================
CREATE TABLE visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vin             TEXT,                            -- Vehicle Identification Number
  make            TEXT,
  model           TEXT,
  year            INTEGER,
  mileage         INTEGER,
  service_type    TEXT,                            -- oil_change, repair, recall, etc.
  service_notes   TEXT,                            -- technician notes (plain text)
  technician      TEXT,
  ro_number       TEXT,                            -- Repair Order number
  total_amount    DECIMAL(10,2),
  visit_date      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON visits (dealership_id, customer_id, visit_date DESC);
CREATE INDEX ON visits (dealership_id, visit_date DESC);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id    UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  channel          TEXT NOT NULL
                   CHECK (channel IN ('sms', 'email', 'direct_mail', 'multi_channel')),
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','scheduled','active','completed','paused')),
  target_segment   JSONB DEFAULT '{}',             -- filter criteria for audience
  message_template TEXT,                           -- base template (agents personalize)
  ai_instructions  TEXT,                           -- prompt guidance for creative agent
  scheduled_at     TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  -- Denormalized metrics
  stats            JSONB DEFAULT '{
    "targeted": 0,
    "sent": 0,
    "delivered": 0,
    "opened": 0,
    "clicked": 0,
    "converted": 0,
    "revenue_attributed": 0
  }',
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON campaigns (dealership_id, status, scheduled_at);

-- ============================================================
-- COMMUNICATIONS  (individual message log)
-- ============================================================
CREATE TABLE communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL
                  CHECK (channel IN ('sms', 'email', 'direct_mail')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending','queued','sent','delivered',
                    'opened','clicked','converted','bounced','failed'
                  )),
  subject         TEXT,                            -- email subject line
  content         TEXT NOT NULL,                   -- final personalized content
  ai_generated    BOOLEAN DEFAULT TRUE,
  provider_id     TEXT,                            -- external message ID (Twilio/Lob/Resend)
  provider_meta   JSONB DEFAULT '{}',
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON communications (dealership_id, customer_id, created_at DESC);
CREATE INDEX ON communications (dealership_id, campaign_id);
CREATE INDEX ON communications (dealership_id, status);

-- ============================================================
-- LEARNING OUTCOMES  (per-dealership, may contain internal patterns)
-- ============================================================
CREATE TABLE learning_outcomes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  outcome_type    TEXT NOT NULL,                   -- "open_rate", "conversion", "churn_prevention"
  -- context and result stored as structured JSON for the optimization agent
  context         JSONB NOT NULL,                  -- {segment, channel, timing, template_features}
  result          JSONB NOT NULL,                  -- {opened, clicked, converted, revenue}
  model_version   TEXT DEFAULT 'v1',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON learning_outcomes (dealership_id, outcome_type, created_at DESC);

-- ============================================================
-- GLOBAL LEARNINGS  (anonymized cross-dealer patterns — NO PII)
-- ============================================================
CREATE TABLE global_learnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type    TEXT NOT NULL,                   -- "seasonal_open_rates", "service_interval_churn"
  -- All PII stripped; only aggregate/statistical patterns
  pattern_data    JSONB NOT NULL,
  description     TEXT,
  confidence      DECIMAL(5,4) DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  sample_size     INTEGER DEFAULT 0,
  region          TEXT,                            -- geographic grouping if relevant
  vehicle_segment TEXT,                            -- "truck", "luxury", "economy"
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON global_learnings (pattern_type, confidence DESC);

-- ============================================================
-- AGENT RUNS  (audit trail for AI agent executions)
-- ============================================================
CREATE TABLE agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  agent_type      TEXT NOT NULL
                  CHECK (agent_type IN (
                    'orchestrator','data','targeting','creative','optimization'
                  )),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','completed','failed')),
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  duration_ms     INTEGER,
  input_summary   TEXT,
  output_summary  TEXT,
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX ON agent_runs (dealership_id, created_at DESC);

-- ============================================================
-- BILLING EVENTS  (usage metering for hybrid billing)
-- ============================================================
CREATE TABLE billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL
                  CHECK (event_type IN (
                    'agent_run','sms_sent','email_sent','mail_piece_sent','api_call'
                  )),
  quantity        INTEGER DEFAULT 1,
  unit_cost_cents INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  billed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON billing_events (dealership_id, event_type, created_at DESC);

-- ============================================================
-- UTILITY: auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dealerships_updated_at
  BEFORE UPDATE ON dealerships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- UTILITY: denormalize customer stats after visit insert
-- ============================================================
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers
  SET
    total_visits    = (SELECT COUNT(*) FROM visits WHERE customer_id = NEW.customer_id),
    total_spend     = (SELECT COALESCE(SUM(total_amount),0) FROM visits WHERE customer_id = NEW.customer_id),
    last_visit_date = (SELECT MAX(visit_date) FROM visits WHERE customer_id = NEW.customer_id),
    updated_at      = NOW()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_customer_stats
  AFTER INSERT OR UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_customer_stats();
