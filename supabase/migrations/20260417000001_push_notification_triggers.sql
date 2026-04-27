-- Push notification triggers via pg_net
-- Fire server-side regardless of whether the browser is open

CREATE OR REPLACE FUNCTION public.trigger_push_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://etzwoyyhxvwpdejckpaq.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0endveXloeHZ3cGRlamNrcGFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDAxMiwiZXhwIjoyMDczNTQ2MDEyfQ.5G5rpWRjzRJN79t45xtD90KvWZD0rYykvOJgeeLBNmM'
    ),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'messages',
      'record', row_to_json(NEW)
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_push_on_trade_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://etzwoyyhxvwpdejckpaq.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0endveXloeHZ3cGRlamNrcGFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDAxMiwiZXhwIjoyMDczNTQ2MDEyfQ.5G5rpWRjzRJN79t45xtD90KvWZD0rYykvOJgeeLBNmM'
    ),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'trade_requests',
      'record', row_to_json(NEW)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_on_new_message ON public.messages;
CREATE TRIGGER push_on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_message();

DROP TRIGGER IF EXISTS push_on_new_trade_request ON public.trade_requests;
CREATE TRIGGER push_on_new_trade_request
  AFTER INSERT ON public.trade_requests
  FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_trade_request();
