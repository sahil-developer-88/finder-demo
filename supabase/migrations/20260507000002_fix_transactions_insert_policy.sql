-- Fix: recipient couldn't insert transaction record when accepting a barter send.
-- Old policy only allowed from_user_id = auth.uid(), but the recipient (to_user_id)
-- is the one calling acceptSendRequest and creating the transaction row.
DROP POLICY IF EXISTS "Users can create transactions" ON public.transactions;

CREATE POLICY "Users can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);
