-- Allow admins to read all webhook_logs for system alerts
CREATE POLICY "Admins can read all webhook logs"
ON webhook_logs FOR SELECT
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
