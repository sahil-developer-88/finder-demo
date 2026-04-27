-- Add business_id column to products table to link products to specific business/store
ALTER TABLE products
ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);

-- Update existing products to link to the user's first business (if they have one)
-- This ensures existing products don't break
UPDATE products p
SET business_id = (
  SELECT id FROM businesses b
  WHERE b.user_id = p.merchant_id
  ORDER BY b.created_at ASC
  LIMIT 1
)
WHERE business_id IS NULL;

-- Add comment
COMMENT ON COLUMN products.business_id IS 'The specific business/store this product belongs to';

-- Update RLS policies to allow viewing products by business_id
-- This allows customers to view products for a specific store
CREATE POLICY "Public can view products for active businesses"
  ON products FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE status = 'active'
    )
    AND is_active = true
    AND is_archived = false
  );

-- Update the products_with_eligibility view to include business information
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

-- Grant access to the view
GRANT SELECT ON products_with_eligibility TO authenticated;
GRANT SELECT ON products_with_eligibility TO anon;
