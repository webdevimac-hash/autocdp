-- ============================================================
-- AutoCDP — Monthly Newsletter Feature
-- Run in Supabase SQL Editor or via: supabase db push
-- ============================================================

CREATE TABLE newsletters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL,
  preview_text    TEXT,
  sections        JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sending', 'sent')),
  sent_at         TIMESTAMPTZ,
  recipient_count INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE newsletter_rsvps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id   UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  event_key       TEXT NOT NULL DEFAULT 'event',
  response        TEXT NOT NULL CHECK (response IN ('yes', 'no')),
  customer_name   TEXT,
  customer_email  TEXT,
  responded_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX newsletters_dealership_idx     ON newsletters(dealership_id, created_at DESC);
CREATE INDEX newsletter_rsvps_newsletter_idx ON newsletter_rsvps(newsletter_id, event_key);

-- RLS
ALTER TABLE newsletters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_newsletters"
  ON newsletters TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_rsvps"
  ON newsletter_rsvps TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_rw_newsletters"
  ON newsletters FOR ALL TO authenticated
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ))
  WITH CHECK (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));

CREATE POLICY "public_read_rsvps"
  ON newsletter_rsvps FOR SELECT TO anon USING (true);

CREATE POLICY "public_insert_rsvps"
  ON newsletter_rsvps FOR INSERT TO anon WITH CHECK (true);
