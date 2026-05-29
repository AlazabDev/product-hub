DROP TRIGGER IF EXISTS trg_track_price_history ON public.prices;
CREATE TRIGGER trg_track_price_history
AFTER UPDATE ON public.prices
FOR EACH ROW EXECUTE FUNCTION public.track_price_history();

DROP TRIGGER IF EXISTS trg_audit_suppliers ON public.suppliers;
CREATE TRIGGER trg_audit_suppliers
AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.audit_changes();

DROP TRIGGER IF EXISTS trg_audit_prices ON public.prices;
CREATE TRIGGER trg_audit_prices
AFTER INSERT OR UPDATE OR DELETE ON public.prices
FOR EACH ROW EXECUTE FUNCTION public.audit_changes();