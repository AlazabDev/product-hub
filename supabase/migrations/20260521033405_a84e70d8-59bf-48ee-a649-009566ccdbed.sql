
-- Audit triggers
DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.audit_changes();

DROP TRIGGER IF EXISTS trg_audit_product_assets ON public.product_assets;
CREATE TRIGGER trg_audit_product_assets
AFTER INSERT OR UPDATE OR DELETE ON public.product_assets
FOR EACH ROW EXECUTE FUNCTION public.audit_changes();

-- Indexes for unlinked / grouping queries
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_folder_path ON public.assets(folder_path);
CREATE INDEX IF NOT EXISTS idx_product_assets_asset_id ON public.product_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_product_assets_product_sort ON public.product_assets(product_id, sort_order);
