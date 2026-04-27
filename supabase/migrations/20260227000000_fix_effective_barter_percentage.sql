-- Fix effective_barter_percentage: join profiles on merchant_id and get barter_percentage directly

DROP VIEW IF EXISTS products_with_eligibility;

CREATE OR REPLACE VIEW products_with_eligibility AS
SELECT
  p.*,
  pc.name as category_name,
  pc.is_restricted as category_is_restricted,
  pc.restriction_reason,
  CASE
    WHEN NOT pc.barter_enabled THEN FALSE
    WHEN pc.is_restricted THEN FALSE
    WHEN NOT p.barter_enabled THEN FALSE
    ELSE TRUE
  END as is_barter_eligible,
  CASE
    WHEN NOT pc.barter_enabled THEN 'Category barter disabled'
    WHEN pc.is_restricted THEN pc.restriction_reason
    WHEN NOT p.barter_enabled THEN 'Product barter disabled'
    ELSE NULL
  END as reason,
  COALESCE(p.custom_barter_percentage, pr.barter_percentage, 25.00) as effective_barter_percentage,
  pi.provider as pos_provider,
  pi.store_id as pos_store_id,
  b.business_name,
  b.location as business_location,
  b.barter_percentage as business_barter_percentage
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
LEFT JOIN pos_integrations pi ON p.pos_integration_id = pi.id
LEFT JOIN businesses b ON p.business_id = b.id
LEFT JOIN profiles pr ON pr.user_id = p.merchant_id;

GRANT SELECT ON products_with_eligibility TO authenticated;
GRANT SELECT ON products_with_eligibility TO anon;
