-- Schedule QR token cleanup every hour via pg_cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'hourly-qr-token-cleanup',
      '0 * * * *',
      'SELECT public.cleanup_expired_qr_tokens()'
    );
  END IF;
END$$;
