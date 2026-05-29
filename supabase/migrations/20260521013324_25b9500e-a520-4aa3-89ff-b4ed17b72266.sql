
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ENUMS
CREATE TYPE app_role AS ENUM ('admin','editor','viewer');
CREATE TYPE item_type AS ENUM ('product','service','work_item','material','tool','spare_part','finish_item','custom_unit','supplier_item','package','bundle');
CREATE TYPE item_status AS ENUM ('draft','needs_review','duplicate_suspected','content_incomplete','pricing_incomplete','supplier_pending','approved','rejected','exported','archived');
CREATE TYPE asset_role AS ENUM ('main_image','gallery','before','after','technical_drawing','supplier_image','site_photo','invoice_attachment','warranty_document','datasheet','model_3d','cad_file');
CREATE TYPE supplier_tier AS ENUM ('first_tier','second_tier','backup','local','imported','internal_workshop','factory','marketplace');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_authorized(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) $$;

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL, name_en text, code text UNIQUE,
  parent_id uuid REFERENCES public.categories(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_cat_upd BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id),
  name_ar text NOT NULL, name_en text, code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_fam_upd BEFORE UPDATE ON public.families FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, code text UNIQUE NOT NULL, description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, supplier_type text,
  supplier_tier supplier_tier DEFAULT 'second_tier',
  contact_name text, phone text, email text, website text,
  api_url text, price_file_url text,
  status text DEFAULT 'active', rating numeric(3,2),
  payment_terms text, delivery_time text, coverage_areas text[],
  notes text, last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sup_upd BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  az_code text UNIQUE NOT NULL,
  product_code text, egs_code text,
  name_ar text NOT NULL, name_en text,
  short_description_ar text, short_description_en text,
  description_ar text, description_en text,
  marketing_content text, technical_content text,
  installation_notes text, maintenance_notes text,
  warranty_info text, internal_notes text,
  faq jsonb DEFAULT '[]'::jsonb,
  search_keywords text[], tags text[],
  item_type item_type NOT NULL DEFAULT 'product',
  category_id uuid REFERENCES public.categories(id),
  family_id uuid REFERENCES public.families(id),
  unit_id uuid REFERENCES public.units(id),
  operational_track text,
  gs1_gpc_brick text, gpc_brick_title text,
  gpc_class text, gpc_family text, gpc_segment text,
  sector_ar text, confidence_level text,
  status item_status NOT NULL DEFAULT 'draft',
  source text DEFAULT 'manual',
  default_supplier_id uuid REFERENCES public.suppliers(id),
  default_price_id uuid,
  external_links jsonb DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_products_az_code ON public.products(az_code);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_item_type ON public.products(item_type);
CREATE INDEX idx_products_name_trgm ON public.products USING gin (name_ar gin_trgm_ops);
CREATE TRIGGER trg_prd_upd BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_url text NOT NULL, file_name text NOT NULL,
  file_type text, file_size bigint,
  storage_provider text DEFAULT 'supabase',
  folder_path text, tags text[], source text, notes text,
  status text DEFAULT 'active',
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ast_upd BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  asset_role asset_role NOT NULL DEFAULT 'gallery',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, asset_id)
);
ALTER TABLE public.product_assets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pa_product ON public.product_assets(product_id);

CREATE TABLE public.supplier_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  supplier_sku text, internal_product_id uuid REFERENCES public.products(id),
  supplier_product_name text, available_quantity numeric,
  availability_status text, supplier_price numeric(14,2),
  currency text DEFAULT 'EGP', last_sync_at timestamptz,
  source_type text, source_url text,
  sync_status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_inventory ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_si_supplier ON public.supplier_inventory(supplier_id);
CREATE INDEX idx_si_product ON public.supplier_inventory(internal_product_id);
CREATE TRIGGER trg_si_upd BEFORE UPDATE ON public.supplier_inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  purchase_price numeric(14,2), selling_price numeric(14,2),
  reference_price numeric(14,2), margin_percent numeric(6,3),
  transport_cost numeric(14,2) DEFAULT 0,
  installation_cost numeric(14,2) DEFAULT 0,
  maintenance_cost numeric(14,2) DEFAULT 0,
  operation_cost numeric(14,2) DEFAULT 0,
  wholesale_price numeric(14,2), retail_price numeric(14,2),
  client_price numeric(14,2), project_price numeric(14,2),
  currency text DEFAULT 'EGP',
  valid_from date, valid_to date,
  status text DEFAULT 'pending', source text,
  approved_by uuid REFERENCES auth.users(id), approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_prices_product ON public.prices(product_id);
CREATE TRIGGER trg_pr_upd BEFORE UPDATE ON public.prices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  old_price numeric(14,2), new_price numeric(14,2),
  change_reason text, source text,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.duplicate_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, status text DEFAULT 'open',
  confidence_score numeric(4,3),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.duplicate_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.duplicate_group_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duplicate_group_id uuid REFERENCES public.duplicate_groups(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  similarity_reason text
);
ALTER TABLE public.duplicate_group_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL, import_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_rows int DEFAULT 0, valid_rows int DEFAULT 0, invalid_rows int DEFAULT 0,
  error_log jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.api_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, integration_type text NOT NULL,
  base_url text, status text DEFAULT 'inactive',
  last_sync_at timestamptz, last_error text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_api_upd BEFORE UPDATE ON public.api_integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, entity_id uuid, action text NOT NULL,
  old_value jsonb, new_value jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['categories','families','units','suppliers','products','assets','product_assets','supplier_inventory','prices','price_history','duplicate_groups','duplicate_group_items','import_jobs','api_integrations','audit_logs']) LOOP
    EXECUTE format('CREATE POLICY "auth read %s" ON public.%I FOR SELECT TO authenticated USING (public.is_authorized(auth.uid()))', t, t);
  END LOOP;
END $$;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['categories','families','units','suppliers','products','assets','product_assets','supplier_inventory','prices','price_history','duplicate_groups','duplicate_group_items','import_jobs','api_integrations']) LOOP
    EXECUTE format('CREATE POLICY "ed ins %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),''editor'') OR public.has_role(auth.uid(),''admin''))', t, t);
    EXECUTE format('CREATE POLICY "ed upd %s" ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),''editor'') OR public.has_role(auth.uid(),''admin''))', t, t);
  END LOOP;
END $$;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['categories','families','units','suppliers','products','assets','product_assets','supplier_inventory','prices','duplicate_groups','duplicate_group_items','api_integrations']) LOOP
    EXECUTE format('CREATE POLICY "adm del %s" ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''))', t, t);
  END LOOP;
END $$;

CREATE POLICY "system insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.audit_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(entity_type, entity_id, action, old_value, new_value, created_by)
  VALUES (TG_TABLE_NAME,
    (CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid());
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
CREATE TRIGGER trg_audit_prices AFTER INSERT OR UPDATE OR DELETE ON public.prices FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
CREATE TRIGGER trg_audit_suppliers AFTER INSERT OR UPDATE OR DELETE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.audit_changes();

CREATE OR REPLACE FUNCTION public.track_price_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.selling_price IS DISTINCT FROM NEW.selling_price THEN
    INSERT INTO public.price_history(product_id, supplier_id, old_price, new_price, change_reason, source, changed_by)
    VALUES (NEW.product_id, NEW.supplier_id, OLD.selling_price, NEW.selling_price, 'selling_price_changed', NEW.source, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_price_history AFTER UPDATE ON public.prices FOR EACH ROW EXECUTE FUNCTION public.track_price_history();

CREATE OR REPLACE FUNCTION public.next_az_code(_type text, _category text DEFAULT 'GEN', _family text DEFAULT 'GEN')
RETURNS text LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(az_code,'.*-',''),'')::int),0)+1
    INTO n FROM public.products WHERE az_code LIKE 'AZ-'||_type||'-'||_category||'-'||_family||'-%';
  RETURN 'AZ-'||_type||'-'||_category||'-'||_family||'-'||lpad(n::text,4,'0');
END $$;
