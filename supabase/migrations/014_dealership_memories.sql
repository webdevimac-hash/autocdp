-- Dealer guidance & memories: soft suggestions Bryant/admin can add to influence AI tone,
-- offers, style, and things to avoid. Injected as soft guidance into the agent swarm.

CREATE TABLE IF NOT EXISTS dealership_memories (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  category      TEXT        NOT NULL DEFAULT 'general',
  title         TEXT        NOT NULL,
  content       TEXT        NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- category values: 'tone' | 'offers' | 'avoid' | 'style' | 'general'
ALTER TABLE dealership_memories ADD CONSTRAINT chk_memory_category
  CHECK (category IN ('tone', 'offers', 'avoid', 'style', 'general'));

CREATE INDEX idx_dealership_memories_dealership ON dealership_memories (dealership_id, is_active);

ALTER TABLE dealership_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their dealership memories" ON dealership_memories
  FOR ALL USING (dealership_id = auth_dealership_id());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_dealership_memories_updated_at'
  ) THEN
    CREATE TRIGGER update_dealership_memories_updated_at
      BEFORE UPDATE ON dealership_memories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
