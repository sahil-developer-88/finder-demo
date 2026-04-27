-- Set REPLICA IDENTITY FULL on tables used with Supabase Realtime
-- Required for row-level filters to work correctly on postgres_changes subscriptions

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.payment_requests REPLICA IDENTITY FULL;
