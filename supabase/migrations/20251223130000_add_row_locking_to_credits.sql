-- Migration: Add Row Locking to Credit Functions
-- Created: 2025-12-23
-- Purpose: Prevent race conditions in concurrent credit debit operations

-- Drop existing functions
DROP FUNCTION IF EXISTS debit_user_credits(UUID, DECIMAL);
DROP FUNCTION IF EXISTS credit_merchant_balance(UUID, DECIMAL);

-- Recreate debit_user_credits with row locking (FOR UPDATE)
CREATE OR REPLACE FUNCTION debit_user_credits(
  p_user_id UUID,
  p_amount DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_current_balance DECIMAL;
BEGIN
  -- 🔒 CRITICAL: Lock the row and get current balance atomically
  -- FOR UPDATE prevents other transactions from reading or modifying this row
  -- until our transaction commits or rolls back
  SELECT available_credits INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;  -- 🔒 Row-level lock acquired here

  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits not found for user_id: %', p_user_id;
  END IF;

  -- Check for sufficient balance (now safe from race conditions)
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %',
      p_amount, v_current_balance;
  END IF;

  -- Debit the amount (row is locked, safe to update)
  UPDATE user_credits
  SET
    available_credits = available_credits - p_amount,
    spent_credits = COALESCE(spent_credits, 0) + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Lock is automatically released when transaction commits
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate credit_merchant_balance with improved atomicity
-- Note: INSERT ... ON CONFLICT already provides implicit locking
CREATE OR REPLACE FUNCTION credit_merchant_balance(
  p_merchant_id UUID,
  p_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  -- INSERT ... ON CONFLICT provides atomic upsert with implicit locking
  -- No explicit FOR UPDATE needed as ON CONFLICT handles concurrency
  INSERT INTO user_credits (user_id, available_credits, earned_credits, updated_at)
  VALUES (p_merchant_id, p_amount, p_amount, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    available_credits = user_credits.available_credits + p_amount,
    earned_credits = user_credits.earned_credits + p_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore grants
GRANT EXECUTE ON FUNCTION debit_user_credits(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION credit_merchant_balance(UUID, DECIMAL) TO authenticated;

-- Add comments
COMMENT ON FUNCTION debit_user_credits IS 'Deducts barter credits from customer balance with row-level locking to prevent race conditions';
COMMENT ON FUNCTION credit_merchant_balance IS 'Adds barter credits to merchant balance with atomic upsert';

-- Add index to improve locking performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id_locking
ON user_credits(user_id)
WHERE available_credits IS NOT NULL;
