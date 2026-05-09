-- ── Invoices ────────────────────────────────────────────────────────────────
-- Monthly billing invoices for dealer groups.
-- One invoice per dealership per billing period (year+month unique constraint).

CREATE TABLE IF NOT EXISTS invoices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id          UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  invoice_number         TEXT NOT NULL UNIQUE,
  billing_month          INT  NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  billing_year           INT  NOT NULL,
  line_items             JSONB NOT NULL DEFAULT '[]',
  base_fee_cents         INT  NOT NULL DEFAULT 0,
  usage_cents            INT  NOT NULL DEFAULT 0,
  subtotal_cents         INT  NOT NULL DEFAULT 0,
  status                 TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  payment_method         TEXT,           -- 'card' | 'ach' | 'check' | null
  controller_email       TEXT,
  controller_notified_at TIMESTAMPTZ,
  sent_at                TIMESTAMPTZ,
  due_date               DATE,
  paid_at                TIMESTAMPTZ,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One invoice per dealership per billing period
CREATE UNIQUE INDEX IF NOT EXISTS invoices_dealership_period_idx
  ON invoices (dealership_id, billing_year, billing_month);

CREATE INDEX IF NOT EXISTS invoices_dealership_status_idx
  ON invoices (dealership_id, status, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_invoices" ON invoices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_invoices" ON invoices
  FOR SELECT TO authenticated
  USING (
    dealership_id IN (
      SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
    )
  );
