-- Enable Supabase Realtime for all tables that have live subscriptions in the app
-- Uses DO block to safely skip tables already in the publication
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'transactions',
    'payment_requests',
    'pos_transactions',
    'pos_integrations',
    'user_credits',
    'notifications',
    'trade_requests'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    END IF;
  END LOOP;
END $$;
