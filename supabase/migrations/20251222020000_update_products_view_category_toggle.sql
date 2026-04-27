-- Migration: Update products_with_eligibility view to include category barter_enabled
-- Purpose: Ensure category-level barter toggles affect product eligibility

-- Drop and recreate the view with updated logic
DROP VIEW IF EXISTS products_with_eligibility;

CREATE VIEW products_with_eligibility AS
SELECT
  p.*,
  pc.name as category_name,
  pc.is_restricted as category_is_restricted,
  pc.restriction_reason,
  pc.barter_enabled as category_barter_enabled,
  CASE
    WHEN NOT p.barter_enabled THEN false
    WHEN pc.is_restricted THEN false
    WHEN NOT COALESCE(pc.barter_enabled, true) THEN false  -- Category-level toggle
    WHEN NOT p.is_active THEN false
    ELSE true
  END as is_barter_eligible,
  COALESCE(
    p.custom_barter_percentage,
    (SELECT barter_percentage FROM businesses WHERE user_id = p.merchant_id LIMIT 1),
    (SELECT barter_percentage FROM profiles WHERE user_id = p.merchant_id LIMIT 1),
    25.00
  ) as effective_barter_percentage,
  pi.provider as pos_provider,
  pi.store_id as pos_store_id
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
LEFT JOIN pos_integrations pi ON pi.id = p.pos_integration_id
WHERE p.is_archived = false;

-- Grant access to the view
GRANT SELECT ON products_with_eligibility TO authenticated;

-- Update the eligibility function as well
CREATE OR REPLACE FUNCTION get_product_barter_eligibility(product_id UUID)
RETURNS TABLE (
  is_eligible BOOLEAN,
  reason TEXT,
  barter_percentage DECIMAL
) AS $$
  SELECT
    CASE
      WHEN NOT p.barter_enabled THEN false
      WHEN pc.is_restricted THEN false
      WHEN NOT COALESCE(pc.barter_enabled, true) THEN false  -- Category-level toggle
      WHEN NOT p.is_active THEN false
      ELSE true
    END as is_eligible,
    CASE
      WHEN NOT p.barter_enabled THEN 'Barter disabled for this product'
      WHEN pc.is_restricted THEN pc.restriction_reason
      WHEN NOT COALESCE(pc.barter_enabled, true) THEN 'Barter disabled for category: ' || pc.name
      WHEN NOT p.is_active THEN 'Product is not active'
      ELSE 'Eligible for barter'
    END as reason,
    COALESCE(
      p.custom_barter_percentage,
      (SELECT barter_percentage FROM businesses WHERE user_id = p.merchant_id LIMIT 1),
      (SELECT barter_percentage FROM profiles WHERE user_id = p.merchant_id LIMIT 1),
      25.00
    ) as barter_percentage
  FROM products p
  LEFT JOIN product_categories pc ON p.category_id = pc.id
  WHERE p.id = product_id;
$$ LANGUAGE SQL STABLE;

-- Add comment
COMMENT ON VIEW products_with_eligibility IS 'Products with barter eligibility considering both product-level and category-level toggles';
