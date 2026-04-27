-- Fix foreign key constraint for products.merchant_id
-- The constraint should reference profiles(user_id) not profiles(id)

-- Drop the existing incorrect foreign key
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_merchant_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE products
ADD CONSTRAINT products_merchant_id_fkey
FOREIGN KEY (merchant_id)
REFERENCES profiles(user_id)
ON DELETE CASCADE;

-- Add comment
COMMENT ON CONSTRAINT products_merchant_id_fkey ON products IS
'Foreign key to profiles.user_id (matches auth.uid())';
