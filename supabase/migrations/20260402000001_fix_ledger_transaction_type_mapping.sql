-- Fix the transaction_type → source mapping in the ledger trigger.
-- MerchantScanner saves transaction_type = 'purchase' (not 'pos_scan').
-- This corrects QR scan payments being labelled as 'trade'.

CREATE OR REPLACE FUNCTION public.fn_ledger_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barter_amt   numeric(12,2);
  v_source       text;
BEGIN
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  v_barter_amt := COALESCE(NEW.points_amount, 0);

  v_source := CASE NEW.transaction_type
    WHEN 'payment_request' THEN 'payment_request'
    WHEN 'purchase'        THEN 'qr_scan'
    WHEN 'send'            THEN 'trade'
    WHEN 'barter'          THEN 'trade'
    ELSE                        'trade'
  END;

  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description)
  VALUES
    (NEW.from_user_id, 'debit', 0, v_barter_amt, v_source, NEW.id::text,
     COALESCE(NEW.service_description, 'Barter transaction'));

  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description)
  VALUES
    (NEW.to_user_id, 'credit', 0, v_barter_amt, v_source, NEW.id::text,
     COALESCE(NEW.service_description, 'Barter transaction'));

  RETURN NEW;
END;
$$;
