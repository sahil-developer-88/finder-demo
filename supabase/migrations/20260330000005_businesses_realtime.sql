-- Enable Realtime on businesses so admin listings update live
ALTER TABLE public.businesses REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
