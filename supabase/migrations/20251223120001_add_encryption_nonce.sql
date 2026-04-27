-- Add missing encryption_nonce column
ALTER TABLE pos_integrations
ADD COLUMN IF NOT EXISTS encryption_nonce TEXT;

COMMENT ON COLUMN pos_integrations.encryption_nonce IS 'Nonce/salt used for token encryption';
