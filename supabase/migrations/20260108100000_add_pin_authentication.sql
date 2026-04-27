-- Add PIN authentication for POS payments
-- Allows customers to authenticate without barcode by providing business name + 4-digit PIN

-- Add PIN column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS pos_pin TEXT CHECK (pos_pin ~ '^[0-9]{4}$'); -- 4 digits only

-- Create index for faster business name lookups
CREATE INDEX IF NOT EXISTS idx_businesses_name_search ON businesses USING gin(to_tsvector('english', business_name));

-- Function to authenticate user by business name + PIN
CREATE OR REPLACE FUNCTION authenticate_with_pin(
  p_business_name TEXT,
  p_pin TEXT
) RETURNS TABLE (
  success BOOLEAN,
  user_id UUID,
  full_name TEXT,
  business_name TEXT,
  available_credits NUMERIC,
  error_message TEXT
) AS $$
DECLARE
  v_business RECORD;
  v_profile RECORD;
  v_credits RECORD;
BEGIN
  -- Trim and normalize inputs
  p_business_name := TRIM(p_business_name);
  p_pin := TRIM(p_pin);

  -- Validate PIN format
  IF p_pin !~ '^[0-9]{4}$' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, 'PIN must be exactly 4 digits'::TEXT;
    RETURN;
  END IF;

  -- Find business by name (case-insensitive, fuzzy match)
  SELECT * INTO v_business
  FROM businesses
  WHERE LOWER(business_name) = LOWER(p_business_name)
  LIMIT 1;

  IF v_business IS NULL THEN
    -- Try fuzzy match
    SELECT * INTO v_business
    FROM businesses
    WHERE LOWER(business_name) LIKE LOWER('%' || p_business_name || '%')
    LIMIT 1;
  END IF;

  IF v_business IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, 'Business not found'::TEXT;
    RETURN;
  END IF;

  -- Get profile and verify PIN
  SELECT * INTO v_profile
  FROM profiles
  WHERE user_id = v_business.user_id;

  IF v_profile IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, 'User profile not found'::TEXT;
    RETURN;
  END IF;

  -- Check if PIN is set
  IF v_profile.pos_pin IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, 'PIN not set for this account'::TEXT;
    RETURN;
  END IF;

  -- Verify PIN
  IF v_profile.pos_pin != p_pin THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, 'Invalid PIN'::TEXT;
    RETURN;
  END IF;

  -- Get user credits
  SELECT * INTO v_credits
  FROM user_credits
  WHERE user_id = v_business.user_id;

  -- Return success
  RETURN QUERY SELECT
    TRUE,
    v_business.user_id,
    v_profile.full_name,
    v_business.business_name,
    COALESCE(v_credits.available_credits, 0),
    NULL::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION authenticate_with_pin(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION authenticate_with_pin(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION authenticate_with_pin IS 'Authenticate customer by business name and 4-digit PIN for POS payments';
