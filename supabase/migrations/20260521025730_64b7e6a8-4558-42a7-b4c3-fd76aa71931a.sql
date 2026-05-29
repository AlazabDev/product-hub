
-- Create public bucket for product assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-assets',
  'product-assets',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read
CREATE POLICY "public read product-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-assets');

-- Editors/admins can upload
CREATE POLICY "editors upload product-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-assets'
  AND (has_role(auth.uid(),'editor'::app_role) OR has_role(auth.uid(),'admin'::app_role))
);

-- Editors/admins can update
CREATE POLICY "editors update product-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-assets'
  AND (has_role(auth.uid(),'editor'::app_role) OR has_role(auth.uid(),'admin'::app_role))
);

-- Admins can delete
CREATE POLICY "admins delete product-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-assets'
  AND has_role(auth.uid(),'admin'::app_role)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_products_az_code ON public.products(az_code);
CREATE INDEX IF NOT EXISTS idx_product_assets_product_id ON public.product_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_product_assets_asset_id ON public.product_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_folder_path ON public.assets(folder_path);
