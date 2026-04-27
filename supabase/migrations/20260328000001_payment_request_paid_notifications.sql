-- DB trigger to send CR/DR notifications when a payment request is paid.
-- Using SECURITY DEFINER so it runs as the DB owner, which makes Supabase Realtime
-- broadcast the change to the correct subscriber (seller) reliably.
-- Frontend inserts for other users don't trigger realtime for that user;
-- DB triggers do.

CREATE OR REPLACE FUNCTION notify_payment_request_paid()
RETURNS TRIGGER AS $$
DECLARE
  buyer_name  TEXT;
  barter_amt  NUMERIC;
  cash_amt    NUMERIC;
  desc_text   TEXT;
BEGIN
  -- Only fire when status transitions to 'paid'
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(business_name, full_name, 'A member')
    INTO buyer_name
    FROM profiles
   WHERE user_id = NEW.buyer_id;

  barter_amt := COALESCE((NEW.metadata->>'barter_amount')::NUMERIC, 0);
  cash_amt   := COALESCE((NEW.metadata->>'cash_amount')::NUMERIC, NEW.total_amount);
  desc_text  := NEW.service_description;

  -- CR notification → seller (the one who sent the request)
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    NEW.seller_id,
    'Payment Received',
    'CR: ' || buyer_name || ' paid you ' ||
      CASE WHEN barter_amt > 0
        THEN barter_amt::TEXT || ' barter credits'
        ELSE '$' || cash_amt::TEXT
      END ||
      ' for "' || desc_text || '"',
    'success'
  );

  -- DR notification → buyer (the one who paid)
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    NEW.buyer_id,
    'Barter Credits Debited',
    'DR: ' ||
      CASE WHEN barter_amt > 0
        THEN barter_amt::TEXT || ' barter credits'
        ELSE '$' || cash_amt::TEXT
      END ||
      ' debited for "' || desc_text || '"',
    'info'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER payment_request_paid_notification
  AFTER UPDATE ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_request_paid();
