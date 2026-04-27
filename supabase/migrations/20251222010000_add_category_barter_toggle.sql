-- Migration: Add barter_enabled to product_categories
-- Purpose: Allow merchants to enable/disable barter at category level

-- Add barter_enabled field to product_categories
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS barter_enabled BOOLEAN DEFAULT true;

-- Update restricted categories to have barter disabled by default
-- (Alcohol, Tobacco, Lottery, Gift Cards, Pharmacy, Firearms)
UPDATE product_categories
SET barter_enabled = false
WHERE is_restricted = true;

-- All non-restricted categories should have barter enabled by default
UPDATE product_categories
SET barter_enabled = true
WHERE is_restricted = false;

-- Add comment
COMMENT ON COLUMN product_categories.barter_enabled IS 'Allows merchants to enable/disable barter for entire category. Restricted categories are always disabled.';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_product_categories_barter_enabled
ON product_categories(barter_enabled);
