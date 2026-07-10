
-- 1. Drop duplicate policies on material_requisition_items
DROP POLICY IF EXISTS "adm del mri" ON public.material_requisition_items;
DROP POLICY IF EXISTS "auth read mri" ON public.material_requisition_items;
DROP POLICY IF EXISTS "ed ins mri" ON public.material_requisition_items;
DROP POLICY IF EXISTS "ed upd mri" ON public.material_requisition_items;

-- 2. Add explicit SELECT and DELETE policies for product-assets storage bucket
DROP POLICY IF EXISTS "public read product-assets" ON storage.objects;
CREATE POLICY "public read product-assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-assets');

DROP POLICY IF EXISTS "editors delete product-assets" ON storage.objects;
CREATE POLICY "editors delete product-assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-assets'
    AND (public.has_role(auth.uid(), 'editor'::public.app_role)
         OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

-- 3. supcloud_keepalive: no change needed (intentional public marker row).
