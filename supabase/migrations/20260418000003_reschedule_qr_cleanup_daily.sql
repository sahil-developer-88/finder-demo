-- Reschedule QR token cleanup to run once daily at 4am UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('hourly-qr-token-cleanup');
    PERFORM cron.schedule(
      'daily-qr-token-cleanup',
      '0 4 * * *',
      'SELECT public.cleanup_expired_qr_tokens()'
    );
  END IF;
END$$;
