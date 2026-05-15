-- ============================================================
-- AutoCDP — Autonomous Swarm Tables
-- Migration 026: campaign_sequences, campaign_triggers, predictive_scores
-- ============================================================

-- ── 1. Campaign Triggers ──────────────────────────────────────
-- Stores opportunities detected by the trigger watcher.
-- Dealers can approve → auto-launch, or dismiss → snooze.

CREATE TABLE IF NOT EXISTS campaign_triggers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id     UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  trigger_type      TEXT NOT NULL
                    CHECK (trigger_type IN (
                      'lapsed_customers', 'aged_inventory', 'service_due',
                      'vip_appreciation', 'at_risk_retention'
                    )),
  urgency           TEXT NOT NULL DEFAULT 'medium'
                    CHECK (urgency IN ('high', 'medium', 'low')),
  title             TEXT NOT NULL,
  description       TEXT,
  customer_count    INTEGER NOT NULL DEFAULT 0,
  suggested_goal    TEXT,
  suggested_channel TEXT CHECK (suggested_channel IN ('direct_mail', 'sms', 'email')),
  customer_ids      UUID[] DEFAULT '{}',
  estimated_roi     TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'dismissed', 'launched')),
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acted_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_triggers_dealership
  ON campaign_triggers(dealership_id, status, detected_at DESC);

-- ── 2. Campaign Sequences ─────────────────────────────────────
-- Drip follow-up steps planned by the sequence planner after a send.
-- A scheduler job evaluates condition + day_offset and fires each step.

CREATE TABLE IF NOT EXISTS campaign_sequences (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID NOT NULL,
  dealership_id        UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  step_index           INTEGER NOT NULL DEFAULT 1,
  channel              TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'direct_mail')),
  day_offset           INTEGER NOT NULL,          -- days after initial send to evaluate
  condition            TEXT NOT NULL
                       CHECK (condition IN (
                         'no_scan_14d', 'no_scan_21d', 'no_reply_7d', 'scanned', 'always'
                       )),
  message_hint         TEXT,                      -- natural-language creative brief for AI
  estimated_cost_label TEXT,
  status               TEXT NOT NULL DEFAULT 'planned'
                       CHECK (status IN ('planned', 'ready', 'sent', 'skipped', 'failed')),
  fire_after           TIMESTAMPTZ,               -- computed: send_date + day_offset
  sent_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_sequences_campaign
  ON campaign_sequences(campaign_id, step_index);

CREATE INDEX IF NOT EXISTS idx_campaign_sequences_ready
  ON campaign_sequences(dealership_id, status, fire_after)
  WHERE status = 'planned';

-- ── 3. Predictive Scores ──────────────────────────────────────
-- Pre-send performance forecast computed from historical mail_pieces data.
-- Written by the preview route; displayed in campaign builder Step 4.

CREATE TABLE IF NOT EXISTS predictive_scores (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id            UUID,
  dealership_id          UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  design_style           TEXT,
  customer_count         INTEGER,
  expected_scan_rate_pct NUMERIC(5,2),
  expected_booking_lift  NUMERIC(5,2),
  roi_estimate           TEXT,
  confidence             TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  sample_size            INTEGER,
  breakdown              JSONB DEFAULT '[]',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictive_scores_dealership
  ON predictive_scores(dealership_id, created_at DESC);

-- ── RLS Policies ──────────────────────────────────────────────

ALTER TABLE campaign_triggers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictive_scores   ENABLE ROW LEVEL SECURITY;

-- Triggers: members of the dealership can read + update their own
CREATE POLICY "campaign_triggers_select" ON campaign_triggers
  FOR SELECT USING (
    dealership_id IN (
      SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "campaign_triggers_update" ON campaign_triggers
  FOR UPDATE USING (
    dealership_id IN (
      SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
    )
  );

-- Sequences: members can read
CREATE POLICY "campaign_sequences_select" ON campaign_sequences
  FOR SELECT USING (
    dealership_id IN (
      SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
    )
  );

-- Predictive scores: members can read
CREATE POLICY "predictive_scores_select" ON predictive_scores
  FOR SELECT USING (
    dealership_id IN (
      SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
    )
  );

-- Service role bypass (used by server-side agents)
CREATE POLICY "campaign_triggers_service_all" ON campaign_triggers
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "campaign_sequences_service_all" ON campaign_sequences
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "predictive_scores_service_all" ON predictive_scores
  FOR ALL USING (auth.role() = 'service_role');
