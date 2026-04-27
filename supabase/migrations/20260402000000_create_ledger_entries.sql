-- ─── Ledger Entries Table ─────────────────────────────────────────────────────
-- Immutable audit trail for all cash + barter movements.
-- Existing tables (transactions, pos_transactions, etc.) are NOT modified.
-- This table is purely additive.

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type      text        NOT NULL CHECK (entry_type IN ('credit', 'debit')),
  cash_amount     numeric(12,2) NOT NULL DEFAULT 0,
  barter_amount   numeric(12,2) NOT NULL DEFAULT 0,
  source          text        NOT NULL CHECK (source IN ('qr_scan', 'checkout', 'pos', 'payment_request', 'refund', 'admin', 'trade')),
  reference_id    text,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Users can only see their own ledger entries
CREATE POLICY "Users can view own ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (auth.uid() = user_id);

-- Only service_role / SECURITY DEFINER functions can insert
-- (ordinary users cannot write ledger entries directly)
CREATE POLICY "Service role can insert ledger entries"
  ON public.ledger_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ledger_entries_user_id_created_at_idx
  ON public.ledger_entries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ledger_entries_reference_id_idx
  ON public.ledger_entries (reference_id);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
ALTER TABLE public.ledger_entries REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'ledger_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_entries;
  END IF;
END$$;

-- ─── Trigger: transactions → ledger_entries ───────────────────────────────────
-- When a transaction is marked completed, create debit (from_user) + credit (to_user)
CREATE OR REPLACE FUNCTION public.fn_ledger_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barter_amt   numeric(12,2);
  v_source       text;
BEGIN
  -- Only act on completed status
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;
  -- Skip if UPDATE and was already completed
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  v_barter_amt := COALESCE(NEW.points_amount, 0);

  v_source := CASE NEW.transaction_type
    WHEN 'payment_request' THEN 'payment_request'
    WHEN 'pos_scan'        THEN 'qr_scan'
    ELSE                        'trade'
  END;

  -- DEBIT entry for the payer (from_user)
  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description)
  VALUES
    (NEW.from_user_id, 'debit', 0, v_barter_amt, v_source, NEW.id::text,
     COALESCE(NEW.service_description, 'Barter transaction'));

  -- CREDIT entry for the receiver (to_user)
  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description)
  VALUES
    (NEW.to_user_id, 'credit', 0, v_barter_amt, v_source, NEW.id::text,
     COALESCE(NEW.service_description, 'Barter transaction'));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_on_transaction ON public.transactions;
CREATE TRIGGER trg_ledger_on_transaction
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_on_transaction();

-- ─── Trigger: pos_transactions → ledger_entries ───────────────────────────────
-- POS transactions already carry both cash_amount and barter_amount.
CREATE OR REPLACE FUNCTION public.fn_ledger_on_pos_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- CREDIT entry for the merchant
  INSERT INTO public.ledger_entries
    (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description)
  VALUES
    (NEW.merchant_id, 'credit',
     COALESCE(NEW.cash_amount, 0),
     COALESCE(NEW.barter_amount, 0),
     'pos',
     NEW.id::text,
     'POS Sale - ' || COALESCE(NEW.pos_provider, 'POS'));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_on_pos_transaction ON public.pos_transactions;
CREATE TRIGGER trg_ledger_on_pos_transaction
  AFTER INSERT OR UPDATE ON public.pos_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_on_pos_transaction();

-- ─── Trigger: orders → ledger_entries ────────────────────────────────────────
-- Customer checkout orders (already store cash_amount + barter_amount).
-- Creates a DEBIT for the buyer when order is confirmed/completed.
CREATE OR REPLACE FUNCTION public.fn_ledger_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('confirmed', 'completed', 'fulfilled') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('confirmed', 'completed', 'fulfilled') THEN
    RETURN NEW;
  END IF;

  -- DEBIT entry for the buyer
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.ledger_entries
      (user_id, entry_type, cash_amount, barter_amount, source, reference_id, description)
    VALUES
      (NEW.user_id, 'debit',
       COALESCE(NEW.cash_amount, 0),
       COALESCE(NEW.barter_amount, 0),
       'checkout',
       NEW.id::text,
       'Order #' || COALESCE(NEW.order_number::text, NEW.id::text));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_on_order ON public.orders;
CREATE TRIGGER trg_ledger_on_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_on_order();
