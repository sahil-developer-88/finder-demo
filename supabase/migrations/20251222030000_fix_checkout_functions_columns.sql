-- Migration: Fix checkout functions to use correct column names
-- Issue: Functions were using total_earned/total_spent but columns are earned_credits/spent_credits

-- Fix Function 1: Credit merchant's barter balance
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

-- Fix Function 2: Debit customer's barter credits
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

-- Add comment
COMMENT ON FUNCTION credit_merchant_balance IS 'Adds barter credits to merchant balance using earned_credits column';
COMMENT ON FUNCTION debit_user_credits IS 'Deducts barter credits from customer balance using spent_credits column';
