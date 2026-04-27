-- Check existing Shopify integrations
SELECT 
  id,
  user_id,
  provider,
  status,
  scopes,
  store_id,
  created_at
FROM pos_integrations 
WHERE provider = 'shopify' 
ORDER BY created_at DESC 
LIMIT 5;
