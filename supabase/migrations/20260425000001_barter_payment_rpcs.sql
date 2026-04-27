-- ─── GPay-style barter payment RPCs ──────────────────────────────────────────
--
-- Two-phase flow:
--   1. Merchant scans QR  → peek_barter_qr     (validate only, no consume)
--                         → returns customer name + real balance for confirm screen
--   2. Merchant confirms  → process_barter_payment (atomic: consume + transfer)
--
-- Both are SECURITY DEFINER so they bypass RLS on user_credits / profiles.

-- ─── Phase 1: peek without consuming ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION peek_barter_qr(p_token TEXT)
RETURNS TABLE (
  customer_id       UUID,
  customer_name     TEXT,
  available_credits DECIMAL,
  valid             BOOLEAN,
  error_message     TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id UUID;
  v_name        TEXT;
  v_credits     DECIMAL;
BEGIN
  SELECT customer_id INTO v_customer_id
  FROM pos_barcode_scans
  WHERE barcode_value = p_token
    AND NOT is_used
    AND expires_at > NOW()
    AND status = 'active';

  IF v_customer_id IS NULL THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::TEXT, NULL::DECIMAL, FALSE,
      'QR code invalid or expired. Ask the customer to generate a new one.';
    RETURN;
  END IF;

  SELECT full_name INTO v_name FROM profiles WHERE id = v_customer_id;
  v_name := COALESCE(v_name, 'Customer');

  SELECT COALESCE(uc.available_credits, 0) INTO v_credits
  FROM user_credits uc WHERE uc.user_id = v_customer_id;
  v_credits := COALESCE(v_credits, 0);

  RETURN QUERY SELECT v_customer_id, v_name, v_credits, TRUE, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION peek_barter_qr(TEXT) TO authenticated;

-- ─── Phase 2: atomically consume token + transfer credits ────────────────────
CREATE OR REPLACE FUNCTION process_barter_payment(
  p_token         TEXT,
  p_merchant_id   UUID,
  p_barter_amount DECIMAL
)
RETURNS TABLE (
  success        BOOLEAN,
  customer_id    UUID,
  customer_name  TEXT,
  barter_amount  DECIMAL,
  transaction_id UUID,
  error_message  TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id UUID;
  v_name        TEXT;
  v_balance     DECIMAL;
  v_txn_id      UUID;
BEGIN
  -- Lock token row (NOWAIT blocks double-spend race conditions)
  SELECT customer_id INTO v_customer_id
  FROM pos_barcode_scans
  WHERE barcode_value = p_token
    AND NOT is_used
    AND expires_at > NOW()
    AND status = 'active'
  FOR UPDATE NOWAIT;

  IF v_customer_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::UUID,
      'QR code invalid, expired, or already used. Ask the customer to generate a new one.';
    RETURN;
  END IF;

  IF v_customer_id = p_merchant_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::UUID,
      'Cannot process a payment to yourself.';
    RETURN;
  END IF;

  -- Verify balance is still sufficient (customer may have spent since peek)
  SELECT COALESCE(uc.available_credits, 0) INTO v_balance
  FROM user_credits uc WHERE uc.user_id = v_customer_id FOR UPDATE;
  v_balance := COALESCE(v_balance, 0);

  IF v_balance < p_barter_amount THEN
    RETURN QUERY SELECT FALSE, v_customer_id, NULL::TEXT, NULL::DECIMAL, NULL::UUID,
      format('Insufficient credits. Available: %.2f, Requested: %.2f', v_balance, p_barter_amount);
    RETURN;
  END IF;

  SELECT full_name INTO v_name FROM profiles WHERE id = v_customer_id;
  v_name := COALESCE(v_name, 'Customer');

  -- Consume the token
  UPDATE pos_barcode_scans
  SET is_used    = TRUE,
      scanned_at = NOW(),
      merchant_id = p_merchant_id,
      status     = 'scanned',
      updated_at = NOW()
  WHERE barcode_value = p_token;

  -- Debit customer (existing SECURITY DEFINER function handles floor check)
  PERFORM debit_user_credits(v_customer_id, p_barter_amount);

  -- Credit merchant (upsert so new merchants work too)
  INSERT INTO user_credits (user_id, available_credits, earned_credits)
  VALUES (p_merchant_id, p_barter_amount, p_barter_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET available_credits = user_credits.available_credits + p_barter_amount,
        earned_credits    = COALESCE(user_credits.earned_credits, 0) + p_barter_amount,
        updated_at        = NOW();

  -- Record transaction — fn_ledger_on_transaction trigger writes ledger for both parties
  INSERT INTO transactions (
    from_user_id, to_user_id, points_amount,
    service_description, status, transaction_type
  ) VALUES (
    v_customer_id, p_merchant_id, p_barter_amount,
    'Barter payment at checkout', 'completed', 'barter_payment'
  ) RETURNING id INTO v_txn_id;

  RETURN QUERY SELECT TRUE, v_customer_id, v_name, p_barter_amount, v_txn_id, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION process_barter_payment(TEXT, UUID, DECIMAL) TO authenticated;
