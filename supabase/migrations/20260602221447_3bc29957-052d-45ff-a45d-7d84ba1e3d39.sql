
CREATE OR REPLACE FUNCTION public.approve_quote_for_manufacturing(
  _approval_id uuid,
  _decided_by  uuid DEFAULT NULL,
  _notes       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval        public.approvals%ROWTYPE;
  v_quote           public.quote_requests%ROWTYPE;
  v_order_number    text;
  v_req_number      text;
  v_mo_id           uuid;
  v_mr_id           uuid;
  v_qty             numeric;
  v_unit_price      numeric;
  v_total           numeric;
  v_pricing         jsonb;
  v_materials       jsonb;
  v_items_count     int := 0;
BEGIN
  -- 1. lock + load approval
  SELECT * INTO v_approval
    FROM public.approvals
   WHERE id = _approval_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'approval_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_approval.status <> 'pending' THEN
    RAISE EXCEPTION 'approval_not_pending: %', v_approval.status USING ERRCODE = '22023';
  END IF;
  IF v_approval.entity_type <> 'quote_request' THEN
    RAISE EXCEPTION 'wrong_entity_type: %', v_approval.entity_type USING ERRCODE = '22023';
  END IF;

  -- 2. lock + load quote
  SELECT * INTO v_quote
    FROM public.quote_requests
   WHERE id = v_approval.entity_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quote_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_quote.status <> 'accepted_pending_internal_approval' THEN
    RAISE EXCEPTION 'quote_not_pending_approval: %', v_quote.status USING ERRCODE = '22023';
  END IF;

  v_qty        := COALESCE(v_quote.quantity, 1);
  v_pricing    := COALESCE(v_quote.pricing_breakdown, '{}'::jsonb);
  v_unit_price := COALESCE(v_quote.selling_price, (v_pricing->>'selling_price')::numeric, 0);
  v_total      := v_unit_price * v_qty;

  -- 3. generate numbers
  v_order_number := public.generate_order_number();
  v_req_number   := public.generate_requisition_number();

  -- 4. create manufacturing order
  INSERT INTO public.manufacturing_orders(
    order_number, quote_request_id, approval_id,
    customer_id, customer_name, customer_phone,
    design_data, specifications,
    quantity, unit_price, total_price, final_price, currency,
    status, priority
  ) VALUES (
    v_order_number, v_quote.id, v_approval.id,
    v_quote.customer_id, v_quote.customer_name, v_quote.customer_phone,
    v_quote.design_data, v_quote.special_requirements,
    v_qty, v_unit_price, v_total, v_total, COALESCE(v_quote.currency,'SAR'),
    'pending', COALESCE(v_approval.priority,'normal')
  )
  RETURNING id INTO v_mo_id;

  -- 5. create material requisition
  INSERT INTO public.material_requisitions(
    requisition_number, manufacturing_order_id, approval_id, status
  ) VALUES (
    v_req_number, v_mo_id, v_approval.id, 'pending'
  )
  RETURNING id INTO v_mr_id;

  -- 6. insert MR items from pricing breakdown
  v_materials := COALESCE(v_pricing->'materials_breakdown', '[]'::jsonb);
  IF jsonb_typeof(v_materials) = 'array' AND jsonb_array_length(v_materials) > 0 THEN
    INSERT INTO public.material_requisition_items(
      requisition_id, product_id, product_code, product_name,
      requested_quantity, unit, unit_cost, total_cost,
      supplier_id, supplier_name, status
    )
    SELECT
      v_mr_id,
      NULLIF(m->>'product_id','')::uuid,
      m->>'material_code',
      m->>'material_name',
      COALESCE((m->>'quantity')::numeric,0) * v_qty,
      m->>'unit',
      (m->>'unit_cost')::numeric,
      COALESCE((m->>'total_cost')::numeric,0) * v_qty,
      NULLIF(m->>'supplier_id','')::uuid,
      m->>'supplier_name',
      'pending'
    FROM jsonb_array_elements(v_materials) AS m;
    GET DIAGNOSTICS v_items_count = ROW_COUNT;
  END IF;

  -- 7. update approval
  UPDATE public.approvals
     SET status = 'approved',
         decided_at = now(),
         decided_by = _decided_by,
         notes = COALESCE(_notes, notes)
   WHERE id = v_approval.id;

  -- 8. update quote
  UPDATE public.quote_requests
     SET status = 'approved_in_production'
   WHERE id = v_quote.id;

  RETURN jsonb_build_object(
    'approval_id', v_approval.id,
    'manufacturing_order_id', v_mo_id,
    'order_number', v_order_number,
    'material_requisition_id', v_mr_id,
    'requisition_number', v_req_number,
    'items_count', v_items_count
  );
END $$;

REVOKE ALL ON FUNCTION public.approve_quote_for_manufacturing(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_quote_for_manufacturing(uuid, uuid, text) TO service_role;
