-- Fix audit_logs RLS so admin can receive Realtime events
-- Previous policy used user_metadata but app stores role in app_metadata

DROP POLICY IF EXISTS "Admins can read all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;

CREATE POLICY "Admins can read all audit logs"
ON public.audit_logs FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
