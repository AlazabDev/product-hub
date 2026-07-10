-- Drop broad public SELECT on product-assets to prevent object listing via API.
-- Public URL reads still work because bucket is public (CDN path bypasses RLS).
DROP POLICY IF EXISTS "public read product-assets" ON storage.objects;

-- Allow authenticated staff (viewer/editor/admin) to list/read via API.
DROP POLICY IF EXISTS "staff list product-assets" ON storage.objects;
CREATE POLICY "staff list product-assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-assets'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'editor')
      OR public.has_role(auth.uid(), 'viewer')
    )
  );