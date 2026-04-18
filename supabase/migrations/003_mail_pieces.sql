-- ============================================================
-- AutoCDP — Direct Mail: mail_pieces table + RLS
-- Run AFTER 002_rls_policies.sql
-- Provider: PostGrid (https://postgrid.com)
-- ============================================================

-- ── Template types supported ──────────────────────────────────
-- postcard_6x9   : 6×9 jumbo postcard (front + back), most popular
-- letter_6x9     : 6×9 folded self-mailer letter
-- letter_8.5x11  : standard letter in envelope

CREATE TYPE mail_template_type AS ENUM (
  'postcard_6x9',
  'letter_6x9',
  'letter_8.5x11'
);

CREATE TYPE mail_piece_status AS ENUM (
  'pending',        -- queued locally, not yet sent to PostGrid
  'processing',     -- accepted by PostGrid, being rendered
  'in_production',  -- print job started
  'in_transit',     -- handed to USPS/carrier
  'delivered',      -- confirmed delivered
  'returned',       -- returned to sender
  'cancelled',      -- cancelled before production
  'error'           -- PostGrid API error or invalid address
);

-- ============================================================
-- MAIL PIECES
-- One row per physical mail piece (postcard or letter).
-- Linked to customer, optional campaign, and PostGrid job ID.
-- ============================================================
CREATE TABLE mail_pieces (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id       UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  campaign_id         UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- What was sent
  template_type       mail_template_type NOT NULL,
  personalized_text   TEXT NOT NULL,               -- the AI-generated handwritten copy
  variables           JSONB DEFAULT '{}',           -- {vehicle, service_type, offer, technician, ...}

  -- QR tracking
  qr_code_url         TEXT,                         -- full tracking URL embedded in QR
  qr_image_data_url   TEXT,                         -- base64 PNG of the QR code (stored for reprints)

  -- PostGrid job reference
  postgrid_mail_id    TEXT,                         -- PostGrid's internal ID for the job
  postgrid_order_id   TEXT,                         -- PostGrid order ID (batch jobs)
  postgrid_status     TEXT,                         -- raw status string from PostGrid API
  postgrid_pdf_url    TEXT,                         -- proof PDF URL (PostGrid provides this)

  -- Lifecycle
  status              mail_piece_status NOT NULL DEFAULT 'pending',
  cost_cents          INTEGER DEFAULT 0,            -- actual cost confirmed by PostGrid
  estimated_delivery  TIMESTAMPTZ,                  -- PostGrid's estimated delivery date

  -- Engagement (via QR scan)
  scanned_count       INTEGER DEFAULT 0,
  first_scanned_at    TIMESTAMPTZ,
  last_scanned_at     TIMESTAMPTZ,

  -- Audit
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,                  -- when PostGrid confirmed acceptance
  delivered_at        TIMESTAMPTZ
);

-- Indexes for common access patterns
CREATE INDEX ON mail_pieces (dealership_id, status, created_at DESC);
CREATE INDEX ON mail_pieces (dealership_id, customer_id, created_at DESC);
CREATE INDEX ON mail_pieces (dealership_id, campaign_id);
CREATE INDEX ON mail_pieces (postgrid_mail_id) WHERE postgrid_mail_id IS NOT NULL;

-- ============================================================
-- MAIL SCANS  (QR code scan events — one row per scan)
-- Separate table so we get full scan history without bloating mail_pieces
-- ============================================================
CREATE TABLE mail_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mail_piece_id   UUID NOT NULL REFERENCES mail_pieces(id) ON DELETE CASCADE,
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  ip_address      TEXT,
  user_agent      TEXT,
  referrer        TEXT,
  scanned_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON mail_scans (mail_piece_id, scanned_at DESC);
CREATE INDEX ON mail_scans (dealership_id, scanned_at DESC);

-- ============================================================
-- TRIGGER: update scan stats on mail_pieces after each scan
-- ============================================================
CREATE OR REPLACE FUNCTION update_mail_piece_scan_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE mail_pieces
  SET
    scanned_count    = scanned_count + 1,
    last_scanned_at  = NOW(),
    first_scanned_at = COALESCE(first_scanned_at, NOW())
  WHERE id = NEW.mail_piece_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mail_scan_stats
  AFTER INSERT ON mail_scans
  FOR EACH ROW EXECUTE FUNCTION update_mail_piece_scan_stats();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE mail_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_scans  ENABLE ROW LEVEL SECURITY;

-- mail_pieces: full CRUD for authenticated users within their dealership
CREATE POLICY "mail_pieces_select" ON mail_pieces
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "mail_pieces_insert" ON mail_pieces
  FOR INSERT TO authenticated
  WITH CHECK (dealership_id = auth_dealership_id());

CREATE POLICY "mail_pieces_update" ON mail_pieces
  FOR UPDATE TO authenticated
  USING (dealership_id = auth_dealership_id())
  WITH CHECK (dealership_id = auth_dealership_id());

-- Service role can do anything (needed for webhook updates)
CREATE POLICY "mail_pieces_service_all" ON mail_pieces
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- mail_scans: readable by dealership, writable by anyone (tracking links are public)
-- The /track/[id] page uses service_role to insert scans
CREATE POLICY "mail_scans_select" ON mail_scans
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "mail_scans_service_all" ON mail_scans
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- Add mail_pieces to Database type (comment for reference)
-- Update src/types/index.ts after running this migration.
-- ============================================================
