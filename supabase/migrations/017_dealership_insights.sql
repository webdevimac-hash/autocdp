-- 017: Dealership Insights
-- Auto-generated behavioral insights per dealership: trade-in trends, top vehicles,
-- popular colors, inventory turnover, customer sentiment, and Google review themes.
-- Refreshed on demand or on a schedule. Agents read these as soft guidance context.

CREATE TABLE dealership_insights (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id  UUID        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  insight_type   TEXT        NOT NULL,
  -- Values: trade_in_lines | top_vehicles | popular_colors | inventory_turnover
  --         sentiment_patterns | google_review_trends
  title          TEXT        NOT NULL,
  summary        TEXT        NOT NULL DEFAULT '',
  data           JSONB       NOT NULL DEFAULT '{}',
  dealer_notes   TEXT,
  refreshed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per insight_type per dealership (upsert semantics via onConflict)
CREATE UNIQUE INDEX dealership_insights_type_idx
  ON dealership_insights (dealership_id, insight_type);

CREATE INDEX dealership_insights_dealership_idx
  ON dealership_insights (dealership_id);

CREATE TRIGGER update_dealership_insights_updated_at
  BEFORE UPDATE ON dealership_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE dealership_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealership members can view their insights"
  ON dealership_insights FOR SELECT
  USING (auth_dealership_id() = dealership_id);

CREATE POLICY "Dealership members can update dealer notes"
  ON dealership_insights FOR UPDATE
  USING (auth_dealership_id() = dealership_id)
  WITH CHECK (auth_dealership_id() = dealership_id);

-- Service role (server-side write path) bypasses RLS via the Supabase service key,
-- but we add explicit policies so the intent is clear.
CREATE POLICY "Service role full access"
  ON dealership_insights FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
