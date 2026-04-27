-- =====================================================
-- POS Order Tracking for Uber Eats-style Ordering Flow
-- =====================================================
-- This migration adds tracking for orders placed through the app
-- that need to be fulfilled via Shopify POS
-- =====================================================

-- Add new order status for orders waiting for POS payment
-- Note: We need to check if the value already exists before adding
DO $$
BEGIN
  -- Check if the value exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending_pos_payment'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
  ) THEN
    -- Add the new value after 'confirmed'
    ALTER TYPE order_status ADD VALUE 'pending_pos_payment' AFTER 'confirmed';
  END IF;
END $$;

-- Add POS tracking columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pos_draft_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pos_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pos_provider TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pos_integration_id UUID REFERENCES pos_integrations(id);

-- Add external IDs to order_items for Shopify line item mapping
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS external_product_id TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS external_variant_id TEXT;

-- Index for webhook lookups - find orders by draft order ID
CREATE INDEX IF NOT EXISTS idx_orders_pos_draft_order_id
  ON orders(pos_draft_order_id) WHERE pos_draft_order_id IS NOT NULL;

-- Index for finding orders by POS order ID (after draft is completed)
CREATE INDEX IF NOT EXISTS idx_orders_pos_order_id
  ON orders(pos_order_id) WHERE pos_order_id IS NOT NULL;

-- =====================================================
-- Update process_order_checkout to store external IDs
-- =====================================================

CREATE OR REPLACE FUNCTION process_order_checkout(
  p_customer_id UUID,
  p_merchant_id UUID,
  p_order_data JSONB,
  p_items JSONB[]
)
RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_barter_amount DECIMAL;
  v_item JSONB;
  v_order_number TEXT;
BEGIN
  -- Extract barter amount
  v_barter_amount := COALESCE((p_order_data->>'barter_amount')::DECIMAL, 0);

  -- Generate order number
  v_order_number := generate_order_number();

  -- Debit customer credits if using barter (using existing function)
  IF v_barter_amount > 0 THEN
    PERFORM debit_user_credits(p_customer_id, v_barter_amount);
    PERFORM credit_merchant_balance(p_merchant_id, v_barter_amount);
  END IF;

  -- Create order
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
    stripe_payment_intent_id,
    payment_method,
    payment_status,
    customer_name,
    customer_email,
    customer_phone,
    pickup_location,
    estimated_pickup_time,
    customer_notes,
    confirmed_at
  ) VALUES (
    v_order_number,
    p_customer_id,
    p_merchant_id,
    'confirmed',
    (p_order_data->>'subtotal')::DECIMAL,
    (p_order_data->>'eligible_subtotal')::DECIMAL,
    (p_order_data->>'restricted_subtotal')::DECIMAL,
    v_barter_amount,
    (p_order_data->>'barter_percentage')::DECIMAL,
    (p_order_data->>'cash_amount')::DECIMAL,
    (p_order_data->>'tax_amount')::DECIMAL,
    (p_order_data->>'total_amount')::DECIMAL,
    p_order_data->>'stripe_payment_intent_id',
    p_order_data->>'payment_method',
    'completed',
    p_order_data->>'customer_name',
    p_order_data->>'customer_email',
    p_order_data->>'customer_phone',
    p_order_data->>'pickup_location',
    (p_order_data->>'estimated_pickup_time')::TIMESTAMPTZ,
    p_order_data->>'customer_notes',
    NOW()
  ) RETURNING id INTO v_order_id;

  -- Create order items (now with external IDs)
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

  -- Note: POS transaction record will be created by webhook when payment completes

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function to update order from POS webhook
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
  v_order_status order_status;
BEGIN
  -- Find order by draft order ID
  SELECT id INTO v_order_id
  FROM orders
  WHERE pos_draft_order_id = p_draft_order_id;

  IF v_order_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Order not found for draft order ID'::TEXT;
    RETURN;
  END IF;

  -- Determine new status
  v_order_status := p_new_status::order_status;

  -- Update order
  UPDATE orders
  SET
    status = v_order_status,
    pos_order_id = p_pos_order_id,
    completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = v_order_id;

  RETURN QUERY SELECT v_order_id, TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::UUID, FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON COLUMN orders.pos_draft_order_id IS 'Shopify draft order ID for orders pending POS payment';
COMMENT ON COLUMN orders.pos_order_id IS 'Shopify order ID after draft is completed';
COMMENT ON COLUMN orders.pos_provider IS 'POS provider (shopify, square, clover)';
COMMENT ON COLUMN orders.pos_integration_id IS 'Reference to merchant POS integration';
COMMENT ON COLUMN order_items.external_product_id IS 'External product ID from POS system (e.g., Shopify product ID)';
COMMENT ON COLUMN order_items.external_variant_id IS 'External variant ID from POS system (e.g., Shopify variant ID)';
COMMENT ON FUNCTION update_order_from_pos_webhook IS 'Updates order status when POS webhook confirms payment';
