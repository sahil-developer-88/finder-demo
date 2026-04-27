-- ─── Immutable Ledger Entries ────────────────────────────────────────────────
-- Ledger entries must never be deleted or modified.
-- Corrections are made by inserting a reversal entry, not by editing/deleting.
-- These triggers fire at the DB level — they cannot be bypassed by RLS,
-- service_role, or any admin action.

-- ── Prevent DELETE ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_prevent_ledger_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'Ledger entries are immutable and cannot be deleted. '
    'Create a reversal entry instead. (entry id: %)', OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ledger_delete ON public.ledger_entries;
CREATE TRIGGER trg_prevent_ledger_delete
  BEFORE DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_ledger_delete();

-- ── Prevent UPDATE ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_prevent_ledger_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'Ledger entries are immutable and cannot be modified. '
    'Create a reversal entry instead. (entry id: %)', OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ledger_update ON public.ledger_entries;
CREATE TRIGGER trg_prevent_ledger_update
  BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_ledger_update();

-- ── Explicit RLS: deny DELETE and UPDATE for all roles ────────────────────────
-- RLS already blocks these by default (no permissive policy = deny),
-- but explicit restrictive policies make the intent clear in the policy list.
DROP POLICY IF EXISTS "Ledger entries cannot be deleted" ON public.ledger_entries;
CREATE POLICY "Ledger entries cannot be deleted"
  ON public.ledger_entries
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

DROP POLICY IF EXISTS "Ledger entries cannot be updated" ON public.ledger_entries;
CREATE POLICY "Ledger entries cannot be updated"
  ON public.ledger_entries
  AS RESTRICTIVE
  FOR UPDATE
  USING (false);
