-- Enable pg_net extension (required for HTTP calls from triggers)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Recreate trigger functions using extensions.http_post
CREATE OR REPLACE FUNCTION public.trigger_push_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    PERFORM extensions.http_post(
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
    NULL;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_push_on_trade_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    PERFORM extensions.http_post(
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
    NULL;
  END;
  RETURN NEW;
END;
$$;
