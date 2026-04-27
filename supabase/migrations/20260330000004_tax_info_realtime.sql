-- Enable Realtime on tax_info so admin audit trail updates live
ALTER TABLE public.tax_info REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tax_info;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
