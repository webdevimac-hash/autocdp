-- Add is_test flag to mail_pieces so test/demo sends are visually distinguished
ALTER TABLE mail_pieces ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for efficient "Recent Test Mails" queries
CREATE INDEX IF NOT EXISTS mail_pieces_is_test_dealership_idx
  ON mail_pieces (dealership_id, is_test, created_at DESC);

COMMENT ON COLUMN mail_pieces.is_test IS 'True when sent via the "Send Test Mail" demo flow (PostGrid test key; no physical mail printed)';
