
-- 1. api_consumers: drop broad SELECT (admins-only via existing ALL policy)
DROP POLICY IF EXISTS "auth read api_consumers" ON public.api_consumers;

-- 2. integration_configs: admin-only SELECT
DROP POLICY IF EXISTS "auth read integration_configs" ON public.integration_configs;
CREATE POLICY "admins read integration_configs" ON public.integration_configs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. api_integrations: admin-only SELECT
DROP POLICY IF EXISTS "auth read api_integrations" ON public.api_integrations;
CREATE POLICY "admins read api_integrations" ON public.api_integrations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. manufacturing_orders: editors/admins only
DROP POLICY IF EXISTS "auth read manufacturing_orders" ON public.manufacturing_orders;
CREATE POLICY "ed read manufacturing_orders" ON public.manufacturing_orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

-- 5. quote_requests: editors/admins only
DROP POLICY IF EXISTS "auth read quote_requests" ON public.quote_requests;
CREATE POLICY "ed read quote_requests" ON public.quote_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

-- 6. suppliers: editors/admins only
DROP POLICY IF EXISTS "auth read suppliers" ON public.suppliers;
CREATE POLICY "ed read suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

-- 7. Remove permissive INSERT/UPDATE on audit/log/agent tables; writes go through service role
DROP POLICY IF EXISTS "system insert audit" ON public.audit_logs;
DROP POLICY IF EXISTS "system insert webhook_logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "system insert agent_actions" ON public.agent_actions;
DROP POLICY IF EXISTS "system insert agent_decisions" ON public.agent_decisions;
DROP POLICY IF EXISTS "system insert agent_sessions" ON public.agent_sessions;
DROP POLICY IF EXISTS "system upd agent_sessions" ON public.agent_sessions;

-- 8. image-prod bucket policies (editors/admins upload+read, admins delete)
DROP POLICY IF EXISTS "ed read image-prod" ON storage.objects;
DROP POLICY IF EXISTS "ed insert image-prod" ON storage.objects;
DROP POLICY IF EXISTS "ed update image-prod" ON storage.objects;
DROP POLICY IF EXISTS "adm delete image-prod" ON storage.objects;

CREATE POLICY "ed read image-prod" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'image-prod' AND (public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "ed insert image-prod" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'image-prod' AND (public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "ed update image-prod" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'image-prod' AND (public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "adm delete image-prod" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'image-prod' AND public.has_role(auth.uid(),'admin'));

-- 9. Pin search_path for next_az_code
CREATE OR REPLACE FUNCTION public.next_az_code(_type text, _category text DEFAULT 'GEN'::text, _family text DEFAULT 'GEN'::text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(az_code,'.*-',''),'')::int),0)+1
    INTO n FROM public.products WHERE az_code LIKE 'AZ-'||_type||'-'||_category||'-'||_family||'-%';
  RETURN 'AZ-'||_type||'-'||_category||'-'||_family||'-'||lpad(n::text,4,'0');
END $function$;
