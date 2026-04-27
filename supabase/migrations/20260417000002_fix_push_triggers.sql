-- Fix push triggers: wrap in exception handler so errors never block the INSERT

CREATE OR REPLACE FUNCTION public.trigger_push_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block the message insert
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_push_on_trade_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block the trade request insert
  END;
  RETURN NEW;
END;
$$;
