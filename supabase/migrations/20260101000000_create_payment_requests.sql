-- Create payment_requests table for merchant-to-merchant variable-price service payments
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Party information
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Request details
  service_description TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount > 0),
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'paid', 'expired', 'cancelled')),

  -- Relationships
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  responded_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_payment_requests_seller_id ON payment_requests(seller_id);
CREATE INDEX idx_payment_requests_buyer_id ON payment_requests(buyer_id);
CREATE INDEX idx_payment_requests_status ON payment_requests(status);
CREATE INDEX idx_payment_requests_created_at ON payment_requests(created_at DESC);
CREATE INDEX idx_payment_requests_transaction_id ON payment_requests(transaction_id) WHERE transaction_id IS NOT NULL;

-- Enable RLS
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view payment requests they're involved in"
  ON payment_requests FOR SELECT
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

CREATE POLICY "Sellers can create payment requests"
  ON payment_requests FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their pending requests"
  ON payment_requests FOR UPDATE
  USING (auth.uid() = seller_id AND status = 'pending')
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Buyers can update requests sent to them"
  ON payment_requests FOR UPDATE
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can delete their pending requests"
  ON payment_requests FOR DELETE
  USING (auth.uid() = seller_id AND status = 'pending');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_payment_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_requests_updated_at
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_requests_updated_at();

-- Function to automatically expire old pending requests
CREATE OR REPLACE FUNCTION expire_old_payment_requests()
RETURNS void AS $$
BEGIN
  UPDATE payment_requests
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to create notification when payment request is created
CREATE OR REPLACE FUNCTION notify_payment_request_created()
RETURNS TRIGGER AS $$
DECLARE
  seller_name TEXT;
  buyer_email TEXT;
BEGIN
  -- Get seller name from profiles
  SELECT COALESCE(business_name, full_name, 'A merchant')
  INTO seller_name
  FROM profiles
  WHERE user_id = NEW.seller_id;

  -- Get buyer email from profiles
  SELECT email
  INTO buyer_email
  FROM profiles
  WHERE user_id = NEW.buyer_id;

  -- Create in-app notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    NEW.buyer_id,
    'New Payment Request',
    seller_name || ' has sent you a payment request for $' || NEW.total_amount::TEXT,
    'info'
  );

  -- Note: Email sending would be handled by an edge function
  -- This can be called via pg_net extension if available, or handled separately

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER payment_request_created_notification
  AFTER INSERT ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_request_created();

-- Trigger function to notify when request is accepted/rejected
CREATE OR REPLACE FUNCTION notify_payment_request_response()
RETURNS TRIGGER AS $$
DECLARE
  buyer_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Only proceed if status changed
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('accepted', 'rejected') THEN
    -- Get buyer name from profiles
    SELECT COALESCE(business_name, full_name, 'The merchant')
    INTO buyer_name
    FROM profiles
    WHERE user_id = NEW.buyer_id;

    IF NEW.status = 'accepted' THEN
      notification_title := 'Payment Request Accepted';
      notification_message := buyer_name || ' has accepted your payment request for $' || NEW.total_amount::TEXT;
    ELSE
      notification_title := 'Payment Request Rejected';
      notification_message := buyer_name || ' has rejected your payment request for $' || NEW.total_amount::TEXT;
    END IF;

    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      NEW.seller_id,
      notification_title,
      notification_message,
      CASE WHEN NEW.status = 'accepted' THEN 'success' ELSE 'info' END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER payment_request_response_notification
  AFTER UPDATE ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_request_response();

-- View to show payment requests with merchant details
CREATE OR REPLACE VIEW payment_requests_with_details AS
SELECT
  pr.*,
  seller_profile.business_name as seller_business_name,
  seller_profile.full_name as seller_full_name,
  seller_profile.email as seller_email,
  buyer_profile.business_name as buyer_business_name,
  buyer_profile.full_name as buyer_full_name,
  buyer_profile.email as buyer_email,
  CASE
    WHEN pr.status = 'pending' AND pr.expires_at < now() THEN true
    ELSE false
  END as is_expired
FROM payment_requests pr
LEFT JOIN profiles seller_profile ON seller_profile.user_id = pr.seller_id
LEFT JOIN profiles buyer_profile ON buyer_profile.user_id = pr.buyer_id;

-- Grant access to the view
GRANT SELECT ON payment_requests_with_details TO authenticated;

-- Comments for documentation
COMMENT ON TABLE payment_requests IS 'Merchant-to-merchant payment requests for services rendered';
COMMENT ON COLUMN payment_requests.line_items IS 'Array of {description, amount, quantity} objects for itemized breakdown';
COMMENT ON COLUMN payment_requests.expires_at IS 'Auto-expires after 7 days if not responded to';
COMMENT ON COLUMN payment_requests.metadata IS 'Additional context like attached photos, invoice numbers, etc';
COMMENT ON COLUMN payment_requests.transaction_id IS 'Links to the completed transaction once paid';
