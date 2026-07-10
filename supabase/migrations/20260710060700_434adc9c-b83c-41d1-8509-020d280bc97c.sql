
-- Harden supcloud_keepalive: remove anon/authenticated read; keepalive uses service role
DROP POLICY IF EXISTS supcloud_keepalive_read ON public.supcloud_keepalive;
REVOKE SELECT ON public.supcloud_keepalive FROM anon, authenticated;
CREATE POLICY "keepalive service only" ON public.supcloud_keepalive
  FOR SELECT TO service_role USING (true);

-- Harden quote_requests: explicit deny for anon via restrictive policy
CREATE POLICY "quote_requests deny anon" ON public.quote_requests
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- Harden supplier_secrets: split ALL into per-command admin policies for clarity + restrictive anon deny
DROP POLICY IF EXISTS "admin manage supplier_secrets" ON public.supplier_secrets;
CREATE POLICY "supplier_secrets admin select" ON public.supplier_secrets
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "supplier_secrets admin insert" ON public.supplier_secrets
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "supplier_secrets admin update" ON public.supplier_secrets
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "supplier_secrets admin delete" ON public.supplier_secrets
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "supplier_secrets deny anon" ON public.supplier_secrets
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
REVOKE ALL ON public.supplier_secrets FROM anon;
REVOKE ALL ON public.supcloud_keepalive FROM anon;
