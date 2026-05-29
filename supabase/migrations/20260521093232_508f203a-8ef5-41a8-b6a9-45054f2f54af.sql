
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.api_consumers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL,
  api_key text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  rate_limit_per_minute integer NOT NULL DEFAULT 60,
  total_requests bigint NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  allowed_endpoints text[],
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_consumers_key ON public.api_consumers(api_key) WHERE is_active = true;
ALTER TABLE public.api_consumers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage api_consumers" ON public.api_consumers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "auth read api_consumers" ON public.api_consumers FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE TRIGGER trg_api_consumers_uat BEFORE UPDATE ON public.api_consumers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_api_consumers AFTER INSERT OR UPDATE OR DELETE ON public.api_consumers FOR EACH ROW EXECUTE FUNCTION public.audit_changes();

CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid REFERENCES public.api_consumers(id) ON DELETE SET NULL,
  consumer_name text,
  channel text,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer,
  ip_address text,
  user_agent text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  response_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_logs_consumer ON public.webhook_logs(consumer_id, created_at DESC);
CREATE INDEX idx_webhook_logs_date ON public.webhook_logs(created_at DESC);
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read webhook_logs" ON public.webhook_logs FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "system insert webhook_logs" ON public.webhook_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type text NOT NULL,
  target text NOT NULL,
  format text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  filters jsonb DEFAULT '{}'::jsonb,
  total_rows integer DEFAULT 0,
  file_url text,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_export_jobs_date ON public.export_jobs(created_at DESC);
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read export_jobs" ON public.export_jobs FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "ed ins export_jobs" ON public.export_jobs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'editor'::app_role) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "ed upd export_jobs" ON public.export_jobs FOR UPDATE TO authenticated USING (has_role(auth.uid(),'editor'::app_role) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "adm del export_jobs" ON public.export_jobs FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
