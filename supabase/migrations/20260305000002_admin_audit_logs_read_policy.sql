-- Allow admins to read all audit_logs for the tax audit trail
CREATE POLICY "Admins can read all audit logs"
ON audit_logs FOR SELECT
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
