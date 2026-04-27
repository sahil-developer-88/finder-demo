-- Allow authenticated users to insert notifications (e.g. CR/DR after payment)
-- Previously only SELECT and UPDATE policies existed; INSERT was silently blocked by RLS.
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);
