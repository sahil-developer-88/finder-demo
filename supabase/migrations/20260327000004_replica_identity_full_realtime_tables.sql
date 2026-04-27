-- REPLICA IDENTITY FULL is required for row-level filters on UPDATE/DELETE events
-- in Supabase Realtime postgres_changes subscriptions.
-- Without it, only INSERT events match filters correctly.

ALTER TABLE public.user_credits    REPLICA IDENTITY FULL;
ALTER TABLE public.transactions    REPLICA IDENTITY FULL;
ALTER TABLE public.trade_requests  REPLICA IDENTITY FULL;
ALTER TABLE public.pos_integrations REPLICA IDENTITY FULL;
