
-- Approval workflow tables
CREATE TYPE approval_status AS ENUM ('pending','approved','rejected','changes_requested','cancelled');
CREATE TYPE approval_stage AS ENUM ('content_review','manager_review','final_approval');

CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,            -- 'product' | 'price'
  entity_id uuid NOT NULL,
  title text NOT NULL,
  current_stage approval_stage NOT NULL DEFAULT 'content_review',
  status approval_status NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',  -- low|normal|high|urgent
  notes text,
  requested_by uuid,
  assigned_to uuid,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_approvals_status ON public.approvals(status);
CREATE INDEX idx_approvals_entity ON public.approvals(entity_type, entity_id);
CREATE INDEX idx_approvals_assignee ON public.approvals(assigned_to);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read approvals" ON public.approvals
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "ed ins approvals" ON public.approvals
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'editor') OR has_role(auth.uid(),'admin'));
CREATE POLICY "ed upd approvals" ON public.approvals
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'editor') OR has_role(auth.uid(),'admin'));
CREATE POLICY "adm del approvals" ON public.approvals
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- History trail
CREATE TABLE public.approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  stage approval_stage NOT NULL,
  action text NOT NULL,                 -- submitted|approved|rejected|changes_requested|reassigned|cancelled|commented
  comment text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_history_approval ON public.approval_history(approval_id);

ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read approval_history" ON public.approval_history
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "ed ins approval_history" ON public.approval_history
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'editor') OR has_role(auth.uid(),'admin'));

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  kind text NOT NULL DEFAULT 'info',    -- info|approval_request|approval_result|mention
  is_read boolean NOT NULL DEFAULT false,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notifs" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "system insert notifs" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "users update own notifs" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER set_approvals_updated_at
  BEFORE UPDATE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
