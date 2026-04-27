-- Create customer_barcodes table for Square Gift Card integration
-- Each customer gets a unique barcode they can scan at Square POS

CREATE TABLE IF NOT EXISTS customer_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id TEXT, -- Optional: external customer ID
  barcode TEXT NOT NULL UNIQUE,
  barcode_type TEXT DEFAULT 'CODE128', -- Barcode format: CODE128, QR, EAN13, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,

  CONSTRAINT unique_user_barcode UNIQUE(user_id, barcode)
);

-- Create index for fast barcode lookups
CREATE INDEX idx_customer_barcodes_barcode ON customer_barcodes(barcode) WHERE is_active = true;
CREATE INDEX idx_customer_barcodes_user_id ON customer_barcodes(user_id);

-- Add RLS policies
ALTER TABLE customer_barcodes ENABLE ROW LEVEL SECURITY;

-- Users can view their own barcodes
CREATE POLICY "Users can view own barcodes"
  ON customer_barcodes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own barcodes
CREATE POLICY "Users can create own barcodes"
  ON customer_barcodes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own barcodes
CREATE POLICY "Users can update own barcodes"
  ON customer_barcodes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do everything (for API calls from Square)
CREATE POLICY "Service role can manage all barcodes"
  ON customer_barcodes
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to auto-generate barcode for new users
CREATE OR REPLACE FUNCTION generate_customer_barcode(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_barcode TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Generate barcode using UUID-based unique code
  -- Format: BARTER-XXXXXXXX (8 characters)
  LOOP
    -- Generate random 8-character alphanumeric code
    v_barcode := 'BARTER-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));

    -- Check if barcode already exists
    SELECT EXISTS(SELECT 1 FROM customer_barcodes WHERE barcode = v_barcode) INTO v_exists;

    -- Exit loop if unique barcode generated
    EXIT WHEN NOT v_exists;
  END LOOP;

  -- Insert the barcode
  INSERT INTO customer_barcodes (user_id, barcode, barcode_type, is_active)
  VALUES (p_user_id, v_barcode, 'CODE128', true)
  ON CONFLICT (user_id, barcode) DO NOTHING;

  RETURN v_barcode;
END;
$$;

-- Trigger to auto-generate barcode when user creates credit account
CREATE OR REPLACE FUNCTION auto_generate_barcode_on_credit_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user already has a barcode
  IF NOT EXISTS (SELECT 1 FROM customer_barcodes WHERE user_id = NEW.user_id) THEN
    -- Generate barcode for new credit account owner
    PERFORM generate_customer_barcode(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to credit_accounts table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_accounts') THEN
    DROP TRIGGER IF EXISTS trigger_auto_generate_barcode ON credit_accounts;
    CREATE TRIGGER trigger_auto_generate_barcode
      AFTER INSERT ON credit_accounts
      FOR EACH ROW
      EXECUTE FUNCTION auto_generate_barcode_on_credit_account();
  END IF;
END $$;

-- Function to update last_used_at when barcode is scanned
CREATE OR REPLACE FUNCTION update_barcode_usage(p_barcode TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customer_barcodes
  SET
    last_used_at = NOW(),
    usage_count = usage_count + 1,
    updated_at = NOW()
  WHERE barcode = p_barcode AND is_active = true;
END;
$$;

-- Comment on table
COMMENT ON TABLE customer_barcodes IS 'Stores unique barcodes for customers to use with Square POS gift card integration for barter payments';
