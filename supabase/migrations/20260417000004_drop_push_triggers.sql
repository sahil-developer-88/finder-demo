-- Drop push notification triggers (pg_net not available on this project)
DROP TRIGGER IF EXISTS push_on_new_message ON public.messages;
DROP TRIGGER IF EXISTS push_on_new_trade_request ON public.trade_requests;
DROP FUNCTION IF EXISTS public.trigger_push_on_message();
DROP FUNCTION IF EXISTS public.trigger_push_on_trade_request();
