-- Add POS setup preference tracking to profiles table
-- This tracks user's decision about POS integration during onboarding

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pos_setup_preference TEXT DEFAULT 'pending'
CHECK (pos_setup_preference IN ('pending', 'later', 'not_needed', 'completed'));

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.pos_setup_preference IS
'Tracks user decision about POS setup during onboarding:
- pending: User hasnt seen POS setup option yet (default for new users)
- later: User selected "I will connect later" (show reminder in dashboard)
- not_needed: User selected "I dont have a POS system" (never show reminder)
- completed: User successfully connected POS via OAuth (no reminder needed)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_pos_setup_preference
ON public.profiles(pos_setup_preference);
