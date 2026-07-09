DROP POLICY IF EXISTS "public_read_products" ON public.products;
DROP POLICY IF EXISTS "public read api_quotes_by_token" ON public.api_quotes;
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.api_quotes FROM anon;