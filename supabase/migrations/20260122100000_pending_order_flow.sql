-- =====================================================
-- Pending Order Flow for POS-Hosted Checkout
-- =====================================================
-- This migration updates the order flow so that:
-- 1. Orders are created in 'pending_payment' status
-- 2. Barter credits are NOT deducted until payment confirmed
-- 3. Webhook finalizes the order and transfers credits
-- =====================================================

-- Add pending_payment status if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending_payment'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
  ) THEN
    ALTER TYPE order_status ADD VALUE 'pending_payment' BEFORE 'confirmed';
  END IF;
END $$;

-- =====================================================
-- Create Pending Order (NO credit deduction)
-- =====================================================
CREATE OR REPLACE FUNCTION create_pending_order(
  p_customer_id UUID,
  p_merchant_id UUID,
  p_order_data JSONB,
  p_items JSONB[]
)
RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_order_number TEXT;
BEGIN
  -- Generate order number
  v_order_number := generate_order_number();

  -- Create order in PENDING status (NO credit deduction yet)
  INSERT INTO orders (
    order_number,
    customer_id,
    merchant_id,
    status,
    subtotal,
    eligible_subtotal,
    restricted_subtotal,
    barter_amount,
    barter_percentage,
    cash_amount,
    tax_amount,
    total_amount,
    payment_method,
    payment_status,
    customer_name,
    customer_email,
    customer_phone,
    pickup_location,
    estimated_pickup_time,
    customer_notes
  ) VALUES (
    v_order_number,
    p_customer_id,
    p_merchant_id,
    'pending_payment',  -- NOT confirmed yet
    (p_order_data->>'subtotal')::DECIMAL,
    (p_order_data->>'eligible_subtotal')::DECIMAL,
    (p_order_data->>'restricted_subtotal')::DECIMAL,
    COALESCE((p_order_data->>'barter_amount')::DECIMAL, 0),
    (p_order_data->>'barter_percentage')::DECIMAL,
    (p_order_data->>'cash_amount')::DECIMAL,
    (p_order_data->>'tax_amount')::DECIMAL,
    (p_order_data->>'total_amount')::DECIMAL,
    'pos_checkout',  -- Payment via POS
    'pending',       -- Payment not completed
    p_order_data->>'customer_name',
    p_order_data->>'customer_email',
    p_order_data->>'customer_phone',
    p_order_data->>'pickup_location',
    (p_order_data->>'estimated_pickup_time')::TIMESTAMPTZ,
    p_order_data->>'customer_notes'
  ) RETURNING id INTO v_order_id;

  -- Create order items
  FOREACH v_item IN ARRAY p_items
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      product_sku,
      product_barcode,
      unit_price,
      quantity,
      subtotal,
      is_barter_eligible,
      restriction_reason,
      category_name,
      external_product_id,
      external_variant_id
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      v_item->>'product_sku',
      v_item->>'product_barcode',
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'subtotal')::DECIMAL,
      (v_item->>'is_barter_eligible')::BOOLEAN,
      v_item->>'restriction_reason',
      v_item->>'category_name',
      v_item->>'external_product_id',
      v_item->>'external_variant_id'
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Finalize Order After Payment (deduct credits)
-- =====================================================
CREATE OR REPLACE FUNCTION finalize_order_payment(
  p_order_id UUID,
  p_pos_order_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) AS $$
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
      earned_credits = user_credits.earned_credits + v_order.barter_amount;

    -- Create transaction record
    INSERT INTO transactions (
      from_user_id, to_user_id, points_amount,
      transaction_type, status, notes
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
    status = 'completed',
    payment_status = 'completed',
    pos_order_id = COALESCE(p_pos_order_id, pos_order_id),
    confirmed_at = NOW(),
    completed_at = NOW()
  WHERE id = p_order_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Cancel Pending Order (no credits to refund)
-- =====================================================
CREATE OR REPLACE FUNCTION cancel_pending_order(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'Payment cancelled'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- Get order
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF v_order IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Only cancel if still pending
  IF v_order.status NOT IN ('pending_payment', 'pending_pos_payment') THEN
    RETURN FALSE;
  END IF;

  -- Update order
  UPDATE orders
  SET
    status = 'cancelled',
    payment_status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_at = NOW()
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Update webhook function to use finalize_order_payment
-- =====================================================
CREATE OR REPLACE FUNCTION update_order_from_pos_webhook(
  p_draft_order_id TEXT,
  p_pos_order_id TEXT,
  p_new_status TEXT DEFAULT 'completed'
)
RETURNS TABLE (
  order_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_order_id UUID;
  v_result RECORD;
BEGIN
  -- Find order by draft order ID
  SELECT id INTO v_order_id
  FROM orders
  WHERE pos_draft_order_id = p_draft_order_id;

  IF v_order_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Order not found for draft order ID'::TEXT;
    RETURN;
  END IF;

  -- If completing, use finalize function to deduct credits
  IF p_new_status = 'completed' THEN
    SELECT * INTO v_result
    FROM finalize_order_payment(v_order_id, p_pos_order_id);

    RETURN QUERY SELECT v_order_id, v_result.success, v_result.error_message;
  ELSE
    -- Just update status
    UPDATE orders
    SET
      status = p_new_status::order_status,
      pos_order_id = p_pos_order_id,
      updated_at = NOW()
    WHERE id = v_order_id;

    RETURN QUERY SELECT v_order_id, TRUE, NULL::TEXT;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::UUID, FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
