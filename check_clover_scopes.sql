SELECT 
  id,
  provider,
  merchant_id,
  scopes,
  config,
  created_at
FROM pos_integrations
WHERE provider = 'clover'
ORDER BY created_at DESC
LIMIT 1;
