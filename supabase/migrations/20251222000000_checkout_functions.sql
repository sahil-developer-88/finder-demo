-- Migration: Checkout Functions for Unified Checkout System
-- Created: 2025-12-22
-- Purpose: Add functions for credit/debit operations in checkout flow

-- Function 1: Credit merchant's barter balance
-- Used when merchant earns credits (Mode 1 & Mode 2)
CREATE OR REPLACE FUNCTION credit_merchant_balance(
  p_merchant_id UUID,
  p_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  -- Insert or update merchant's barter credits
  INSERT INTO user_credits (user_id, available_credits, earned_credits, updated_at)
  VALUES (p_merchant_id, p_amount, p_amount, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    available_credits = user_credits.available_credits + p_amount,
    earned_credits = user_credits.earned_credits + p_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Debit customer's barter credits
-- Used when barter member spends credits (Mode 2 only)
CREATE OR REPLACE FUNCTION debit_user_credits(
  p_user_id UUID,
  p_amount DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_current_balance DECIMAL;
BEGIN
  -- Get current balance
  SELECT available_credits INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id;

  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits not found for user_id: %', p_user_id;
  END IF;

  -- Check for sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', p_amount, v_current_balance;
  END IF;

  -- Debit the amount
  UPDATE user_credits
  SET
    available_credits = available_credits - p_amount,
    spent_credits = COALESCE(spent_credits, 0) + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Get public profile info (for customer lookup)
-- Returns basic customer info when scanning QR code
-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS get_public_profile_info(UUID);

CREATE FUNCTION get_public_profile_info(
  profile_user_id UUID
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email
  FROM profiles p
  WHERE p.id = profile_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION credit_merchant_balance(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION debit_user_credits(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_profile_info(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION credit_merchant_balance IS 'Adds barter credits to merchant balance (Mode 1 & 2)';
COMMENT ON FUNCTION debit_user_credits IS 'Deducts barter credits from customer balance (Mode 2)';
COMMENT ON FUNCTION get_public_profile_info IS 'Looks up customer profile info for checkout';
