-- QR failure log — tracks when a merchant scans an expired QR (P0003)
-- This is the only real user-facing QR failure worth tracking.
CREATE TABLE IF NOT EXISTS public.qr_failure_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  merchant_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token        TEXT NOT NULL,
  failure_code TEXT NOT NULL, -- P0001 not found, P0002 already used, P0003 expired
  expired_at   TIMESTAMPTZ,   -- when the token expired
  scanned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- when merchant attempted scan
  seconds_late INT,  -- populated at insert time: EXTRACT(EPOCH FROM (scanned_at - expired_at))
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qr_failure_log_created   ON public.qr_failure_log(created_at DESC);
CREATE INDEX idx_qr_failure_log_merchant  ON public.qr_failure_log(merchant_id);
CREATE INDEX idx_qr_failure_log_customer  ON public.qr_failure_log(customer_id);

ALTER TABLE public.qr_failure_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all failures
CREATE POLICY "Admins can read qr failure log"
  ON public.qr_failure_log FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Function itself writes via SECURITY DEFINER so no insert policy needed for users

-- -------------------------------------------------------
-- Update validate_and_consume_qr_token to log P0003
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
    INSERT INTO qr_failure_log (merchant_id, token, failure_code)
    VALUES (p_merchant_id, p_token, 'P0001');

    RAISE EXCEPTION 'QR code not recognised. Please generate a new one.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Already consumed (replay attack)
  IF v_scan.is_used THEN
    INSERT INTO qr_failure_log (customer_id, merchant_id, token, failure_code, expired_at)
    VALUES (v_scan.customer_id, p_merchant_id, p_token, 'P0002', v_scan.expires_at);

    RAISE EXCEPTION 'This QR code has already been used. Please generate a new one.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Expired — the main failure case
  IF v_scan.expires_at < NOW() THEN
    UPDATE pos_barcode_scans
    SET status = 'expired', is_used = TRUE, updated_at = NOW()
    WHERE id = v_scan.id;

    INSERT INTO qr_failure_log (customer_id, merchant_id, token, failure_code, expired_at)
    VALUES (v_scan.customer_id, p_merchant_id, p_token, 'P0003', v_scan.expires_at);

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

-- Grant stays the same
GRANT EXECUTE ON FUNCTION validate_and_consume_qr_token(TEXT, UUID) TO authenticated;
