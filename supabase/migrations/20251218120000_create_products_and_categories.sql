-- Create product_categories table for restricted category definitions
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  is_restricted BOOLEAN DEFAULT false,
  restriction_reason TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default restricted categories
INSERT INTO product_categories (name, slug, is_restricted, restriction_reason, description) VALUES
  ('Alcohol', 'alcohol', true, 'Legal compliance - alcohol sales regulated', 'Alcoholic beverages including beer, wine, spirits'),
  ('Tobacco', 'tobacco', true, 'Legal compliance - tobacco sales regulated', 'Tobacco products, cigarettes, vaping products'),
  ('Lottery', 'lottery', true, 'Legal compliance - lottery/gambling regulated', 'Lottery tickets, scratch cards, gambling products'),
  ('Gift Cards', 'gift-cards', true, 'Prevents money laundering', 'Gift cards, prepaid cards, store credit'),
  ('Pharmacy/Prescriptions', 'pharmacy', true, 'Legal compliance - prescription drugs regulated', 'Prescription medications and controlled substances'),
  ('Firearms/Weapons', 'firearms', true, 'Legal compliance - weapons sales regulated', 'Firearms, ammunition, weapons'),
  ('Food', 'food', false, NULL, 'Food and grocery items'),
  ('Beverages', 'beverages', false, NULL, 'Non-alcoholic beverages'),
  ('Retail', 'retail', false, NULL, 'General retail merchandise'),
  ('Services', 'services', false, NULL, 'Professional services'),
  ('Electronics', 'electronics', false, NULL, 'Electronics and gadgets'),
  ('Clothing', 'clothing', false, NULL, 'Clothing and apparel'),
  ('Home & Garden', 'home-garden', false, NULL, 'Home and garden products'),
  ('Health & Beauty', 'health-beauty', false, NULL, 'Health and beauty products (non-prescription)'),
  ('Other', 'other', false, NULL, 'Uncategorized products')
ON CONFLICT (slug) DO NOTHING;

-- Create products table with support for multiple POS integrations per merchant
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Merchant and POS relationship
  merchant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pos_integration_id UUID NOT NULL REFERENCES pos_integrations(id) ON DELETE CASCADE,

  -- External POS product identifier
  external_product_id TEXT NOT NULL,
  external_variant_id TEXT, -- For products with variants (size, color, etc)

  -- Product details
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,

  -- Pricing and inventory
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cost DECIMAL(10, 2), -- Cost price for margin calculation
  currency TEXT DEFAULT 'USD',
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,

  -- Product identifiers
  sku TEXT,
  barcode TEXT,
  upc TEXT,

  -- Barter configuration
  barter_enabled BOOLEAN DEFAULT true,
  custom_barter_percentage DECIMAL(5, 2), -- Override merchant default if set

  -- Product metadata
  image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional POS-specific data

  -- Sync tracking
  is_active BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'synced', -- synced, pending, error
  sync_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure unique products per POS integration
  CONSTRAINT unique_product_per_pos UNIQUE (pos_integration_id, external_product_id, external_variant_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_pos_integration_id ON products(pos_integration_id);
CREATE INDEX IF NOT EXISTS idx_products_external_product_id ON products(external_product_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_upc ON products(upc) WHERE upc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_barter_enabled ON products(barter_enabled);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_last_synced_at ON products(last_synced_at);

-- Enable Row Level Security
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_categories (public read access)
CREATE POLICY "Product categories are viewable by everyone"
  ON product_categories FOR SELECT
  USING (true);

-- Admin policy for product categories (only if user_roles table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_roles') THEN
    EXECUTE 'CREATE POLICY "Only admins can modify product categories"
      ON product_categories FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid()
          AND role = ''admin''
        )
      )';
  END IF;
END $$;

-- RLS Policies for products
CREATE POLICY "Merchants can view their own products"
  ON products FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can insert their own products"
  ON products FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can update their own products"
  ON products FOR UPDATE
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can delete their own products"
  ON products FOR DELETE
  USING (merchant_id = auth.uid());

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on products table
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on product_categories table
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check if a product is restricted based on category
CREATE OR REPLACE FUNCTION is_product_restricted(product_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (
      SELECT pc.is_restricted
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.id = product_id
    ),
    false
  );
$$ LANGUAGE SQL STABLE;

-- Function to get barter eligibility for a product
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
      WHEN NOT p.is_active THEN false
      ELSE true
    END as is_eligible,
    CASE
      WHEN NOT p.barter_enabled THEN 'Barter disabled for this product'
      WHEN pc.is_restricted THEN pc.restriction_reason
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

-- View to show products with their barter eligibility status
CREATE OR REPLACE VIEW products_with_eligibility AS
SELECT
  p.*,
  pc.name as category_name,
  pc.is_restricted as category_is_restricted,
  pc.restriction_reason,
  CASE
    WHEN NOT p.barter_enabled THEN false
    WHEN pc.is_restricted THEN false
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

-- Comments for documentation
COMMENT ON TABLE products IS 'Product catalog synced from multiple POS systems per merchant';
COMMENT ON TABLE product_categories IS 'Product categories with restricted category definitions for barter compliance';
COMMENT ON COLUMN products.merchant_id IS 'The merchant who owns this product';
COMMENT ON COLUMN products.pos_integration_id IS 'Which POS integration this product came from (supports multiple POS per merchant)';
COMMENT ON COLUMN products.external_product_id IS 'The product ID in the external POS system';
COMMENT ON COLUMN products.custom_barter_percentage IS 'Override default merchant barter percentage for this specific product';
COMMENT ON FUNCTION is_product_restricted IS 'Check if a product belongs to a restricted category';
COMMENT ON FUNCTION get_product_barter_eligibility IS 'Get comprehensive barter eligibility info for a product';
