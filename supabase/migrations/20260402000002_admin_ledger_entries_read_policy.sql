-- Allow admins to read all ledger entries across all users
CREATE POLICY "Admins can read all ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
