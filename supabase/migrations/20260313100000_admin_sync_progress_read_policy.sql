-- Allow admins to read all product sync progress records
CREATE POLICY "Admins can read all sync progress"
  ON public.product_sync_progress FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
