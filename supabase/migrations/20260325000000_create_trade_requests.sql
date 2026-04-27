CREATE TABLE trade_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  merchant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  barter_percentage INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create trade requests"
  ON trade_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view their own trade requests"
  ON trade_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = merchant_id);

CREATE POLICY "Merchants can update trade requests sent to them"
  ON trade_requests FOR UPDATE
  USING (auth.uid() = merchant_id);
