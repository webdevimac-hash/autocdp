-- ============================================================
-- Extend ads_performance to support TikTok Ads
-- Migration: 20250515_ads_tiktok
-- ============================================================

-- Drop and recreate the platform CHECK constraint to add tiktok_ads
ALTER TABLE ads_performance
  DROP CONSTRAINT IF EXISTS ads_performance_platform_check;

ALTER TABLE ads_performance
  ADD CONSTRAINT ads_performance_platform_check
  CHECK (platform IN ('google_ads', 'meta_ads', 'tiktok_ads'));

-- Drop and recreate ads_push_log platform constraint too
ALTER TABLE ads_push_log
  DROP CONSTRAINT IF EXISTS ads_push_log_platform_check;

ALTER TABLE ads_push_log
  ADD CONSTRAINT ads_push_log_platform_check
  CHECK (platform IN ('google_ads', 'meta_ads', 'tiktok_ads'));

-- Add dms_connections provider support for tiktok_ads
-- (no schema change needed — provider is just text)
-- But let's add an index for it
CREATE INDEX IF NOT EXISTS idx_dms_connections_tiktok
  ON dms_connections (dealership_id, provider)
  WHERE provider = 'tiktok_ads';
