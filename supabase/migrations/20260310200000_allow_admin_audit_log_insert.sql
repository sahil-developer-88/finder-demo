-- Allow admin users to insert audit logs from the client
-- Admins need this to record credit adjustments, suspensions, etc.
CREATE POLICY "Admins can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
