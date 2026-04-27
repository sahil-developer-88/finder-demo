-- Fix complete_pos_payment_session function to use correct column name
-- Bug: Function was trying to insert into "notes" column but transactions table has "service_description"

CREATE OR REPLACE FUNCTION complete_pos_payment_session(
  p_session_id UUID,
  p_total_amount DECIMAL,
  p_barter_amount DECIMAL,
  p_pos_order_id TEXT
) RETURNS TABLE (
  transaction_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_session RECORD;
  v_transaction_id UUID;
BEGIN
  -- Get session details
  SELECT * INTO v_session
  FROM pos_payment_sessions
  WHERE id = p_session_id
    AND session_status IN ('discount_applied', 'payment_pending');

  IF v_session IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Invalid or expired session'::TEXT;
    RETURN;
  END IF;

  -- Check customer balance
  IF NOT EXISTS (
    SELECT 1 FROM user_credits
    WHERE user_id = v_session.customer_id
      AND available_credits >= p_barter_amount
  ) THEN
    UPDATE pos_payment_sessions
    SET session_status = 'failed',
        error_message = 'Insufficient credits'
    WHERE id = p_session_id;

    RETURN QUERY SELECT NULL::UUID, FALSE, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;

  -- Debit customer
  UPDATE user_credits
  SET available_credits = available_credits - p_barter_amount,
      spent_credits = spent_credits + p_barter_amount
  WHERE user_id = v_session.customer_id;

  -- Credit merchant
  INSERT INTO user_credits (user_id, available_credits, earned_credits, spent_credits)
  VALUES (v_session.merchant_id, p_barter_amount, p_barter_amount, 0)
  ON CONFLICT (user_id)
  DO UPDATE SET
    available_credits = user_credits.available_credits + p_barter_amount,
    earned_credits = user_credits.earned_credits + p_barter_amount;

  -- Create transaction (FIXED: use service_description instead of notes)
  INSERT INTO transactions (
    from_user_id, to_user_id, points_amount,
    transaction_type, status, service_description
  ) VALUES (
    v_session.customer_id,
    v_session.merchant_id,
    p_barter_amount,
    'purchase',
    'completed',
    format('POS Split Payment: Total $%s, Barter $%s, Cash $%s, Order: %s',
           p_total_amount, p_barter_amount, p_total_amount - p_barter_amount, p_pos_order_id)
  ) RETURNING id INTO v_transaction_id;

  -- Update session
  UPDATE pos_payment_sessions
  SET session_status = 'completed',
      completed_at = NOW(),
      total_amount = p_total_amount,
      barter_amount = p_barter_amount,
      cash_amount = p_total_amount - p_barter_amount,
      pos_order_id = p_pos_order_id
  WHERE id = p_session_id;

  -- Update barcode scan
  UPDATE pos_barcode_scans
  SET is_used = TRUE,
      status = 'completed',
      transaction_id = v_transaction_id
  WHERE id = v_session.barcode_scan_id;

  RETURN QUERY SELECT v_transaction_id, TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  -- Rollback on error
  UPDATE pos_payment_sessions
  SET session_status = 'failed',
      error_message = SQLERRM
  WHERE id = p_session_id;

  RETURN QUERY SELECT NULL::UUID, FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
