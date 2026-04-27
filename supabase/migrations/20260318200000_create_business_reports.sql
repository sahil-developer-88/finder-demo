-- Community flagging / user reports table
-- Users can report a business; admins review and act on reports

CREATE TABLE IF NOT EXISTS public.business_reports (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reason               TEXT NOT NULL CHECK (reason IN ('didnt_deliver', 'misleading', 'scam_fraud', 'other')),
  details              TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_reports ENABLE ROW LEVEL SECURITY;

-- Users can submit reports
CREATE POLICY "Users can insert reports"
  ON public.business_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Users can read their own reports
CREATE POLICY "Users can read own reports"
  ON public.business_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- Admins can read all reports
CREATE POLICY "Admins can read all reports"
  ON public.business_reports FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- Admins can update report status (reviewed / dismissed)
CREATE POLICY "Admins can update reports"
  ON public.business_reports FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE INDEX business_reports_status_idx ON public.business_reports (status);
CREATE INDEX business_reports_business_idx ON public.business_reports (reported_business_id);
