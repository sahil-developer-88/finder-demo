-- Quick test to verify products tables were created successfully
-- Run this in your Supabase SQL editor to confirm

-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_categories')
ORDER BY table_name;

-- Check product_categories data
SELECT name, is_restricted, slug
FROM product_categories
ORDER BY is_restricted DESC, name;

-- Check functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%product%';

-- Check view exists
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'products_with_eligibility';
