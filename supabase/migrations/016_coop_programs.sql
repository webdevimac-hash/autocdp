-- Migration 016: Manufacturer Co-op Programs
-- Stores co-op advertising program definitions per dealership.
-- The Co-op Agent reads these at campaign run time to check eligibility,
-- generate compliant copy guidelines, and estimate reimbursement.

CREATE TABLE IF NOT EXISTS dealership_coop_programs (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id           UUID          NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  manufacturer            TEXT          NOT NULL,           -- e.g. "Ford Motor Company"
  program_name            TEXT          NOT NULL,           -- e.g. "Ford Parts Summer Service Event"
  eligible_makes          TEXT[]        NOT NULL DEFAULT '{}',        -- empty = all makes
  eligible_model_years    INTEGER[]     NOT NULL DEFAULT '{}',        -- empty = all years
  reimbursement_rate      NUMERIC(5,4)  NOT NULL DEFAULT 0.50,        -- 0.0–1.0
  max_reimbursement_usd   NUMERIC(10,2) NULL,                         -- null = no cap
  required_disclaimers    TEXT[]        NOT NULL DEFAULT '{}',
  copy_guidelines         TEXT          NOT NULL DEFAULT '',
  eligibility_requirements TEXT         NOT NULL DEFAULT '',
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  valid_from              DATE          NULL,
  valid_through           DATE          NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dealership_coop_programs_dealership_active_idx
  ON dealership_coop_programs(dealership_id, is_active);

CREATE INDEX IF NOT EXISTS dealership_coop_programs_validity_idx
  ON dealership_coop_programs(valid_through)
  WHERE valid_through IS NOT NULL;

ALTER TABLE dealership_coop_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON dealership_coop_programs
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dealership_coop_programs_updated_at
  BEFORE UPDATE ON dealership_coop_programs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Example seed (commented out — run manually per dealership)
-- INSERT INTO dealership_coop_programs (
--   dealership_id, manufacturer, program_name,
--   eligible_makes, eligible_model_years,
--   reimbursement_rate, max_reimbursement_usd,
--   required_disclaimers, copy_guidelines, eligibility_requirements,
--   valid_from, valid_through
-- ) VALUES (
--   '<dealership_uuid>',
--   'Ford Motor Company',
--   'Ford Summer Service Event 2026',
--   ARRAY['Ford','Lincoln'],
--   ARRAY[2019,2020,2021,2022,2023,2024,2025,2026],
--   0.50,
--   500.00,
--   ARRAY[
--     'Ford Motor Company Co-op Advertising. Dealer participation required.',
--     'See dealer for complete details. Offer expires 8/31/2026.'
--   ],
--   'Must mention "Ford Certified Service". Use tagline "Go Further." in headline. Do NOT reference competitor brands. Include offer expiration date. Approved offers: oil change, tire rotation, multi-point inspection.',
--   'Must be enrolled in Ford Co-op program. Campaign must run 6/1–8/31/2026. Submit invoice within 60 days of campaign end.',
--   '2026-06-01',
--   '2026-08-31'
-- );
