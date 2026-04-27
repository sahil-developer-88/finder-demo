-- Disputes & Mediation System

CREATE TABLE IF NOT EXISTS public.disputes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id        UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  reporter_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'under_review', 'resolved', 'escalated')),
  dispute_type          TEXT NOT NULL DEFAULT 'other'
                          CHECK (dispute_type IN ('non_delivery', 'quality', 'value_dispute', 'fraud', 'other')),
  description           TEXT NOT NULL DEFAULT '',
  evidence_urls         TEXT[] NOT NULL DEFAULT '{}',
  admin_notes           TEXT,
  arbitration_outcome   TEXT
                          CHECK (arbitration_outcome IN ('reporter_wins', 'reported_wins', 'split', 'dismissed')),
  partial_refund_amount NUMERIC(10,2),
  resolved_at           TIMESTAMPTZ,
  resolved_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_reporter_id    ON public.disputes(reporter_id);
CREATE INDEX IF NOT EXISTS idx_disputes_reported_id    ON public.disputes(reported_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status         ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_transaction_id ON public.disputes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_created_at     ON public.disputes(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_disputes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disputes_updated_at ON public.disputes;
CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_disputes_updated_at();

-- Evidence table
CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_type   TEXT NOT NULL DEFAULT '',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute_id  ON public.dispute_evidence(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_uploaded_by ON public.dispute_evidence(uploaded_by);

-- RLS: disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all disputes"
  ON public.disputes FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can insert disputes"
  ON public.disputes FOR INSERT
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can update disputes"
  ON public.disputes FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Parties can read own disputes"
  ON public.disputes FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR auth.uid() = reported_id);

CREATE POLICY "Authenticated users can file a dispute"
  ON public.disputes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- RLS: dispute_evidence
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all evidence"
  ON public.dispute_evidence FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can insert evidence"
  ON public.dispute_evidence FOR INSERT
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can delete evidence"
  ON public.dispute_evidence FOR DELETE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Parties can read own dispute evidence"
  ON public.dispute_evidence FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_id
        AND (d.reporter_id = auth.uid() OR d.reported_id = auth.uid())
    )
  );

CREATE POLICY "Parties can upload evidence for own disputes"
  ON public.dispute_evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_id
        AND (d.reporter_id = auth.uid() OR d.reported_id = auth.uid())
        AND d.status IN ('open', 'under_review')
    )
  );
