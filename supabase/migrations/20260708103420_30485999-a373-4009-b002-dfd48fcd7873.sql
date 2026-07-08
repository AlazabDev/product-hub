
-- 1. Notifications: restrict INSERT to staff (admin/editor)
DROP POLICY IF EXISTS "system insert notifs" ON public.notifications;
CREATE POLICY "staff insert notifs" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'editor'::app_role)
  );

-- 2. Chatbot interactions: restrict INSERT to staff (service role bypasses RLS)
DROP POLICY IF EXISTS "system insert chatbot_interactions" ON public.chatbot_interactions;
CREATE POLICY "staff insert chatbot_interactions" ON public.chatbot_interactions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'editor'::app_role)
  );

-- 3. Agent tables: add admin-only INSERT/DELETE policies (service role bypasses RLS)
CREATE POLICY "admins insert agent_actions" ON public.agent_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins delete agent_actions" ON public.agent_actions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins insert agent_decisions" ON public.agent_decisions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins delete agent_decisions" ON public.agent_decisions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins insert agent_sessions" ON public.agent_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins delete agent_sessions" ON public.agent_sessions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
--    Keep has_role and is_authorized (used inside RLS policies).
REVOKE EXECUTE ON FUNCTION public.approve_quote_for_manufacturing(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_mo_status_transition() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_quote_status_transition() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_requisition_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_price_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_az_code(text, text, text) FROM PUBLIC, anon, authenticated;

-- 5. Move pg_trgm out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
-- Ensure roles see the extensions schema without app changes
ALTER ROLE anon SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role SET search_path = public, extensions;

-- 6. Public storage bucket: drop broad public SELECT to prevent listing.
--    Public files remain reachable via their public object URLs (CDN bypasses RLS).
DROP POLICY IF EXISTS "public read product-assets" ON storage.objects;
