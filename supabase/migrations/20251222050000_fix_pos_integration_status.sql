-- Migration: Fix POS integration status
-- Some integrations may be in 'pending' status after OAuth reconnect

-- Update all Shopify integrations to 'active' status if they have access_token
UPDATE pos_integrations
SET status = 'active'
WHERE provider = 'shopify'
  AND access_token IS NOT NULL
  AND access_token != ''
  AND status != 'active';

-- Add comment
COMMENT ON COLUMN pos_integrations.status IS 'Integration status: pending, active, error, revoked';
