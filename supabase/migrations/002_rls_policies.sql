-- ============================================================
-- AutoCDP — Row Level Security Policies
-- Every table is isolated by dealership_id.
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- HELPER: get the current user's active dealership_id
-- Called from RLS policies — SECURITY DEFINER so it can read
-- user_dealerships regardless of caller's role.
-- ============================================================
CREATE OR REPLACE FUNCTION auth_dealership_id()
RETURNS UUID AS $$
  SELECT dealership_id
  FROM user_dealerships
  WHERE user_id = auth.uid()
  ORDER BY created_at
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Returns the user's role within their dealership
CREATE OR REPLACE FUNCTION auth_dealership_role()
RETURNS TEXT AS $$
  SELECT role
  FROM user_dealerships
  WHERE user_id = auth.uid() AND dealership_id = auth_dealership_id()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE dealerships        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dealerships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_outcomes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events     ENABLE ROW LEVEL SECURITY;
-- global_learnings is read-only for all authenticated users (anonymized)
ALTER TABLE global_learnings   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DEALERSHIPS
-- ============================================================
CREATE POLICY "dealerships_select" ON dealerships
  FOR SELECT TO authenticated
  USING (id = auth_dealership_id());

-- Only service role can INSERT dealerships (done via server-side API)
CREATE POLICY "dealerships_service_all" ON dealerships
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- USER_DEALERSHIPS
-- ============================================================
CREATE POLICY "user_dealerships_select_own" ON user_dealerships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_dealerships_service_all" ON user_dealerships
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE POLICY "customers_select" ON customers
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "customers_insert" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (dealership_id = auth_dealership_id());

CREATE POLICY "customers_update" ON customers
  FOR UPDATE TO authenticated
  USING (dealership_id = auth_dealership_id())
  WITH CHECK (dealership_id = auth_dealership_id());

CREATE POLICY "customers_delete" ON customers
  FOR DELETE TO authenticated
  USING (
    dealership_id = auth_dealership_id()
    AND auth_dealership_role() IN ('owner', 'admin')
  );

-- ============================================================
-- VISITS
-- ============================================================
CREATE POLICY "visits_select" ON visits
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "visits_insert" ON visits
  FOR INSERT TO authenticated
  WITH CHECK (dealership_id = auth_dealership_id());

CREATE POLICY "visits_update" ON visits
  FOR UPDATE TO authenticated
  USING (dealership_id = auth_dealership_id())
  WITH CHECK (dealership_id = auth_dealership_id());

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE POLICY "campaigns_select" ON campaigns
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "campaigns_insert" ON campaigns
  FOR INSERT TO authenticated
  WITH CHECK (dealership_id = auth_dealership_id());

CREATE POLICY "campaigns_update" ON campaigns
  FOR UPDATE TO authenticated
  USING (dealership_id = auth_dealership_id())
  WITH CHECK (dealership_id = auth_dealership_id());

CREATE POLICY "campaigns_delete" ON campaigns
  FOR DELETE TO authenticated
  USING (
    dealership_id = auth_dealership_id()
    AND auth_dealership_role() IN ('owner', 'admin')
  );

-- ============================================================
-- COMMUNICATIONS
-- ============================================================
CREATE POLICY "communications_select" ON communications
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "communications_insert" ON communications
  FOR INSERT TO authenticated
  WITH CHECK (dealership_id = auth_dealership_id());

-- ============================================================
-- LEARNING OUTCOMES
-- ============================================================
CREATE POLICY "learning_outcomes_select" ON learning_outcomes
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "learning_outcomes_insert" ON learning_outcomes
  FOR INSERT TO authenticated
  WITH CHECK (dealership_id = auth_dealership_id());

-- ============================================================
-- AGENT RUNS
-- ============================================================
CREATE POLICY "agent_runs_select" ON agent_runs
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

CREATE POLICY "agent_runs_insert" ON agent_runs
  FOR INSERT TO authenticated
  WITH CHECK (dealership_id = auth_dealership_id());

-- ============================================================
-- BILLING EVENTS
-- ============================================================
CREATE POLICY "billing_events_select" ON billing_events
  FOR SELECT TO authenticated
  USING (dealership_id = auth_dealership_id());

-- Only service role writes billing events (server-side)
CREATE POLICY "billing_events_service_all" ON billing_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- GLOBAL LEARNINGS  (anonymized — all authenticated users can read)
-- ============================================================
CREATE POLICY "global_learnings_select" ON global_learnings
  FOR SELECT TO authenticated
  USING (true);

-- Only service role writes global learnings
CREATE POLICY "global_learnings_service_all" ON global_learnings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- SAMPLE SEED DATA (optional — for local dev)
-- Uncomment and run manually if desired
-- ============================================================
/*
INSERT INTO dealerships (name, slug, website_url, phone, address) VALUES
  ('Sunrise Ford', 'sunrise-ford', 'https://sunriseford.example.com', '555-100-2000',
   '{"street":"123 Auto Row","city":"Phoenix","state":"AZ","zip":"85001"}'::jsonb),
  ('Bay Area BMW', 'bay-area-bmw', 'https://bayareabmw.example.com', '555-200-3000',
   '{"street":"456 Motor Mile","city":"San Jose","state":"CA","zip":"95110"}'::jsonb);
*/
