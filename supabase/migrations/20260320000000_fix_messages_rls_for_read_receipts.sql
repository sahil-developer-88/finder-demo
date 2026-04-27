-- Allow recipients to mark messages as read
-- The existing UPDATE policy only allows sender_id = auth.uid()
-- But marking read requires the recipient (auth.uid() = recipient_id) to update read=true

CREATE POLICY "Recipients can mark messages as read"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);
