-- M1.1: Schema Cleanup - Remove Duplicate Tables
-- This migration removes duplicate tables created in earlier migrations
-- Keeps: businesses, tax_info (originals with FK constraints)
-- Removes: business_listings, w9_tax_info (duplicates without FK constraints)

-- ============================================================================
-- STEP 1: Add barter_percentage to businesses table
-- ============================================================================

-- Add barter_percentage column to businesses if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'barter_percentage'
  ) THEN
    ALTER TABLE public.businesses
    ADD COLUMN barter_percentage numeric DEFAULT 20 CHECK (barter_percentage >= 0 AND barter_percentage <= 100);

    COMMENT ON COLUMN public.businesses.barter_percentage IS 'Percentage of transaction the merchant is willing to accept in barter (0-100)';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Migrate data from business_listings to businesses (if any unique records)
-- ============================================================================

-- Insert any records from business_listings that don't exist in businesses
INSERT INTO public.businesses (
  user_id, business_name, category, description, services_offered,
  wanting_in_return, estimated_value, location, contact_method,
  status, images, barter_percentage, created_at, updated_at
)
SELECT
  bl.user_id, bl.business_name, bl.category, bl.description,
  bl.services_offered, bl.wanting_in_return, bl.estimated_value,
  bl.location, bl.contact_method, bl.status, bl.images,
  COALESCE(bl.barter_percentage, 20), bl.created_at, bl.updated_at
FROM public.business_listings bl
WHERE NOT EXISTS (
  SELECT 1 FROM public.businesses b
  WHERE b.id = bl.id
)
ON CONFLICT (id) DO UPDATE SET
  barter_percentage = EXCLUDED.barter_percentage,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 3: Migrate data from w9_tax_info to tax_info (if any unique records)
-- ============================================================================

-- Insert any records from w9_tax_info that don't exist in tax_info
INSERT INTO public.tax_info (
  user_id, legal_name, business_name, business_type, other_business_type,
  tax_id, tax_id_type, address, city, state, zip_code, account_number,
  exempt_from_backup_withholding, certification_agreed, created_at, updated_at
)
SELECT
  w9.user_id, w9.legal_name, w9.business_name, w9.business_type,
  w9.other_business_type, w9.tax_id, w9.tax_id_type, w9.address,
  w9.city, w9.state, w9.zip_code, w9.account_number,
  w9.exempt_from_backup_withholding, w9.certification_agreed,
  w9.created_at, w9.updated_at
FROM public.w9_tax_info w9
WHERE NOT EXISTS (
  SELECT 1 FROM public.tax_info t
  WHERE t.user_id = w9.user_id
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- STEP 4: Drop RLS policies for duplicate tables
-- ============================================================================

-- Drop business_listings policies
DROP POLICY IF EXISTS "Users can view all business listings" ON public.business_listings;
DROP POLICY IF EXISTS "Users can create their own business listings" ON public.business_listings;
DROP POLICY IF EXISTS "Users can update their own business listings" ON public.business_listings;
DROP POLICY IF EXISTS "Users can delete their own business listings" ON public.business_listings;

-- Drop w9_tax_info policies
DROP POLICY IF EXISTS "Users can view their own w9 info" ON public.w9_tax_info;
DROP POLICY IF EXISTS "Users can create their own w9 info" ON public.w9_tax_info;
DROP POLICY IF EXISTS "Users can update their own w9 info" ON public.w9_tax_info;

-- ============================================================================
-- STEP 5: Drop triggers for duplicate tables
-- ============================================================================

DROP TRIGGER IF EXISTS update_business_listings_updated_at ON public.business_listings;
DROP TRIGGER IF EXISTS update_w9_tax_info_updated_at ON public.w9_tax_info;

-- ============================================================================
-- STEP 6: Drop duplicate tables
-- ============================================================================

DROP TABLE IF EXISTS public.business_listings CASCADE;
DROP TABLE IF EXISTS public.w9_tax_info CASCADE;

-- ============================================================================
-- STEP 7: Verify original tables have proper structure
-- ============================================================================

-- Ensure businesses has all necessary columns
DO $$
BEGIN
  -- Set default for existing records
  UPDATE public.businesses
  SET barter_percentage = 20
  WHERE barter_percentage IS NULL;
END $$;

COMMENT ON TABLE public.businesses IS 'Business listings for the platform. Each business can offer services and specify what they want in return.';
COMMENT ON TABLE public.tax_info IS 'W9 tax information for users. Used for IRS reporting and compliance.';
