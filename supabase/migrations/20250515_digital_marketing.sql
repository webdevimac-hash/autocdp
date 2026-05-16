-- ============================================================
-- AutoCDP — Digital Marketing Agent (Agent #6)
-- Migration: 20250515_digital_marketing
-- ============================================================

-- ── 1. Digital Marketing Playbook ───────────────────────────
-- Per-dealership strategic playbook, evolves with every cycle.

CREATE TABLE IF NOT EXISTS dm_playbook (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  version         integer     NOT NULL DEFAULT 1,
  content         jsonb       NOT NULL DEFAULT '{}',
  -- content shape: {
  --   budget_allocation: { google_ads: %, meta_ads: %, tiktok_ads: %, owned: % },
  --   top_audiences:     [{ name, description, platforms, priority }],
  --   creative_principles: [{ principle, rationale, evidence_count }],
  --   bidding_strategy:  { google: string, meta: string, tiktok: string },
  --   seasonal_patterns: [{ month_range, recommendation }],
  --   offer_library:     [{ offer_text, channel, ctr_lift, conversions }],
  --   channel_mix:       { awareness: [...], consideration: [...], conversion: [...] }
  -- }
  generated_by    text        NOT NULL DEFAULT 'digital-marketing-agent',
  is_current      boolean     NOT NULL DEFAULT true,
  performance_since timestamptz,   -- data window this version was trained on
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_playbook_dealership
  ON dm_playbook (dealership_id, is_current, version DESC);

ALTER TABLE dm_playbook ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can read their playbook"
  ON dm_playbook FOR SELECT
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));

-- ── 2. Digital Marketing Campaigns ──────────────────────────
-- Agent-managed paid campaigns across Google, Meta, TikTok.

CREATE TABLE IF NOT EXISTS dm_campaigns (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id         uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  platform              text        NOT NULL CHECK (platform IN ('google_ads', 'meta_ads', 'tiktok_ads')),
  platform_campaign_id  text,                     -- native platform ID after launch
  name                  text        NOT NULL,
  objective             text        NOT NULL
                        CHECK (objective IN ('awareness', 'consideration', 'conversion', 'retention', 'conquest')),
  funnel_stage          text        NOT NULL DEFAULT 'conversion'
                        CHECK (funnel_stage IN ('top', 'mid', 'bottom')),
  status                text        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pending_approval', 'active', 'paused', 'completed', 'rejected')),
  budget_daily_usd      numeric(10,2),
  budget_total_usd      numeric(10,2),
  start_date            date,
  end_date              date,
  targeting             jsonb       NOT NULL DEFAULT '{}',
  creative_brief        text,
  ad_copy               jsonb       NOT NULL DEFAULT '{}',   -- headlines, descriptions, CTAs
  agent_rationale       text,
  approval_id           uuid,                               -- links to dm_approvals
  approved_by           text,
  approved_at           timestamptz,
  platform_response     jsonb       NOT NULL DEFAULT '{}',  -- raw API response on push
  performance_snapshot  jsonb       NOT NULL DEFAULT '{}',  -- cached KPIs from last sync
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_campaigns_dealership
  ON dm_campaigns (dealership_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_campaigns_platform
  ON dm_campaigns (dealership_id, platform, status);

ALTER TABLE dm_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage dm_campaigns"
  ON dm_campaigns FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));

-- ── 3. Learning Patterns ─────────────────────────────────────
-- Cross-channel patterns distilled by the Digital Marketing Agent.
-- dealership_id = null means global (no PII, anonymized).

CREATE TABLE IF NOT EXISTS dm_learning_patterns (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid        REFERENCES dealerships(id) ON DELETE CASCADE,
  pattern_type  text        NOT NULL
                CHECK (pattern_type IN (
                  'creative', 'audience', 'timing', 'offer',
                  'bidding', 'channel_mix', 'funnel', 'seasonal'
                )),
  title         text        NOT NULL,
  description   text        NOT NULL,
  confidence    numeric(4,2) NOT NULL DEFAULT 0.50 CHECK (confidence BETWEEN 0 AND 1),
  evidence      jsonb       NOT NULL DEFAULT '{}',  -- what data supports this
  platforms     text[]      NOT NULL DEFAULT '{}',
  is_active     boolean     NOT NULL DEFAULT true,
  applied_count integer     NOT NULL DEFAULT 0,     -- times used in real campaigns
  win_rate      numeric(4,2),                       -- % of times it improved KPI
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_patterns_dealership
  ON dm_learning_patterns (dealership_id, is_active, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_dm_patterns_global
  ON dm_learning_patterns (pattern_type, is_active, confidence DESC)
  WHERE dealership_id IS NULL;

ALTER TABLE dm_learning_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can read dm_learning_patterns"
  ON dm_learning_patterns FOR SELECT
  USING (
    dealership_id IS NULL
    OR dealership_id IN (
      SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "dealership members can insert dm_learning_patterns"
  ON dm_learning_patterns FOR INSERT
  WITH CHECK (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));

-- ── 4. Spend Approval Requests ───────────────────────────────
-- The agent must request dealer approval before spending money.

CREATE TABLE IF NOT EXISTS dm_approvals (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id         uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  approval_type         text        NOT NULL
                        CHECK (approval_type IN (
                          'campaign_launch', 'budget_increase',
                          'new_platform', 'creative_push', 'strategy_shift'
                        )),
  title                 text        NOT NULL,
  description           text        NOT NULL,
  recommended_spend_usd numeric(10,2),
  predicted_roi         text,
  predicted_impressions bigint,
  predicted_clicks      bigint,
  status                text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  agent_reasoning       text,
  payload               jsonb       NOT NULL DEFAULT '{}',   -- what to execute on approval
  responded_by          text,
  responded_at          timestamptz,
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_approvals_dealership
  ON dm_approvals (dealership_id, status, created_at DESC);

ALTER TABLE dm_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage dm_approvals"
  ON dm_approvals FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));

-- ── 5. Attribution Events ────────────────────────────────────
-- Multi-channel attribution: tie ad clicks → CRM leads → sales.

CREATE TABLE IF NOT EXISTS dm_attribution (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  customer_id     uuid        REFERENCES customers(id) ON DELETE SET NULL,
  session_id      text,
  touch_channel   text        NOT NULL
                  CHECK (touch_channel IN (
                    'google_ads', 'meta_ads', 'tiktok_ads',
                    'direct_mail', 'sms', 'email', 'organic', 'referral'
                  )),
  touch_type      text        NOT NULL
                  CHECK (touch_type IN (
                    'impression', 'click', 'lead', 'appointment', 'sale'
                  )),
  platform_ad_id  text,       -- platform's ad ID that drove the touch
  campaign_name   text,
  revenue_usd     numeric(12,2),   -- only for sale events
  metadata        jsonb       NOT NULL DEFAULT '{}',
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_attribution_dealership
  ON dm_attribution (dealership_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_attribution_customer
  ON dm_attribution (customer_id, occurred_at DESC)
  WHERE customer_id IS NOT NULL;

ALTER TABLE dm_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can read dm_attribution"
  ON dm_attribution FOR SELECT
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
