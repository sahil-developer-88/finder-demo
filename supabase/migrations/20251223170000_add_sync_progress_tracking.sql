-- Migration: Product Sync Progress Tracking
-- Created: 2025-12-23
-- Purpose: Track real-time progress of product sync operations for better UX

-- Create product sync progress table
CREATE TABLE IF NOT EXISTS product_sync_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_integration_id UUID REFERENCES pos_integrations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Progress metrics
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  synced_items INTEGER NOT NULL DEFAULT 0,
  skipped_items INTEGER NOT NULL DEFAULT 0,
  error_items INTEGER NOT NULL DEFAULT 0,

  -- Current state
  current_item_name TEXT,
  current_step TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'in_progress',

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Error tracking
  error TEXT,

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled'))
);

-- Create indexes for performance
CREATE INDEX idx_sync_progress_integration ON product_sync_progress(pos_integration_id, started_at DESC);
CREATE INDEX idx_sync_progress_user ON product_sync_progress(user_id, started_at DESC);
CREATE INDEX idx_sync_progress_status ON product_sync_progress(status, started_at DESC);

-- Enable Row Level Security
ALTER TABLE product_sync_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sync progress"
ON product_sync_progress FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync progress"
ON product_sync_progress FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all sync progress"
ON product_sync_progress FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant access
GRANT SELECT, INSERT ON product_sync_progress TO authenticated;
GRANT ALL ON product_sync_progress TO service_role;

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE product_sync_progress;

-- Comments
COMMENT ON TABLE product_sync_progress IS 'Tracks real-time progress of product sync operations for UX feedback';
COMMENT ON COLUMN product_sync_progress.total_items IS 'Total number of items to sync';
COMMENT ON COLUMN product_sync_progress.processed_items IS 'Number of items processed so far';
COMMENT ON COLUMN product_sync_progress.synced_items IS 'Number of items successfully synced';
COMMENT ON COLUMN product_sync_progress.skipped_items IS 'Number of items skipped due to errors';
COMMENT ON COLUMN product_sync_progress.current_step IS 'Current operation (e.g., "Fetching products", "Mapping categories", "Syncing items")';
