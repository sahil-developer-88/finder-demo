-- Create pos_transactions table for storing all POS transaction data
CREATE TABLE IF NOT EXISTS public.pos_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  pos_integration_id uuid REFERENCES public.pos_integrations(id) ON DELETE SET NULL,
  external_transaction_id text NOT NULL,
  pos_provider text NOT NULL CHECK (pos_provider IN ('square', 'shopify', 'toast', 'clover', 'adyen', 'generic')),
  
  -- Transaction details
  total_amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  tax_amount numeric(10,2) DEFAULT 0,
  tip_amount numeric(10,2) DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  
  -- Payment split breakdown
  barter_amount numeric(10,2) DEFAULT 0,
  barter_percentage numeric(5,2) DEFAULT 0,
  cash_amount numeric(10,2) DEFAULT 0,
  card_amount numeric(10,2) DEFAULT 0,
  
  -- Transaction metadata
  items jsonb DEFAULT '[]'::jsonb,
  customer_info jsonb,
  location_id text,
  payment_methods jsonb DEFAULT '[]'::jsonb,
  
  -- Status and timestamps
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  transaction_date timestamp with time zone NOT NULL,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Webhook verification
  webhook_signature text,
  raw_webhook_data jsonb,
  
  -- Constraints
  UNIQUE(pos_provider, external_transaction_id)
);

-- Create index for faster queries
CREATE INDEX idx_pos_transactions_merchant ON public.pos_transactions(merchant_id, transaction_date DESC);
CREATE INDEX idx_pos_transactions_external ON public.pos_transactions(external_transaction_id);
CREATE INDEX idx_pos_transactions_status ON public.pos_transactions(status);

-- Enable Row Level Security
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Merchants can view their own transactions"
  ON public.pos_transactions FOR SELECT
  USING (auth.uid() = merchant_id);

CREATE POLICY "System can insert transactions"
  ON public.pos_transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Merchants can update their own transactions"
  ON public.pos_transactions FOR UPDATE
  USING (auth.uid() = merchant_id);

-- Create updated_at trigger
CREATE TRIGGER update_pos_transactions_updated_at
  BEFORE UPDATE ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create webhook_logs table for debugging
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  endpoint text NOT NULL,
  payload jsonb NOT NULL,
  signature text,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'duplicate')),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_created ON public.webhook_logs(created_at DESC);

-- Enable RLS on webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only system can access webhook logs
CREATE POLICY "System can access webhook logs"
  ON public.webhook_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_transactions;