-- M1.1: Add Missing Indexes for Performance Optimization
-- This migration adds indexes that were missing from earlier migrations
-- Improves query performance for common access patterns

-- ============================================================================
-- INDEXES FOR user_credits TABLE
-- ============================================================================

-- Index for user lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id
  ON public.user_credits(user_id);

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_user_credits_created_at
  ON public.user_credits(created_at DESC);

-- Composite index for user + available credits (for balance checks)
CREATE INDEX IF NOT EXISTS idx_user_credits_user_available
  ON public.user_credits(user_id, available_credits DESC);

-- ============================================================================
-- INDEXES FOR transactions TABLE
-- ============================================================================

-- Index for sender lookups
CREATE INDEX IF NOT EXISTS idx_transactions_from_user_id
  ON public.transactions(from_user_id);

-- Index for recipient lookups
CREATE INDEX IF NOT EXISTS idx_transactions_to_user_id
  ON public.transactions(to_user_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON public.transactions(status);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON public.transactions(created_at DESC);

-- Index for transaction type filtering
CREATE INDEX IF NOT EXISTS idx_transactions_type
  ON public.transactions(transaction_type);

-- Composite index for user transaction history (common query)
CREATE INDEX IF NOT EXISTS idx_transactions_from_user_date
  ON public.transactions(from_user_id, created_at DESC);

-- Composite index for received transactions
CREATE INDEX IF NOT EXISTS idx_transactions_to_user_date
  ON public.transactions(to_user_id, created_at DESC);

-- Composite index for status + date filtering
CREATE INDEX IF NOT EXISTS idx_transactions_status_date
  ON public.transactions(status, created_at DESC);

-- ============================================================================
-- INDEXES FOR pos_integrations TABLE
-- ============================================================================

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_pos_integrations_user_id
  ON public.pos_integrations(user_id);

-- Index for provider filtering
CREATE INDEX IF NOT EXISTS idx_pos_integrations_provider
  ON public.pos_integrations(provider);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_pos_integrations_status
  ON public.pos_integrations(status);

-- Index for last sync tracking
CREATE INDEX IF NOT EXISTS idx_pos_integrations_last_sync
  ON public.pos_integrations(last_sync_at DESC);

-- Composite index for active integrations by provider
CREATE INDEX IF NOT EXISTS idx_pos_integrations_user_provider
  ON public.pos_integrations(user_id, provider);

-- Composite index for active integrations
CREATE INDEX IF NOT EXISTS idx_pos_integrations_user_status
  ON public.pos_integrations(user_id, status)
  WHERE status = 'active';

-- ============================================================================
-- INDEXES FOR businesses TABLE (if missing)
-- ============================================================================

-- Ensure businesses table has barter_percentage index
CREATE INDEX IF NOT EXISTS idx_businesses_barter_percentage
  ON public.businesses(barter_percentage)
  WHERE barter_percentage IS NOT NULL;

-- Index for status + category filtering (common listing queries)
CREATE INDEX IF NOT EXISTS idx_businesses_status_category
  ON public.businesses(status, category)
  WHERE status = 'active';

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_user_credits_user_id IS 'Speeds up user credit balance lookups';
COMMENT ON INDEX idx_user_credits_user_available IS 'Optimizes available credit checks';
COMMENT ON INDEX idx_transactions_from_user_date IS 'Optimizes user transaction history queries';
COMMENT ON INDEX idx_transactions_to_user_date IS 'Optimizes received transaction queries';
COMMENT ON INDEX idx_pos_integrations_user_provider IS 'Optimizes POS integration lookups by user and provider';
COMMENT ON INDEX idx_pos_integrations_user_status IS 'Partial index for active integrations only';
COMMENT ON INDEX idx_businesses_status_category IS 'Partial index for active business listings';
