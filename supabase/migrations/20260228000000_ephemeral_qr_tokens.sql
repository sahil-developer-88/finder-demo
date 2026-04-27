-- =====================================================
-- Ephemeral QR Token System (In-App Barter Scanner)
-- =====================================================
-- Adds generate + atomic-consume functions on top of the
-- existing pos_barcode_scans table.
-- =====================================================

-- -------------------------------------------------------
-- generate_ephemeral_qr_token
-- Creates a short-lived, single-use QR token for a customer.
-- Inserts into pos_barcode_scans (existing table).
-- Returns the token string to embed in the QR code.
-- TTL is clamped to 1–5 minutes.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_ephemeral_qr_token(
  p_user_id     UUID,
  p_ttl_minutes INT DEFAULT 3
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token      TEXT;
  v_ttl        INT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Clamp TTL to 1–5 minutes
  v_ttl        := GREATEST(1, LEAST(5, COALESCE(p_ttl_minutes, 3)));
  v_expires_at := NOW() + (v_ttl || ' minutes')::INTERVAL;

  -- Expire any previous active ephemeral tokens for this customer
  -- so there is only ever one live QR at a time
  UPDATE pos_barcode_scans
  SET
    status     = 'expired',
    is_used    = TRUE,
    updated_at = NOW()
  WHERE
    customer_id = p_user_id
    AND is_used  = FALSE
    AND status   = 'active'
    AND barcode_value LIKE 'QRT-%';

  -- Build unique token: QRT-<8-char user prefix>-<12-char random>
  v_token := 'QRT-'
    || UPPER(REPLACE(SUBSTRING(p_user_id::TEXT FROM 1 FOR 8), '-', ''))
    || '-'
    || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 12));

  -- Insert the new ephemeral token
  INSERT INTO pos_barcode_scans (
    barcode_value,
    customer_id,
    generated_at,
    expires_at,
    is_used,
    status
  ) VALUES (
    v_token,
    p_user_id,
    NOW(),
    v_expires_at,
    FALSE,
    'active'
  );

  RETURN v_token;
END;
$$;

-- -------------------------------------------------------
-- validate_and_consume_qr_token
-- Atomically checks and consumes an ephemeral QR token.
-- Uses FOR UPDATE NOWAIT to prevent concurrent redemptions
-- (anti-replay V1).
-- Returns customer_id + consumed_at on success.
-- Raises a named exception on failure so the caller can
-- show a user-friendly message.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_and_consume_qr_token(
  p_token       TEXT,
  p_merchant_id UUID
)
RETURNS TABLE (
  customer_id UUID,
  consumed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan RECORD;
BEGIN
  -- Lock the row to block concurrent scans of the same QR
  SELECT *
  INTO   v_scan
  FROM   pos_barcode_scans
  WHERE  barcode_value = p_token
  FOR UPDATE NOWAIT;

  -- Token not found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR code not recognised. Please generate a new one.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Already consumed (replay attack)
  IF v_scan.is_used THEN
    RAISE EXCEPTION 'This QR code has already been used. Please generate a new one.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Expired
  IF v_scan.expires_at < NOW() THEN
    UPDATE pos_barcode_scans
    SET status = 'expired', is_used = TRUE, updated_at = NOW()
    WHERE id = v_scan.id;

    RAISE EXCEPTION 'QR code expired. Please generate a new one.'
      USING ERRCODE = 'P0003';
  END IF;

  -- All checks passed — atomically consume
  UPDATE pos_barcode_scans
  SET
    is_used     = TRUE,
    scanned_at  = NOW(),
    merchant_id = p_merchant_id,
    status      = 'scanned',
    updated_at  = NOW()
  WHERE id = v_scan.id;

  RETURN QUERY SELECT v_scan.customer_id, NOW()::TIMESTAMPTZ;
END;
$$;

-- -------------------------------------------------------
-- cleanup_expired_qr_tokens (maintenance helper)
-- Mark any stale active tokens as expired.
-- Can be wired to pg_cron or called manually.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_qr_tokens()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE pos_barcode_scans
    SET status = 'expired', is_used = TRUE, updated_at = NOW()
    WHERE is_used = FALSE
      AND expires_at < NOW()
      AND status = 'active'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

-- Grant execute to authenticated users (RLS on the underlying table
-- already enforces row-level ownership)
GRANT EXECUTE ON FUNCTION generate_ephemeral_qr_token(UUID, INT)    TO authenticated;
GRANT EXECUTE ON FUNCTION validate_and_consume_qr_token(TEXT, UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_qr_tokens()               TO authenticated;
