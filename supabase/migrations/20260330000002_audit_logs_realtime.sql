-- Enable Realtime on audit_logs so admin panel Audit Trail updates live
-- Required: REPLICA IDENTITY FULL + add to supabase_realtime publication

ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;

-- Add to realtime publication (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
