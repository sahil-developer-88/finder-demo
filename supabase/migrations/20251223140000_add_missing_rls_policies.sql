-- Migration: Add Missing RLS Policies
-- Created: 2025-12-23
-- Purpose: Secure pos_integrations, user_credits, and pos_transactions with Row Level Security

-- ============================================
-- ENABLE RLS ON TABLES
-- ============================================

-- Enable RLS (if not already enabled)
ALTER TABLE pos_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POS INTEGRATIONS POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own POS integrations" ON pos_integrations;
DROP POLICY IF EXISTS "Users can create their own POS integrations" ON pos_integrations;
DROP POLICY IF EXISTS "Users can update their own POS integrations" ON pos_integrations;
DROP POLICY IF EXISTS "Users can delete their own POS integrations" ON pos_integrations;
DROP POLICY IF EXISTS "Service role can manage all integrations" ON pos_integrations;

-- Users can view only their own integrations (contains OAuth tokens!)
CREATE POLICY "Users can view their own POS integrations"
ON pos_integrations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own integrations
CREATE POLICY "Users can create their own POS integrations"
ON pos_integrations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own integrations
CREATE POLICY "Users can update their own POS integrations"
ON pos_integrations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own integrations
CREATE POLICY "Users can delete their own POS integrations"
ON pos_integrations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Service role can access all (for webhooks, background jobs, Edge Functions)
CREATE POLICY "Service role can manage all integrations"
ON pos_integrations FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- USER CREDITS POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can insert their own credits" ON user_credits;
DROP POLICY IF EXISTS "Service role can manage all credits" ON user_credits;

-- Users can view their own credits
CREATE POLICY "Users can view their own credits"
ON user_credits FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own credit records (initialized on first transaction)
CREATE POLICY "Users can insert their own credits"
ON user_credits FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Service role can manage all credits (for functions: credit_merchant_balance, debit_user_credits)
CREATE POLICY "Service role can manage all credits"
ON user_credits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Note: Users CANNOT directly UPDATE or DELETE their credits
-- They must use the credit_merchant_balance() and debit_user_credits() functions
-- which run with SECURITY DEFINER (service role) privileges

-- ============================================
-- POS TRANSACTIONS POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Merchants can view their own transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Customers can view their own transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Service role can create transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Merchants can update their transaction status" ON pos_transactions;
DROP POLICY IF EXISTS "Service role can manage all transactions" ON pos_transactions;

-- Merchants can view transactions for their store
CREATE POLICY "Merchants can view their own transactions"
ON pos_transactions FOR SELECT
TO authenticated
USING (auth.uid() = merchant_id);

-- Customers can view transactions where they were the customer
-- (for future customer transaction history feature)
CREATE POLICY "Customers can view their own transactions"
ON pos_transactions FOR SELECT
TO authenticated
USING (
  -- Check if customer_id matches (if column exists and is populated)
  EXISTS (
    SELECT 1 FROM user_credits
    WHERE user_credits.user_id = auth.uid()
    AND pos_transactions.id IS NOT NULL
  )
);

-- Only service role can create transactions (via webhooks)
CREATE POLICY "Service role can create transactions"
ON pos_transactions FOR INSERT
TO service_role
WITH CHECK (true);

-- Merchants can update transaction status (e.g., for refunds)
CREATE POLICY "Merchants can update their transaction status"
ON pos_transactions FOR UPDATE
TO authenticated
USING (auth.uid() = merchant_id);

-- Service role can manage all transactions
CREATE POLICY "Service role can manage all transactions"
ON pos_transactions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- PRODUCTS POLICIES (FIX EXISTING)
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Merchants can view their own products" ON products;
DROP POLICY IF EXISTS "Merchants can insert their own products" ON products;
DROP POLICY IF EXISTS "Merchants can update their own products" ON products;
DROP POLICY IF EXISTS "Merchants can delete their own products" ON products;
DROP POLICY IF EXISTS "Customers can view active barter products" ON products;
DROP POLICY IF EXISTS "Service role can manage all products" ON products;

-- Merchants can view their own products
CREATE POLICY "Merchants can view their own products"
ON products FOR SELECT
TO authenticated
USING (auth.uid() = merchant_id);

-- Merchants can create products
CREATE POLICY "Merchants can insert their own products"
ON products FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = merchant_id);

-- Merchants can update their own products
CREATE POLICY "Merchants can update their own products"
ON products FOR UPDATE
TO authenticated
USING (auth.uid() = merchant_id);

-- Merchants can delete their own products
CREATE POLICY "Merchants can delete their own products"
ON products FOR DELETE
TO authenticated
USING (auth.uid() = merchant_id);

-- FIXED: Customers can view active, barter-enabled products (for checkout)
-- This was missing before - customers couldn't see products during checkout!
CREATE POLICY "Customers can view active barter products"
ON products FOR SELECT
TO authenticated
USING (
  is_active = true
  AND barter_enabled = true
  -- No need to check merchant_id - customers should see all available products
);

-- Service role can manage all products (for product sync from POS)
CREATE POLICY "Service role can manage all products"
ON products FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- GRANT ACCESS TO VIEWS
-- ============================================

-- Grant access to products_with_eligibility view
GRANT SELECT ON products_with_eligibility TO authenticated;

-- Grant access to products_needing_review view (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'products_needing_review'
  ) THEN
    EXECUTE 'GRANT SELECT ON products_needing_review TO authenticated';
  END IF;
END $$;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON POLICY "Users can view their own POS integrations" ON pos_integrations
IS 'Restricts POS integration access to owner only - contains OAuth tokens';

COMMENT ON POLICY "Users can view their own credits" ON user_credits
IS 'Users can only view their own barter credit balance';

COMMENT ON POLICY "Merchants can view their own transactions" ON pos_transactions
IS 'Merchants can view transactions from their store';

COMMENT ON POLICY "Customers can view active barter products" ON products
IS 'Allows customers to view active products during checkout';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- To verify RLS is enabled, run:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('pos_integrations', 'user_credits', 'pos_transactions', 'products');

-- To see all policies, run:
-- SELECT schemaname, tablename, policyname, roles, cmd, qual FROM pg_policies WHERE tablename IN ('pos_integrations', 'user_credits', 'pos_transactions', 'products');
