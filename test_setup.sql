-- Quick setup script for testing Shopify split payment
-- Run this to prepare test data

-- 1. Check your user ID (merchant)
SELECT id, email, full_name FROM profiles WHERE email = 'YOUR_MERCHANT_EMAIL';

-- 2. Create a test customer with credits (replace USER_ID with actual UUID)
-- First, insert a test customer if needed, or use existing customer
-- Example:
INSERT INTO user_credits (user_id, available_credits, earned_credits, spent_credits)
VALUES (
  'CUSTOMER_USER_ID_HERE', -- Replace with actual customer user ID
  100.00,  -- Give them $100 in barter credits
  100.00,
  0
)
ON CONFLICT (user_id) DO UPDATE
SET available_credits = 100.00,
    earned_credits = 100.00;

-- 3. Set merchant barter percentage to 30%
UPDATE businesses
SET barter_percentage = 30
WHERE user_id = 'YOUR_MERCHANT_USER_ID';

-- 4. Verify setup
SELECT
  p.email,
  uc.available_credits,
  b.barter_percentage
FROM profiles p
LEFT JOIN user_credits uc ON uc.user_id = p.id
LEFT JOIN businesses b ON b.user_id = p.id
WHERE p.id IN ('YOUR_MERCHANT_ID', 'CUSTOMER_ID');
