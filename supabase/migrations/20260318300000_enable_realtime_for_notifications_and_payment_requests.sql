-- Enable Supabase Realtime for payment_requests table
-- notifications is already in the publication

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'payment_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE payment_requests;
  END IF;
END $$;
