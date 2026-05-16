-- ============================================================
-- Google Business Profile — Reviews, Posts, Q&A
-- Migration: 20250516_gbp_reviews
-- ============================================================
-- Caches GBP data locally so the dashboard renders fast and
-- works even when the GBP API is temporarily unavailable.
-- The cron job (POST /api/cron/gbp-sync) keeps it fresh.

-- ── gbp_reviews: one row per Google review ──────────────────
CREATE TABLE IF NOT EXISTS gbp_reviews (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id       uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  -- Google's full resource name: accounts/.../locations/.../reviews/...
  gbp_review_id       text        NOT NULL,

  -- Reviewer info
  reviewer_name       text,
  reviewer_photo_url  text,

  -- Review content
  rating              text        NOT NULL
                      CHECK (rating IN ('ONE','TWO','THREE','FOUR','FIVE')),
  rating_int          smallint    GENERATED ALWAYS AS (
    CASE rating
      WHEN 'ONE'   THEN 1 WHEN 'TWO'   THEN 2 WHEN 'THREE' THEN 3
      WHEN 'FOUR'  THEN 4 WHEN 'FIVE'  THEN 5 ELSE 0
    END
  ) STORED,
  comment             text,
  create_time         timestamptz,
  update_time         timestamptz,

  -- Reply state
  reply_comment       text,
  reply_update_time   timestamptz,
  reply_is_ai         boolean     NOT NULL DEFAULT false,
  reply_status        text        NOT NULL DEFAULT 'none'
                      CHECK (reply_status IN ('none','draft','posted','deleted')),

  -- Sync bookkeeping
  synced_at           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (dealership_id, gbp_review_id)
);

CREATE INDEX IF NOT EXISTS idx_gbp_reviews_dealership
  ON gbp_reviews (dealership_id, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_gbp_reviews_reply_status
  ON gbp_reviews (dealership_id, reply_status)
  WHERE reply_status = 'none';

ALTER TABLE gbp_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage gbp_reviews"
  ON gbp_reviews FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role gbp_reviews"
  ON gbp_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── gbp_posts: business updates / local posts ────────────────
CREATE TABLE IF NOT EXISTS gbp_posts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id         uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  -- null until successfully pushed to GBP
  gbp_post_id           text,

  topic_type            text        NOT NULL DEFAULT 'STANDARD'
                        CHECK (topic_type IN ('STANDARD','EVENT','OFFER','ALERT')),
  language_code         text        NOT NULL DEFAULT 'en-US',
  summary               text        NOT NULL,

  -- Call-to-action
  call_to_action_type   text
                        CHECK (call_to_action_type IN (
                          'LEARN_MORE','BOOK','SHOP','ORDER','SIGN_UP','CALL'
                        )),
  call_to_action_url    text,

  -- Event fields (topic_type = EVENT)
  event_title           text,
  event_start_date      date,
  event_end_date        date,

  -- Offer fields (topic_type = OFFER)
  offer_coupon_code     text,
  offer_redeem_online_url text,

  -- State
  state                 text        NOT NULL DEFAULT 'draft'
                        CHECK (state IN ('draft','live','rejected','deleted')),
  is_ai_generated       boolean     NOT NULL DEFAULT false,
  create_time           timestamptz,
  update_time           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbp_posts_dealership
  ON gbp_posts (dealership_id, state, created_at DESC);

ALTER TABLE gbp_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage gbp_posts"
  ON gbp_posts FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role gbp_posts"
  ON gbp_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── gbp_qanda: questions & answers ──────────────────────────
CREATE TABLE IF NOT EXISTS gbp_qanda (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id       uuid        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,

  -- Google resource name: accounts/.../locations/.../questions/...
  gbp_question_id     text        NOT NULL,

  question_text       text        NOT NULL,
  author_name         text,
  question_time       timestamptz,
  upvote_count        integer     NOT NULL DEFAULT 0,

  -- Best answer (ours or top community answer)
  answer_text         text,
  answer_author       text,
  answer_time         timestamptz,
  answer_upvote_count integer     NOT NULL DEFAULT 0,
  answer_is_ai        boolean     NOT NULL DEFAULT false,
  answer_status       text        NOT NULL DEFAULT 'unanswered'
                      CHECK (answer_status IN ('unanswered','draft','posted')),

  synced_at           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (dealership_id, gbp_question_id)
);

CREATE INDEX IF NOT EXISTS idx_gbp_qanda_dealership
  ON gbp_qanda (dealership_id, question_time DESC);
CREATE INDEX IF NOT EXISTS idx_gbp_qanda_unanswered
  ON gbp_qanda (dealership_id, answer_status)
  WHERE answer_status = 'unanswered';

ALTER TABLE gbp_qanda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealership members can manage gbp_qanda"
  ON gbp_qanda FOR ALL
  USING (dealership_id IN (
    SELECT dealership_id FROM user_dealerships WHERE user_id = auth.uid()
  ));
CREATE POLICY "service role gbp_qanda"
  ON gbp_qanda FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── updated_at trigger for gbp_posts ─────────────────────────
CREATE OR REPLACE FUNCTION update_gbp_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gbp_posts_updated_at ON gbp_posts;
CREATE TRIGGER trg_gbp_posts_updated_at
  BEFORE UPDATE ON gbp_posts
  FOR EACH ROW EXECUTE FUNCTION update_gbp_posts_updated_at();
