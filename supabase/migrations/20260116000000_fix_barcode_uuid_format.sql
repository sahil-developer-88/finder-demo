-- Fix barcode parsing to look up customer from customer_barcodes table
-- Previously: barcode was treated as UUID directly
-- Now: barcode format is BARTER-XXXXXXXX, look up user_id from customer_barcodes table

-- Update the initiate_pos_payment_session function
CREATE OR REPLACE FUNCTION initiate_pos_payment_session(
  p_barcode TEXT,
  p_merchant_id UUID,
  p_pos_integration_id UUID
)
RETURNS TABLE (
  session_id UUID,
  customer_id UUID,
  customer_name TEXT,
  available_credits DECIMAL,
  barter_percentage DECIMAL,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id UUID;
  v_barcode_scan_id UUID;
  v_session_id UUID;
  v_customer_name TEXT;
  v_credits DECIMAL;
  v_barter_pct DECIMAL;
  v_pos_provider TEXT;
BEGIN
  -- Look up customer by barcode from customer_barcodes table
  -- Barcode format: BARTER-XXXXXXXX
  SELECT user_id INTO v_customer_id
  FROM customer_barcodes
  WHERE barcode = TRIM(p_barcode)
    AND is_active = true;

  IF v_customer_id IS NULL THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL,
      FALSE, 'Invalid barcode - customer not found'::TEXT;
    RETURN;
  END IF;

  -- Update barcode usage tracking
  PERFORM update_barcode_usage(TRIM(p_barcode));

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
  SELECT available_credits INTO v_credits
  FROM user_credits WHERE user_id = v_customer_id;

  IF v_credits IS NULL THEN
    v_credits := 0;
  END IF;

  -- Get merchant's barter percentage from POS integration
  SELECT provider, COALESCE((config->>'barter_percentage')::DECIMAL, 50)
  INTO v_pos_provider, v_barter_pct
  FROM pos_integrations WHERE id = p_pos_integration_id;

  IF v_pos_provider IS NULL THEN
    -- Fallback: get from merchant_pos_settings
    SELECT default_barter_percentage INTO v_barter_pct
    FROM merchant_pos_settings WHERE merchant_id = p_merchant_id;

    IF v_barter_pct IS NULL THEN
      v_barter_pct := 50; -- Default to 50%
    END IF;
  END IF;

  -- Create payment session
  INSERT INTO pos_payment_sessions (
    customer_id, merchant_id, pos_provider,
    barcode_scan_id, session_status, barter_percentage
  ) VALUES (
    v_customer_id, p_merchant_id, COALESCE(v_pos_provider, 'unknown'),
    v_barcode_scan_id, 'initiated', v_barter_pct
  ) RETURNING id INTO v_session_id;

  -- Return success
  RETURN QUERY SELECT
    v_session_id,
    v_customer_id,
    v_customer_name,
    v_credits,
    v_barter_pct,
    TRUE,
    NULL::TEXT;
END;
$$;

-- Add comment
COMMENT ON FUNCTION initiate_pos_payment_session IS 'Creates a POS payment session. Barcode format: BARTER-XXXXXXXX (from customer_barcodes table).';
