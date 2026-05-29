
-- ============================================================
-- Production Stabilization Batch 1: Schema Foundation
-- Creates all tables referenced in code but missing from types.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. product_requests (internal product request form)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  request_type  TEXT NOT NULL,           -- new_product|new_service|bulk_order|special_request|product|service|material|pricing_inquiry|supplier_connection
  priority      TEXT NOT NULL DEFAULT 'medium',
  category      TEXT,
  quantity      INTEGER,
  estimated_budget NUMERIC,
  status        TEXT NOT NULL DEFAULT 'open',  -- open|in_review|approved|rejected|closed
  notes         TEXT,
  created_by    UUID,
  assigned_to   UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_requests TO authenticated;
GRANT ALL ON public.product_requests TO service_role;
ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read product_requests" ON public.product_requests
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "ed ins product_requests" ON public.product_requests
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ed upd product_requests" ON public.product_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "adm del product_requests" ON public.product_requests
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_product_requests_updated
  BEFORE UPDATE ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 2. quote_requests (chatbot quote intake)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id           TEXT NOT NULL UNIQUE,
  chatbot_session_id   TEXT,
  customer_id          TEXT,
  customer_name        TEXT,
  customer_phone       TEXT,
  customer_email       TEXT,
  design_file_url      TEXT,
  design_file_type     TEXT,
  design_data          JSONB,
  design_preview_url   TEXT,
  dimensions           JSONB,
  materials            JSONB,
  components           JSONB,
  finishes             JSONB,
  accessories          JSONB,
  pricing_breakdown    JSONB,
  materials_cost       NUMERIC,
  labor_cost           NUMERIC,
  overhead_cost        NUMERIC,
  profit_margin        NUMERIC,
  total_cost           NUMERIC,
  selling_price        NUMERIC,
  currency             TEXT DEFAULT 'SAR',
  status               TEXT NOT NULL DEFAULT 'quoted',
    -- quoted|accepted|accepted_pending_internal_approval|rejected|expired|internal_rejected|approved_for_manufacturing
  quoted_at            TIMESTAMPTZ,
  quote_valid_until    TIMESTAMPTZ,
  customer_notes       TEXT,
  special_requirements JSONB,
  customer_response    TEXT,
  customer_response_at TIMESTAMPTZ,
  rejection_reason     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_requests TO authenticated;
GRANT ALL ON public.quote_requests TO service_role;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read quote_requests" ON public.quote_requests
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "ed ins quote_requests" ON public.quote_requests
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ed upd quote_requests" ON public.quote_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "adm del quote_requests" ON public.quote_requests
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_quote_requests_updated
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 3. manufacturing_orders
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manufacturing_orders (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number               TEXT NOT NULL UNIQUE,
  quote_request_id           UUID REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  approval_id                UUID,
  customer_id                TEXT,
  customer_name              TEXT,
  customer_phone             TEXT,
  delivery_address           TEXT,
  design_data                JSONB,
  specifications             JSONB,
  quantity                   NUMERIC NOT NULL DEFAULT 1,
  unit_price                 NUMERIC,
  total_price                NUMERIC,
  discount_percent           NUMERIC DEFAULT 0,
  discount_amount            NUMERIC DEFAULT 0,
  final_price                NUMERIC,
  amount_paid                NUMERIC DEFAULT 0,
  currency                   TEXT DEFAULT 'SAR',
  estimated_start_date       DATE,
  estimated_completion_date  DATE,
  actual_start_date          DATE,
  actual_completion_date     DATE,
  delivery_date              DATE,
  status                     TEXT NOT NULL DEFAULT 'pending',
    -- pending|materials_requested|in_production|quality_check|ready|delivered|cancelled
  priority                   TEXT NOT NULL DEFAULT 'normal',
  payment_status             TEXT DEFAULT 'unpaid',
  production_notes           TEXT,
  quality_notes              TEXT,
  delivery_notes             TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_orders TO authenticated;
GRANT ALL ON public.manufacturing_orders TO service_role;
ALTER TABLE public.manufacturing_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read manufacturing_orders" ON public.manufacturing_orders
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "ed ins manufacturing_orders" ON public.manufacturing_orders
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ed upd manufacturing_orders" ON public.manufacturing_orders
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "adm del manufacturing_orders" ON public.manufacturing_orders
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_manufacturing_orders_updated
  BEFORE UPDATE ON public.manufacturing_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 4. material_requisitions + items
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_requisitions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_number       TEXT NOT NULL UNIQUE,
  manufacturing_order_id   UUID REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE,
  approval_id              UUID,
  status                   TEXT NOT NULL DEFAULT 'pending',
  notes                    TEXT,
  issued_at                TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_requisitions TO authenticated;
GRANT ALL ON public.material_requisitions TO service_role;
ALTER TABLE public.material_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read material_requisitions" ON public.material_requisitions
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "ed ins material_requisitions" ON public.material_requisitions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ed upd material_requisitions" ON public.material_requisitions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "adm del material_requisitions" ON public.material_requisitions
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_material_requisitions_updated
  BEFORE UPDATE ON public.material_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.material_requisition_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id      UUID NOT NULL REFERENCES public.material_requisitions(id) ON DELETE CASCADE,
  product_id          UUID,
  product_code        TEXT,
  product_name        TEXT,
  requested_quantity  NUMERIC NOT NULL DEFAULT 0,
  issued_quantity     NUMERIC DEFAULT 0,
  unit                TEXT,
  unit_cost           NUMERIC,
  total_cost          NUMERIC,
  supplier_id         UUID,
  supplier_name       TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_requisition_items TO authenticated;
GRANT ALL ON public.material_requisition_items TO service_role;
ALTER TABLE public.material_requisition_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read mri" ON public.material_requisition_items
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "ed ins mri" ON public.material_requisition_items
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ed upd mri" ON public.material_requisition_items
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "adm del mri" ON public.material_requisition_items
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------------------------------
-- 5. chatbot_interactions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatbot_interactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id         UUID REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  manufacturing_order_id   UUID REFERENCES public.manufacturing_orders(id) ON DELETE SET NULL,
  interaction_type         TEXT NOT NULL,
  direction                TEXT NOT NULL,  -- inbound|outbound
  payload                  JSONB,
  response_payload         JSONB,
  status                   TEXT,           -- pending|sent|delivered|failed
  sent_at                  TIMESTAMPTZ,
  delivered_at             TIMESTAMPTZ,
  error_message            TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_interactions TO authenticated;
GRANT ALL ON public.chatbot_interactions TO service_role;
ALTER TABLE public.chatbot_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read chatbot_interactions" ON public.chatbot_interactions
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "system insert chatbot_interactions" ON public.chatbot_interactions
  FOR INSERT TO authenticated WITH CHECK (true);

-- ----------------------------------------------------------------
-- 6. pricing_rules
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  rule_type    TEXT NOT NULL,    -- material_markup|labor_rate|overhead_percent|profit_margin|complexity_factor|volume_discount
  value        NUMERIC NOT NULL,
  conditions   JSONB DEFAULT '{}'::jsonb,
  priority     INTEGER NOT NULL DEFAULT 100,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  valid_from   DATE,
  valid_to     DATE,
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pricing_rules" ON public.pricing_rules
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "ed ins pricing_rules" ON public.pricing_rules
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ed upd pricing_rules" ON public.pricing_rules
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "adm del pricing_rules" ON public.pricing_rules
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_pricing_rules_updated
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 7. agent_sessions / agent_actions / agent_decisions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   TEXT NOT NULL UNIQUE,
  channel      TEXT,
  customer_id  TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  status       TEXT NOT NULL DEFAULT 'active',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_sessions TO authenticated;
GRANT ALL ON public.agent_sessions TO service_role;
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read agent_sessions" ON public.agent_sessions
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "system insert agent_sessions" ON public.agent_sessions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "system upd agent_sessions" ON public.agent_sessions
  FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.agent_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   TEXT,
  action_type  TEXT NOT NULL,
  endpoint     TEXT,
  payload      JSONB,
  result       JSONB,
  status       TEXT DEFAULT 'completed',
  error_message TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_actions TO authenticated;
GRANT ALL ON public.agent_actions TO service_role;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read agent_actions" ON public.agent_actions
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "system insert agent_actions" ON public.agent_actions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT,
  decision_type TEXT NOT NULL,
  input         JSONB,
  output        JSONB,
  confidence    NUMERIC,
  model         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_decisions TO authenticated;
GRANT ALL ON public.agent_decisions TO service_role;
ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read agent_decisions" ON public.agent_decisions
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "system insert agent_decisions" ON public.agent_decisions
  FOR INSERT TO authenticated WITH CHECK (true);

-- ----------------------------------------------------------------
-- 8. integration_configs (used by Integrations UI)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL,
  name         TEXT,
  status       TEXT NOT NULL DEFAULT 'inactive',
  config       JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  last_error   TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_configs TO authenticated;
GRANT ALL ON public.integration_configs TO service_role;
ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read integration_configs" ON public.integration_configs
  FOR SELECT TO authenticated USING (is_authorized(auth.uid()));
CREATE POLICY "ed ins integration_configs" ON public.integration_configs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ed upd integration_configs" ON public.integration_configs
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "adm del integration_configs" ON public.integration_configs
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_integration_configs_updated
  BEFORE UPDATE ON public.integration_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 9. RPCs: generate_order_number / generate_requisition_number
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr  TEXT := to_char(now(), 'YYYY');
  n   INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(order_number, '.*-', ''), '')::int),
    0
  ) + 1 INTO n
  FROM public.manufacturing_orders
  WHERE order_number LIKE 'MO-' || yr || '-%';
  RETURN 'MO-' || yr || '-' || lpad(n::text, 5, '0');
END
$$;

CREATE OR REPLACE FUNCTION public.generate_requisition_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr  TEXT := to_char(now(), 'YYYY');
  n   INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(requisition_number, '.*-', ''), '')::int),
    0
  ) + 1 INTO n
  FROM public.material_requisitions
  WHERE requisition_number LIKE 'MR-' || yr || '-%';
  RETURN 'MR-' || yr || '-' || lpad(n::text, 5, '0');
END
$$;

GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_requisition_number() TO authenticated, service_role;

-- ----------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_quote_requests_status        ON public.quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer      ON public.quote_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_mo_status                    ON public.manufacturing_orders(status);
CREATE INDEX IF NOT EXISTS idx_mo_customer                  ON public.manufacturing_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_mo_quote                     ON public.manufacturing_orders(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_mr_order                     ON public.material_requisitions(manufacturing_order_id);
CREATE INDEX IF NOT EXISTS idx_mri_req                      ON public.material_requisition_items(requisition_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_quote   ON public.chatbot_interactions(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_order   ON public.chatbot_interactions(manufacturing_order_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_type_active    ON public.pricing_rules(rule_type, is_active);
CREATE INDEX IF NOT EXISTS idx_product_requests_status      ON public.product_requests(status);
CREATE INDEX IF NOT EXISTS idx_agent_actions_session        ON public.agent_actions(session_id);
