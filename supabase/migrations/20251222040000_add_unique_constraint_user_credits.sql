-- Migration: Add unique constraint to user_credits.user_id
-- Purpose: Allow ON CONFLICT (user_id) in credit/debit functions
-- Each user should only have one credits record

-- Add unique constraint to user_id
ALTER TABLE user_credits
ADD CONSTRAINT user_credits_user_id_unique UNIQUE (user_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

-- Add comment
COMMENT ON CONSTRAINT user_credits_user_id_unique ON user_credits IS 'Ensures each user has only one credits record';
