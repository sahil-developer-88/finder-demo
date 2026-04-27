-- Migration: Add encrypted token columns
-- Created: 2025-12-23
-- Purpose: Add columns for storing POS OAuth tokens (encryption handled at app level)

-- Add encrypted token columns to pos_integrations
ALTER TABLE pos_integrations
ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS encryption_nonce TEXT;

-- Copy existing tokens to encrypted columns (app will handle actual encryption)
UPDATE pos_integrations
SET
  access_token_encrypted = access_token,
  refresh_token_encrypted = refresh_token
WHERE access_token_encrypted IS NULL
  AND access_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN pos_integrations.access_token_encrypted IS 'Encrypted POS access token (encrypted at application level)';
COMMENT ON COLUMN pos_integrations.refresh_token_encrypted IS 'Encrypted POS refresh token (encrypted at application level)';

-- Note: Do NOT drop plaintext columns yet
-- This allows for gradual migration and rollback if needed
-- After verifying encrypted tokens work, run a separate migration to:
-- ALTER TABLE pos_integrations DROP COLUMN access_token;
-- ALTER TABLE pos_integrations DROP COLUMN refresh_token;
