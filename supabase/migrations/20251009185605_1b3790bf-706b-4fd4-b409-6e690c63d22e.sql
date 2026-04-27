-- Create OAuth state management table for CSRF protection
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  state_token text UNIQUE NOT NULL,
  provider text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '10 minutes')
);

-- Enable RLS on oauth_states
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for oauth_states
CREATE POLICY "Users can create their own OAuth states"
  ON public.oauth_states
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own OAuth states"
  ON public.oauth_states
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can delete expired OAuth states"
  ON public.oauth_states
  FOR DELETE
  TO authenticated
  USING (expires_at < now());

-- Add OAuth-related columns to pos_integrations
ALTER TABLE public.pos_integrations 
  ADD COLUMN IF NOT EXISTS auth_method text DEFAULT 'oauth',
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS scopes text[];

-- Create index for faster OAuth state lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_state_token ON public.oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON public.oauth_states(expires_at);

-- Add comment for documentation
COMMENT ON TABLE public.oauth_states IS 'Stores temporary OAuth state tokens for CSRF protection during POS provider OAuth flows';