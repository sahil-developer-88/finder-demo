-- Customer-initiated payment (GPay-style: customer scans merchant QR, pays from own wallet)
-- auth.uid() = the paying customer — no impersonation needed.
-- SECURITY DEFINER only so we can credit the merchant's user_credits row.

CREATE OR REPLACE FUNCTION customer_pay_merchant(
  p_merchant_id UUID,
  p_amount      DECIMAL
)
RETURNS TABLE (
  success        BOOLEAN,
  merchant_name  TEXT,
  amount         DECIMAL,
  transaction_id UUID,
  error_message  TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id UUID := auth.uid();
  v_merchant_name TEXT;
  v_balance DECIMAL;
  v_txn_id UUID;
BEGIN
  IF v_customer_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::DECIMAL, NULL::UUID, 'Not authenticated';
    RETURN;
  END IF;

  IF v_customer_id = p_merchant_id THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::DECIMAL, NULL::UUID, 'Cannot pay yourself';
    RETURN;
  END IF;

  IF p_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::DECIMAL, NULL::UUID, 'Amount must be greater than zero';
    RETURN;
  END IF;

  -- Verify merchant exists
  SELECT full_name INTO v_merchant_name FROM profiles WHERE id = p_merchant_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::DECIMAL, NULL::UUID, 'Merchant not found';
    RETURN;
  END IF;
  v_merchant_name := COALESCE(v_merchant_name, 'Merchant');

  -- Lock and check customer balance
  SELECT COALESCE(available_credits, 0) INTO v_balance
  FROM user_credits WHERE user_id = v_customer_id FOR UPDATE;
  v_balance := COALESCE(v_balance, 0);

  IF v_balance < p_amount THEN
    RETURN QUERY SELECT FALSE, v_merchant_name, NULL::DECIMAL, NULL::UUID,
      format('Insufficient credits. Available: %.2f, Requested: %.2f', v_balance, p_amount);
    RETURN;
  END IF;

  -- Debit customer (existing SECURITY DEFINER function handles floor check)
  PERFORM debit_user_credits(v_customer_id, p_amount);

  -- Credit merchant
  INSERT INTO user_credits (user_id, available_credits, earned_credits)
  VALUES (p_merchant_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET available_credits = user_credits.available_credits + p_amount,
        earned_credits    = COALESCE(user_credits.earned_credits, 0) + p_amount,
        updated_at        = NOW();

  -- Record transaction — fn_ledger_on_transaction trigger writes ledger for both parties
  INSERT INTO transactions (
    from_user_id, to_user_id, points_amount,
    service_description, status, transaction_type
  ) VALUES (
    v_customer_id, p_merchant_id, p_amount,
    'Barter payment', 'completed', 'barter_payment'
  ) RETURNING id INTO v_txn_id;

  RETURN QUERY SELECT TRUE, v_merchant_name, p_amount, v_txn_id, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION customer_pay_merchant(UUID, DECIMAL) TO authenticated;
