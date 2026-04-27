-- Create order status enum
CREATE TYPE order_status AS ENUM (
  'pending_payment',
  'payment_failed',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'completed',
  'cancelled',
  'refunded'
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Order details
  order_number TEXT NOT NULL UNIQUE,
  status order_status NOT NULL DEFAULT 'pending_payment',

  -- Financial breakdown
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  eligible_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (eligible_subtotal >= 0),
  restricted_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (restricted_subtotal >= 0),
  barter_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (barter_amount >= 0),
  barter_percentage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (barter_percentage >= 0 AND barter_percentage <= 100),
  cash_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cash_amount >= 0),
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),

  -- Payment info
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',

  -- Customer info
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,

  -- Pickup info
  pickup_location TEXT NOT NULL,
  estimated_pickup_time TIMESTAMPTZ,
  actual_pickup_time TIMESTAMPTZ,

  -- Notes
  customer_notes TEXT,
  merchant_notes TEXT,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,

  -- Product snapshot (in case product is deleted)
  product_name TEXT NOT NULL,
  product_sku TEXT,
  product_barcode TEXT,
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),

  -- Barter eligibility
  is_barter_eligible BOOLEAN NOT NULL DEFAULT true,
  restriction_reason TEXT,
  category_name TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_orders_customer_id ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_merchant_id ON orders(merchant_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders table

-- Customers can view their own orders
CREATE POLICY "Customers can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = customer_id);

-- Merchants can view orders placed with them
CREATE POLICY "Merchants can view their orders"
  ON orders FOR SELECT
  USING (auth.uid() = merchant_id);

-- Authenticated users can create orders (as customers)
CREATE POLICY "Authenticated users can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

-- Customers can update their own orders (limited to notes)
CREATE POLICY "Customers can update their order notes"
  ON orders FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Merchants can update orders placed with them (status, merchant notes)
CREATE POLICY "Merchants can update their orders"
  ON orders FOR UPDATE
  USING (auth.uid() = merchant_id)
  WITH CHECK (auth.uid() = merchant_id);

-- RLS Policies for order_items table

-- Users can view order items if they can view the order
CREATE POLICY "Users can view order items for their orders"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.customer_id = auth.uid() OR orders.merchant_id = auth.uid())
    )
  );

-- Authenticated users can insert order items when creating orders
CREATE POLICY "Users can insert order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.customer_id = auth.uid()
    )
  );

-- RLS Policy for products table - Allow authenticated users to view active products
CREATE POLICY "Authenticated users can view active products"
  ON products FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND is_archived = false
  );

-- Function to generate unique order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_order_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 'ORD-' || v_year || '-(.*)') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM orders
  WHERE order_number LIKE 'ORD-' || v_year || '-%';

  -- Format as ORD-YYYY-NNNNNN
  v_order_number := 'ORD-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');

  RETURN v_order_number;
END;
$$ LANGUAGE plpgsql;

-- Function to process complete order checkout
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
      category_name
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
      v_item->>'category_name'
    );
  END LOOP;

  -- Create POS transaction record (for merchant's records)
  INSERT INTO pos_transactions (
    merchant_id,
    provider,
    external_transaction_id,
    transaction_type,
    status,
    total_amount,
    currency,
    barter_amount,
    cash_amount,
    barter_percentage,
    tax_amount,
    items,
    metadata,
    processed_at
  ) VALUES (
    p_merchant_id,
    'online_order',
    v_order_number,
    'sale',
    'completed',
    (p_order_data->>'total_amount')::DECIMAL,
    'USD',
    v_barter_amount,
    (p_order_data->>'cash_amount')::DECIMAL,
    (p_order_data->>'barter_percentage')::DECIMAL,
    (p_order_data->>'tax_amount')::DECIMAL,
    p_items::JSONB,
    jsonb_build_object('order_id', v_order_id, 'source', 'customer_checkout'),
    NOW()
  );

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update order status
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_new_status order_status,
  p_merchant_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_status order_status;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status
  FROM orders
  WHERE id = p_order_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Update order status
  UPDATE orders
  SET
    status = p_new_status,
    merchant_notes = COALESCE(p_merchant_notes, merchant_notes),
    updated_at = NOW(),
    completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
    cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN NOW() ELSE cancelled_at END
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
