DROP POLICY IF EXISTS "staff insert chatbot_interactions" ON public.chatbot_interactions;
DROP POLICY IF EXISTS "staff insert notifs" ON public.notifications;
-- Inserts are now restricted to service_role (bypasses RLS). No authenticated INSERT policy exists,
-- so authenticated users cannot spoof notifications or chatbot interaction logs.