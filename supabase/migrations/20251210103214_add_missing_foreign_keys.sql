-- M1.1: Add Missing Foreign Key Constraints
-- This migration adds foreign key constraints that were missing from earlier migrations
-- Ensures referential integrity for user_id columns across all tables

-- ============================================================================
-- STEP 1: Add foreign key to user_credits.user_id
-- ============================================================================

-- Add FK constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_credits_user_id_fkey'
    AND table_name = 'user_credits'
  ) THEN
    ALTER TABLE public.user_credits
    ADD CONSTRAINT user_credits_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add foreign keys to transactions table
-- ============================================================================

-- Add FK for from_user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transactions_from_user_id_fkey'
    AND table_name = 'transactions'
  ) THEN
    ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_from_user_id_fkey
    FOREIGN KEY (from_user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK for to_user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transactions_to_user_id_fkey'
    AND table_name = 'transactions'
  ) THEN
    ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_to_user_id_fkey
    FOREIGN KEY (to_user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add foreign key to pos_integrations.user_id
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pos_integrations_user_id_fkey'
    AND table_name = 'pos_integrations'
  ) THEN
    ALTER TABLE public.pos_integrations
    ADD CONSTRAINT pos_integrations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add comments for documentation
-- ============================================================================

COMMENT ON CONSTRAINT user_credits_user_id_fkey ON public.user_credits IS 'Ensures user_id references a valid user in auth.users';
COMMENT ON CONSTRAINT transactions_from_user_id_fkey ON public.transactions IS 'Ensures from_user_id references a valid user in auth.users';
COMMENT ON CONSTRAINT transactions_to_user_id_fkey ON public.transactions IS 'Ensures to_user_id references a valid user in auth.users';
COMMENT ON CONSTRAINT pos_integrations_user_id_fkey ON public.pos_integrations IS 'Ensures user_id references a valid user in auth.users';
