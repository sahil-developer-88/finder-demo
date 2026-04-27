-- =====================================================
-- POS Split Payment System Database Schema
-- =====================================================
-- This migration adds tables and functions for automated
-- split payment integration with POS systems (Shopify, Square, Clover, etc.)
-- =====================================================

-- Track POS barcode scans with one-time use security
CREATE TABLE IF NOT EXISTS pos_barcode_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_value TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pos_integration_id UUID REFERENCES pos_integrations(id) ON DELETE SET NULL,

  -- Barcode metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  scanned_at TIMESTAMPTZ,
  is_used BOOLEAN DEFAULT FALSE,

  -- Transaction linking
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  pos_transaction_id UUID REFERENCES pos_transactions(id) ON DELETE SET NULL,

  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'scanned', 'completed', 'expired', 'cancelled')),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pos_barcode_expires ON pos_barcode_scans(expires_at) WHERE NOT is_used;
CREATE INDEX IF NOT EXISTS idx_pos_barcode_customer ON pos_barcode_scans(customer_id);
CREATE INDEX IF NOT EXISTS idx_pos_barcode_merchant ON pos_barcode_scans(merchant_id);
CREATE INDEX IF NOT EXISTS idx_pos_barcode_value ON pos_barcode_scans(barcode_value) WHERE NOT is_used;

-- Track POS split payment sessions (in-progress transactions)
CREATE TABLE IF NOT EXISTS pos_payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_scan_id UUID REFERENCES pos_barcode_scans(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pos_integration_id UUID NOT NULL REFERENCES pos_integrations(id) ON DELETE CASCADE,

  -- POS-specific data
  pos_provider TEXT NOT NULL,
  pos_order_id TEXT, -- External POS order/transaction/draft order ID
  pos_terminal_id TEXT,
  pos_location_id TEXT,
  pos_discount_id TEXT, -- ID of applied discount (for rollback)

  -- Amounts
  total_amount DECIMAL(10,2),
  barter_amount DECIMAL(10,2),
  barter_percentage DECIMAL(5,2),
  cash_amount DECIMAL(10,2),

  -- State machine
  session_status TEXT DEFAULT 'initiated' CHECK (
    session_status IN (
      'initiated',         -- Barcode scanned
      'calculating',       -- Fetching total from POS
      'validated',         -- Customer has sufficient credits
      'discount_applied',  -- Discount sent to POS
      'payment_pending',   -- Waiting for POS payment
      'completed',         -- Success
      'failed',            -- Error occurred
      'rolled_back'        -- Transaction reversed
    )
  ),

  -- Error handling
  error_message TEXT,
  rollback_reason TEXT,
  rollback_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pos_sessions_status ON pos_payment_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_merchant ON pos_payment_sessions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_customer ON pos_payment_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_order ON pos_payment_sessions(pos_order_id) WHERE pos_order_id IS NOT NULL;

-- Merchant POS settings (per-merchant configuration)
CREATE TABLE IF NOT EXISTS merchant_pos_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pos_integration_id UUID REFERENCES pos_integrations(id) ON DELETE SET NULL,

  -- Feature toggles
  enable_pos_split_payment BOOLEAN DEFAULT FALSE,
  enable_auto_discount BOOLEAN DEFAULT TRUE, -- Auto-apply discount vs manual
  enable_barcode_scanning BOOLEAN DEFAULT TRUE,

  -- Default settings
  default_barter_percentage DECIMAL(5,2),
  max_barter_amount_per_transaction DECIMAL(10,2),
  daily_barter_limit DECIMAL(10,2),

  -- Notification preferences
  notify_on_insufficient_credits BOOLEAN DEFAULT TRUE,
  notify_on_payment_failure BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily barter limit tracking
CREATE TABLE IF NOT EXISTS merchant_daily_barter_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  limit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_limit DECIMAL(10,2) NOT NULL,
  used_amount DECIMAL(10,2) DEFAULT 0,
  remaining_amount DECIMAL(10,2) GENERATED ALWAYS AS (daily_limit - used_amount) STORED,

  transaction_count INTEGER DEFAULT 0,
  last_transaction_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(merchant_id, customer_id, limit_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_limits_date ON merchant_daily_barter_limits(limit_date);
CREATE INDEX IF NOT EXISTS idx_daily_limits_merchant_customer ON merchant_daily_barter_limits(merchant_id, customer_id);

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- Initiate POS payment session
CREATE OR REPLACE FUNCTION initiate_pos_payment_session(
  p_barcode TEXT,
  p_merchant_id UUID,
  p_pos_integration_id UUID
) RETURNS TABLE (
  session_id UUID,
  customer_id UUID,
  customer_name TEXT,
  available_credits DECIMAL,
  barter_percentage DECIMAL,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_customer_id UUID;
  v_barcode_scan_id UUID;
  v_session_id UUID;
  v_customer_name TEXT;
  v_credits DECIMAL;
  v_barter_pct DECIMAL;
  v_pos_provider TEXT;
BEGIN
  -- Parse barcode to get customer ID (format: userId-timestamp)
  BEGIN
    v_customer_id := split_part(p_barcode, '-', 1)::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL,
      FALSE, 'Invalid barcode format'::TEXT;
    RETURN;
  END;

  -- Check if barcode exists and is valid
  SELECT id INTO v_barcode_scan_id
  FROM pos_barcode_scans
  WHERE barcode_value = p_barcode
    AND NOT is_used
    AND expires_at > NOW()
    AND status = 'active';

  IF v_barcode_scan_id IS NULL THEN
    -- Create new barcode scan record
    INSERT INTO pos_barcode_scans (
      barcode_value, customer_id, merchant_id, pos_integration_id,
      expires_at, status
    ) VALUES (
      p_barcode, v_customer_id, p_merchant_id, p_pos_integration_id,
      NOW() + INTERVAL '10 minutes', 'scanned'
    ) RETURNING id INTO v_barcode_scan_id;
  ELSE
    -- Update existing scan
    UPDATE pos_barcode_scans
    SET scanned_at = NOW(),
        status = 'scanned',
        merchant_id = p_merchant_id,
        pos_integration_id = p_pos_integration_id
    WHERE id = v_barcode_scan_id;
  END IF;

  -- Get customer info
  SELECT full_name INTO v_customer_name
  FROM profiles WHERE id = v_customer_id;

  IF v_customer_name IS NULL THEN
    v_customer_name := 'Customer';
  END IF;

  -- Get customer credits
  SELECT COALESCE(available_credits, 0) INTO v_credits
  FROM user_credits WHERE user_id = v_customer_id;

  IF v_credits IS NULL THEN
    v_credits := 0;
  END IF;

  -- Get merchant barter percentage
  SELECT COALESCE(
    mps.default_barter_percentage,
    b.barter_percentage,
    p.barter_percentage,
    25
  ) INTO v_barter_pct
  FROM profiles p
  LEFT JOIN businesses b ON b.user_id = p_merchant_id
  LEFT JOIN merchant_pos_settings mps ON mps.merchant_id = p_merchant_id
  WHERE p.id = p_merchant_id;

  -- Get POS provider
  SELECT pos_provider INTO v_pos_provider
  FROM pos_integrations
  WHERE id = p_pos_integration_id;

  -- Create payment session
  INSERT INTO pos_payment_sessions (
    barcode_scan_id, customer_id, merchant_id, pos_integration_id,
    pos_provider, session_status
  ) VALUES (
    v_barcode_scan_id, v_customer_id, p_merchant_id, p_pos_integration_id,
    v_pos_provider, 'initiated'
  ) RETURNING id INTO v_session_id;

  -- Return session info
  RETURN QUERY SELECT
    v_session_id,
    v_customer_id,
    v_customer_name,
    v_credits,
    v_barter_pct,
    TRUE,
    NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT
    NULL::UUID, NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL,
    FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete POS payment session (called after POS confirms payment)
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

  -- Create transaction
  INSERT INTO transactions (
    from_user_id, to_user_id, points_amount,
    transaction_type, status, notes
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

-- Rollback POS payment session (if payment fails)
CREATE OR REPLACE FUNCTION rollback_pos_payment_session(
  p_session_id UUID,
  p_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Get session details
  SELECT * INTO v_session
  FROM pos_payment_sessions
  WHERE id = p_session_id;

  IF v_session IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Update session status
  UPDATE pos_payment_sessions
  SET session_status = 'rolled_back',
      rollback_reason = p_reason,
      rollback_at = NOW()
  WHERE id = p_session_id;

  -- Mark barcode as unused so it can be retried
  UPDATE pos_barcode_scans
  SET is_used = FALSE,
      status = 'active'
  WHERE id = v_session.barcode_scan_id;

  RETURN TRUE;

EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-expire old sessions (run via cron job)
CREATE OR REPLACE FUNCTION expire_old_pos_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  -- Mark expired sessions as failed
  UPDATE pos_payment_sessions
  SET session_status = 'failed',
      error_message = 'Session expired'
  WHERE expires_at < NOW()
    AND session_status NOT IN ('completed', 'failed', 'rolled_back');

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Mark expired barcodes
  UPDATE pos_barcode_scans
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND NOT is_used
    AND status = 'active';

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE pos_barcode_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_pos_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_daily_barter_limits ENABLE ROW LEVEL SECURITY;

-- Policies for pos_barcode_scans
CREATE POLICY "Users can view their own barcodes"
  ON pos_barcode_scans FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Merchants can view scanned barcodes"
  ON pos_barcode_scans FOR SELECT
  USING (auth.uid() = merchant_id);

-- Policies for pos_payment_sessions
CREATE POLICY "Merchants can view their sessions"
  ON pos_payment_sessions FOR SELECT
  USING (auth.uid() = merchant_id);

CREATE POLICY "Customers can view their sessions"
  ON pos_payment_sessions FOR SELECT
  USING (auth.uid() = customer_id);

-- Policies for merchant_pos_settings
CREATE POLICY "Merchants can manage their settings"
  ON merchant_pos_settings FOR ALL
  USING (auth.uid() = merchant_id);

-- Policies for merchant_daily_barter_limits
CREATE POLICY "Merchants can view their limits"
  ON merchant_daily_barter_limits FOR SELECT
  USING (auth.uid() = merchant_id OR auth.uid() = customer_id);

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE pos_barcode_scans IS 'Tracks customer barcode scans for POS split payments with one-time use security';
COMMENT ON TABLE pos_payment_sessions IS 'Manages in-progress POS payment sessions from barcode scan to completion';
COMMENT ON TABLE merchant_pos_settings IS 'Per-merchant configuration for POS split payment feature';
COMMENT ON TABLE merchant_daily_barter_limits IS 'Tracks daily barter usage limits per customer per merchant';
COMMENT ON FUNCTION initiate_pos_payment_session IS 'Validates barcode and creates new payment session';
COMMENT ON FUNCTION complete_pos_payment_session IS 'Finalizes payment session and transfers credits';
COMMENT ON FUNCTION rollback_pos_payment_session IS 'Reverts payment session if POS payment fails';
