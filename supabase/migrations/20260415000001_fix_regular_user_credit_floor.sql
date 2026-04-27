-- ─── Fix: Regular users floor at 0, merchants floor at –credit_line ────────────
-- Previously, users with no merchant_credit_profiles row defaulted to a –500
-- credit line. Regular consumers should never go negative: floor = 0.

CREATE OR REPLACE FUNCTION debit_user_credits(
  p_user_id UUID,
  p_amount  DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_current_balance DECIMAL;
  v_credit_line     DECIMAL;
  v_is_merchant     BOOLEAN;
BEGIN
  -- Get current balance with row lock
  SELECT available_credits INTO v_current_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits not found for user_id: %', p_user_id;
  END IF;

  -- Check if the user has a merchant credit profile
  SELECT TRUE, COALESCE(credit_line, 500)
    INTO v_is_merchant, v_credit_line
  FROM public.merchant_credit_profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Regular user: no credit line, floor at 0
    v_credit_line := 0;
  END IF;

  -- Balance after debit must not go below –credit_line (0 for regular users)
  IF (v_current_balance - p_amount) < -v_credit_line THEN
    RAISE EXCEPTION
      'Insufficient credits. Current balance: %, Amount: %, Minimum allowed: -%',
      v_current_balance, p_amount, v_credit_line;
  END IF;

  -- Debit the amount
  UPDATE public.user_credits
  SET
    available_credits = available_credits - p_amount,
    spent_credits     = COALESCE(spent_credits, 0) + p_amount,
    updated_at        = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
