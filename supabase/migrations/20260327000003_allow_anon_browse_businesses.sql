-- Allow anonymous users to browse active businesses on the home/discovery page.
-- Previously all anon access was blocked (FOR ALL TO anon USING (false)).
-- We keep write operations blocked but open SELECT for active listings only.

DROP POLICY IF EXISTS "Block anonymous access to businesses table" ON public.businesses;

-- Keep anon blocked from all writes
CREATE POLICY "Anonymous cannot write businesses"
ON public.businesses FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "Anonymous cannot update businesses"
ON public.businesses FOR UPDATE TO anon USING (false);

CREATE POLICY "Anonymous cannot delete businesses"
ON public.businesses FOR DELETE TO anon USING (false);

-- Allow anon to read active businesses only (needed for home page discovery)
CREATE POLICY "Anonymous can view active businesses"
ON public.businesses FOR SELECT TO anon
USING (status = 'active');
