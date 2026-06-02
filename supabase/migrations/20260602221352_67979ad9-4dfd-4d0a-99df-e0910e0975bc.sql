
-- Add internal_review stage for quote_request approvals
ALTER TYPE public.approval_stage ADD VALUE IF NOT EXISTS 'internal_review';

-- Add quantity to quote_requests
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1;

-- Reference table for legal MO status transitions
CREATE TABLE IF NOT EXISTS public.manufacturing_order_status_transitions (
  from_status text NOT NULL,
  to_status   text NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

GRANT SELECT ON public.manufacturing_order_status_transitions TO authenticated;
GRANT ALL    ON public.manufacturing_order_status_transitions TO service_role;

ALTER TABLE public.manufacturing_order_status_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read mo_transitions"
  ON public.manufacturing_order_status_transitions
  FOR SELECT TO authenticated
  USING (is_authorized(auth.uid()));

INSERT INTO public.manufacturing_order_status_transitions(from_status, to_status) VALUES
  ('pending','materials_requested'),
  ('pending','cancelled'),
  ('materials_requested','in_production'),
  ('materials_requested','cancelled'),
  ('in_production','quality_check'),
  ('in_production','cancelled'),
  ('quality_check','ready'),
  ('quality_check','in_production'),
  ('ready','delivered'),
  ('ready','cancelled')
ON CONFLICT DO NOTHING;

-- Trigger that enforces MO status transitions
CREATE OR REPLACE FUNCTION public.enforce_mo_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.manufacturing_order_status_transitions
      WHERE from_status = OLD.status AND to_status = NEW.status
    ) THEN
      RAISE EXCEPTION 'invalid_transition: % -> % is not allowed', OLD.status, NEW.status
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_mo_status_transition ON public.manufacturing_orders;
CREATE TRIGGER trg_enforce_mo_status_transition
  BEFORE UPDATE OF status ON public.manufacturing_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mo_status_transition();

-- Trigger that enforces quote_requests status transitions
CREATE OR REPLACE FUNCTION public.enforce_quote_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    allowed := CASE OLD.status
      WHEN 'quoted' THEN NEW.status IN ('accepted_pending_internal_approval','rejected','expired')
      WHEN 'accepted_pending_internal_approval' THEN NEW.status IN ('approved_in_production','rejected')
      WHEN 'approved_in_production' THEN false
      WHEN 'rejected' THEN false
      WHEN 'expired' THEN false
      ELSE true  -- unknown legacy states: allow
    END;
    IF NOT allowed THEN
      RAISE EXCEPTION 'invalid_quote_transition: % -> % is not allowed', OLD.status, NEW.status
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_quote_status_transition ON public.quote_requests;
CREATE TRIGGER trg_enforce_quote_status_transition
  BEFORE UPDATE OF status ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_quote_status_transition();
