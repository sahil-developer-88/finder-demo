-- Add metadata column to oauth_states table to store provider-specific data
-- This allows storing shop_name for Shopify and Lightspeed OAuth flows
ALTER TABLE public.oauth_states
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.oauth_states.metadata IS 'Provider-specific metadata (e.g., shop_name for Shopify/Lightspeed)';
