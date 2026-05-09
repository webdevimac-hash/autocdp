-- 023: Campaign Templates
-- Reusable message templates for direct mail, SMS, and email.
-- Includes AI-suggested templates (is_ai_suggested=true) and dealer-created ones.
-- Credit tier targeting and lifecycle stage filtering are stored as arrays.

CREATE TABLE campaign_templates (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id       UUID        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  channel             TEXT        NOT NULL CHECK (channel IN ('direct_mail', 'sms', 'email')),
  subject             TEXT,                           -- email subject; null for sms/mail
  body                TEXT        NOT NULL,           -- template body with {placeholders}

  -- Campaign purpose categorization
  goal                TEXT        CHECK (goal IN (
                        'service_reminder', 'win_back', 'aged_inventory',
                        'vip_appreciation', 'seasonal', 'financing', 'general'
                      )),
  tone                TEXT        NOT NULL DEFAULT 'friendly'
                      CHECK (tone IN ('friendly', 'urgent', 'premium', 'casual', 'professional')),

  -- Audience targeting hints (empty arrays = all)
  credit_tiers        TEXT[]      NOT NULL DEFAULT '{}',
  lifecycle_stages    TEXT[]      NOT NULL DEFAULT '{}',

  -- Performance tracking (updated when template is used in campaigns)
  times_used          INTEGER     NOT NULL DEFAULT 0,
  avg_response_rate   DECIMAL(5,2),                  -- open/scan/click rate avg across uses

  -- Source
  is_ai_suggested     BOOLEAN     NOT NULL DEFAULT false,
  ai_rationale        TEXT,                           -- why AI suggested this
  performance_basis   TEXT,                           -- description of patterns this was derived from

  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX campaign_templates_dealership_idx  ON campaign_templates (dealership_id, is_active);
CREATE INDEX campaign_templates_channel_idx     ON campaign_templates (dealership_id, channel);

CREATE TRIGGER update_campaign_templates_updated_at
  BEFORE UPDATE ON campaign_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealership members can view their templates"
  ON campaign_templates FOR SELECT
  USING (auth_dealership_id() = dealership_id);

CREATE POLICY "Dealership members can manage their templates"
  ON campaign_templates FOR ALL
  USING (auth_dealership_id() = dealership_id)
  WITH CHECK (auth_dealership_id() = dealership_id);

CREATE POLICY "Service role full access"
  ON campaign_templates FOR ALL TO service_role
  USING (true) WITH CHECK (true);
