-- ============================================================
-- AutoCDP Migration 006 — Call Logs (Voice Agent)
-- ============================================================

CREATE TABLE IF NOT EXISTS call_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  direction       TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  from_number     TEXT,
  to_number       TEXT,
  duration_seconds INTEGER,
  status          TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in-progress', 'completed', 'busy', 'no-answer', 'failed', 'canceled')),
  outcome         TEXT CHECK (outcome IN ('appointment_booked', 'callback_requested', 'not_interested', 'voicemail', 'no_answer', 'other')),
  ai_summary      TEXT,
  recording_url   TEXT,
  twilio_call_sid TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealership members can manage their call logs"
  ON call_logs FOR ALL
  USING (dealership_id = auth_dealership_id());

CREATE INDEX call_logs_dealership_idx ON call_logs (dealership_id, created_at DESC);
CREATE INDEX call_logs_customer_idx ON call_logs (customer_id) WHERE customer_id IS NOT NULL;
