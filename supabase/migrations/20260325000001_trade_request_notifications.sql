-- Trigger to notify merchant when a trade request is created
CREATE OR REPLACE FUNCTION notify_trade_request_created()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT COALESCE(business_name, full_name, 'A user')
    INTO sender_name
    FROM profiles
   WHERE user_id = NEW.sender_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    NEW.merchant_id,
    'New Trade Request',
    'trade_request:' || NEW.id::TEXT,
    'info'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trade_request_created_notification
  AFTER INSERT ON trade_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_request_created();

-- Trigger to notify sender when merchant accepts/rejects
CREATE OR REPLACE FUNCTION notify_trade_request_response()
RETURNS TRIGGER AS $$
DECLARE
  merchant_name TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  SELECT COALESCE(business_name, full_name, 'The merchant')
    INTO merchant_name
    FROM profiles
   WHERE user_id = NEW.merchant_id;

  IF NEW.status IN ('accepted', 'rejected') THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      NEW.sender_id,
      CASE WHEN NEW.status = 'accepted' THEN 'Trade Request Accepted!' ELSE 'Trade Request Declined' END,
      merchant_name || CASE WHEN NEW.status = 'accepted'
        THEN ' accepted your trade request for "' || NEW.service_name || '".'
        ELSE ' declined your trade request for "' || NEW.service_name || '".'
      END,
      CASE WHEN NEW.status = 'accepted' THEN 'success' ELSE 'info' END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trade_request_response_notification
  AFTER UPDATE ON trade_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_request_response();
