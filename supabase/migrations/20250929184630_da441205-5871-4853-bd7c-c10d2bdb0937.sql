-- Create user_credits table for tracking credit balances
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  available_credits NUMERIC NOT NULL DEFAULT 0,
  earned_credits NUMERIC NOT NULL DEFAULT 0,
  spent_credits NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table for tracking barter transactions
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  points_amount NUMERIC NOT NULL,
  service_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_type TEXT NOT NULL DEFAULT 'barter',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create business_listings table (alias/view for businesses)
CREATE TABLE public.business_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  services_offered TEXT[] NOT NULL DEFAULT '{}',
  wanting_in_return TEXT[] NOT NULL DEFAULT '{}',
  estimated_value NUMERIC,
  location TEXT NOT NULL,
  contact_method TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create w9_tax_info table (alias for tax_info)
CREATE TABLE public.w9_tax_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  legal_name TEXT NOT NULL,
  business_name TEXT,
  business_type TEXT NOT NULL,
  other_business_type TEXT,
  tax_id_type TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  account_number TEXT,
  exempt_from_backup_withholding BOOLEAN DEFAULT false,
  certification_agreed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create POS integrations table
CREATE TABLE public.pos_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  merchant_id TEXT,
  store_id TEXT,
  config JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.w9_tax_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_credits
CREATE POLICY "Users can view their own credits"
ON public.user_credits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credits"
ON public.user_credits FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits"
ON public.user_credits FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view their transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update their transactions"
ON public.transactions FOR UPDATE
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- RLS Policies for business_listings
CREATE POLICY "Users can view all business listings"
ON public.business_listings FOR SELECT
USING (true);

CREATE POLICY "Users can create their own business listings"
ON public.business_listings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business listings"
ON public.business_listings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business listings"
ON public.business_listings FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for w9_tax_info
CREATE POLICY "Users can view their own w9 info"
ON public.w9_tax_info FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own w9 info"
ON public.w9_tax_info FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own w9 info"
ON public.w9_tax_info FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for pos_integrations
CREATE POLICY "Users can view their own POS integrations"
ON public.pos_integrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own POS integrations"
ON public.pos_integrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own POS integrations"
ON public.pos_integrations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own POS integrations"
ON public.pos_integrations FOR DELETE
USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_business_listings_updated_at
BEFORE UPDATE ON public.business_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_w9_tax_info_updated_at
BEFORE UPDATE ON public.w9_tax_info
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_integrations_updated_at
BEFORE UPDATE ON public.pos_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();