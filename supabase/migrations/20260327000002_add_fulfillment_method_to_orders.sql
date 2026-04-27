-- Add fulfillment_method column to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_method TEXT DEFAULT 'pickup';

-- Update create_pending_order to store fulfillment_method
CREATE OR REPLACE FUNCTION create_pending_order(
  p_customer_id UUID,
  p_merchant_id UUID,
  p_order_data  JSONB,
  p_items       JSONB[]
)
RETURNS UUID AS $$
DECLARE
  v_order_id     UUID;
  v_item         JSONB;
  v_order_number TEXT;
BEGIN
  v_order_number := generate_order_number();

  INSERT INTO orders (
    order_number, customer_id, merchant_id, status,
    subtotal, eligible_subtotal, restricted_subtotal,
    barter_amount, barter_percentage, cash_amount,
    delivery_fee, service_fee, tax_amount, total_amount,
    payment_method, payment_status,
    customer_name, customer_email, customer_phone,
    pickup_location, estimated_pickup_time, customer_notes,
    delivery_address, delivery_city, delivery_state, delivery_zip,
    fulfillment_method
  ) VALUES (
    v_order_number, p_customer_id, p_merchant_id, 'pending_payment',
    (p_order_data->>'subtotal')::DECIMAL,
    (p_order_data->>'eligible_subtotal')::DECIMAL,
    (p_order_data->>'restricted_subtotal')::DECIMAL,
    COALESCE((p_order_data->>'barter_amount')::DECIMAL, 0),
    (p_order_data->>'barter_percentage')::DECIMAL,
    (p_order_data->>'cash_amount')::DECIMAL,
    COALESCE((p_order_data->>'delivery_fee')::DECIMAL, 0),
    COALESCE((p_order_data->>'service_fee')::DECIMAL,  0),
    (p_order_data->>'tax_amount')::DECIMAL,
    (p_order_data->>'total_amount')::DECIMAL,
    'pos_checkout', 'pending',
    p_order_data->>'customer_name',
    p_order_data->>'customer_email',
    p_order_data->>'customer_phone',
    p_order_data->>'pickup_location',
    (p_order_data->>'estimated_pickup_time')::TIMESTAMPTZ,
    p_order_data->>'customer_notes',
    p_order_data->>'delivery_address',
    p_order_data->>'delivery_city',
    p_order_data->>'delivery_state',
    p_order_data->>'delivery_zip',
    COALESCE(p_order_data->>'fulfillment_method', 'pickup')
  ) RETURNING id INTO v_order_id;

  FOREACH v_item IN ARRAY p_items LOOP
    INSERT INTO order_items (
      order_id, product_id, product_name, product_sku, product_barcode,
      unit_price, quantity, subtotal,
      is_barter_eligible, restriction_reason, category_name,
      external_product_id, external_variant_id
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name', v_item->>'product_sku', v_item->>'product_barcode',
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'subtotal')::DECIMAL,
      (v_item->>'is_barter_eligible')::BOOLEAN,
      v_item->>'restriction_reason', v_item->>'category_name',
      v_item->>'external_product_id', v_item->>'external_variant_id'
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
