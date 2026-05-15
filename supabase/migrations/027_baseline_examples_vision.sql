-- ============================================================
-- AutoCDP — Migration 027: Baseline Examples Vision Support
-- Adds file upload support (image/PDF) to baseline_mail_examples.
-- Dealers can now upload scanned mailers; Claude Vision extracts
-- copy text + a detailed visual layout description at save time.
-- ============================================================

-- Extend baseline_mail_examples with vision columns
ALTER TABLE baseline_mail_examples
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'text'
      CHECK (source_type IN ('text', 'image', 'pdf')),
  ADD COLUMN IF NOT EXISTS file_url     TEXT,          -- public Storage URL
  ADD COLUMN IF NOT EXISTS visual_description TEXT;    -- AI-generated layout analysis

-- Allow example_text to be empty for image-only rows where OCR yields nothing
ALTER TABLE baseline_mail_examples
  ALTER COLUMN example_text SET DEFAULT '';

-- ── Supabase Storage: mail-examples bucket ────────────────────
-- Creates the bucket if it doesn't already exist.
-- Set public = true so the Creative Agent can reference file URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mail-examples',
  'mail-examples',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: service role can write; authenticated users can read their own
-- CREATE POLICY does not support IF NOT EXISTS, so we use DO blocks to guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'mail_examples_storage_service_all'
  ) THEN
    CREATE POLICY "mail_examples_storage_service_all"
      ON storage.objects FOR ALL
      USING (bucket_id = 'mail-examples' AND auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'mail_examples_storage_authenticated_read'
  ) THEN
    CREATE POLICY "mail_examples_storage_authenticated_read"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'mail-examples');
  END IF;
END $$;
