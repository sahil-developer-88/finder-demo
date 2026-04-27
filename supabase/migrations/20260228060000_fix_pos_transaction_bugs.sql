-- Migration: Fix POS transaction bugs
-- Created: 2026-02-28
-- Fixes:
--   1. Add 'lightspeed' to pos_provider CHECK constraint (was missing, causing all
--      Lightspeed inserts to fail with a constraint violation).
--   2. Fix finalize_order_payment() — used `notes` column which doesn't exist on
--      the transactions table (correct column is `service_description`).

-- ============================================================
-- 1. Expand pos_provider CHECK constraint to include lightspeed
-- ============================================================

ALTER TABLE pos_transactions
  DROP CONSTRAINT IF EXISTS pos_transactions_pos_provider_check;

ALTER TABLE pos_transactions
  ADD CONSTRAINT pos_transactions_pos_provider_check
  CHECK (pos_provider IN ('square', 'shopify', 'toast', 'clover', 'adyen', 'lightspeed', 'generic'));

-- ============================================================
-- 2. Fix finalize_order_payment: notes → service_description
-- ============================================================

CREATE OR REPLACE FUNCTION finalize_order_payment(
  p_order_id UUID,
  p_pos_order_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- Get order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF v_order IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Order not found'::TEXT;
    RETURN;
  END IF;

  -- Check if already completed
  IF v_order.status = 'completed' THEN
    RETURN QUERY SELECT TRUE, 'Order already completed'::TEXT;
    RETURN;
  END IF;

  -- Deduct barter credits from customer
  IF v_order.barter_amount > 0 THEN

    -- Check customer has enough credits
    IF NOT EXISTS (
      SELECT 1 FROM user_credits
      WHERE user_id = v_order.customer_id
        AND available_credits >= v_order.barter_amount
    ) THEN
      RETURN QUERY SELECT FALSE, 'Insufficient barter credits'::TEXT;
      RETURN;
    END IF;

    -- Debit customer
    UPDATE user_credits
    SET available_credits = available_credits - v_order.barter_amount,
        spent_credits = spent_credits + v_order.barter_amount
    WHERE user_id = v_order.customer_id;

    -- Credit merchant
    INSERT INTO user_credits (user_id, available_credits, earned_credits, spent_credits)
    VALUES (v_order.merchant_id, v_order.barter_amount, v_order.barter_amount, 0)
    ON CONFLICT (user_id)
    DO UPDATE SET
      available_credits = user_credits.available_credits + v_order.barter_amount,
      earned_credits    = user_credits.earned_credits + v_order.barter_amount;

    -- Create transaction record (FIXED: service_description, not notes)
    INSERT INTO transactions (
      from_user_id, to_user_id, points_amount,
      transaction_type, status, service_description
    ) VALUES (
      v_order.customer_id,
      v_order.merchant_id,
      v_order.barter_amount,
      'purchase',
      'completed',
      format('Order #%s - Barter payment', v_order.order_number)
    );
  END IF;

  -- Update order status
  UPDATE orders
  SET
    status         = 'completed',
    payment_status = 'completed',
    pos_order_id   = COALESCE(p_pos_order_id, pos_order_id),
    confirmed_at   = NOW(),
    completed_at   = NOW()
  WHERE id = p_order_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;
