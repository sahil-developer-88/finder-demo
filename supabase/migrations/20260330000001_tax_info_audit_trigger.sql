-- Trigger to write audit_logs entries whenever tax_info is inserted or updated
-- This powers the Tax & 1099 → Audit Trail tab in the admin panel

CREATE OR REPLACE FUNCTION public.audit_tax_info_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      new_data,
      old_data
    ) VALUES (
      NEW.user_id,
      'INSERT',
      'tax_info',
      NEW.id,
      jsonb_build_object(
        'legal_name',   NEW.legal_name,
        'business_name', NEW.business_name,
        'tax_id_type',  NEW.tax_id_type,
        'business_type', NEW.business_type,
        'state',        NEW.state,
        'city',         NEW.city,
        'signature_date', NEW.signature_date
      ),
      NULL
    );

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      new_data,
      old_data
    ) VALUES (
      NEW.user_id,
      'UPDATE',
      'tax_info',
      NEW.id,
      jsonb_build_object(
        'legal_name',   NEW.legal_name,
        'business_name', NEW.business_name,
        'tax_id_type',  NEW.tax_id_type,
        'business_type', NEW.business_type,
        'state',        NEW.state,
        'city',         NEW.city,
        'signature_date', NEW.signature_date
      ),
      jsonb_build_object(
        'legal_name',   OLD.legal_name,
        'business_name', OLD.business_name,
        'tax_id_type',  OLD.tax_id_type,
        'business_type', OLD.business_type,
        'state',        OLD.state,
        'city',         OLD.city,
        'signature_date', OLD.signature_date
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS tax_info_audit_trigger ON public.tax_info;

-- Create trigger on INSERT and UPDATE
CREATE TRIGGER tax_info_audit_trigger
  AFTER INSERT OR UPDATE ON public.tax_info
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_tax_info_changes();
