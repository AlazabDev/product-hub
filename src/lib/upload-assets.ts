import { supabase } from "@/integrations/supabase/client";

export type AssetRole =
  | "main_image" | "gallery" | "before" | "after" | "technical_drawing"
  | "supplier_image" | "site_photo" | "invoice_attachment" | "warranty_document"
  | "datasheet" | "model_3d" | "cad_file";

const BUCKET = "product-assets";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadAndLinkAsset(opts: {
  file: File;
  productId: string;
  azCode: string;
  role: AssetRole;
  sortOrder: number;
  folderPath?: string;
}) {
  const { file, productId, azCode, role, sortOrder, folderPath } = opts;
  const ts = Date.now();
  const safeName = sanitize(file.name);
  const path = `${azCode}/${ts}_${sortOrder}_${safeName}`;

  const { data: { user } } = await supabase.auth.getUser();

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (upErr) throw new Error(`Storage: ${upErr.message}`);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data: asset, error: aErr } = await supabase
    .from("assets")
    .insert({
      file_name: file.name,
      file_url: pub.publicUrl,
      file_size: file.size,
      file_type: file.type || null,
      folder_path: folderPath ?? azCode,
      storage_provider: "supabase",
      source: "bulk_upload",
      uploaded_by: user?.id ?? null,
      status: "active",
    })
    .select("id")
    .single();
  if (aErr) throw new Error(`Asset row: ${aErr.message}`);

  const { error: lErr } = await supabase.from("product_assets").insert({
    product_id: productId,
    asset_id: asset.id,
    asset_role: role,
    sort_order: sortOrder,
  });
  if (lErr) throw new Error(`Link: ${lErr.message}`);

  return { assetId: asset.id, publicUrl: pub.publicUrl, path };
}

export async function deleteAssetLink(linkId: string) {
  const { error } = await supabase.from("product_assets").delete().eq("id", linkId);
  if (error) throw error;
}

export async function setAssetRole(linkId: string, role: AssetRole) {
  const { error } = await supabase.from("product_assets").update({ asset_role: role }).eq("id", linkId);
  if (error) throw error;
}

/** Promote a link to main_image, demote the existing main (if any) to gallery. */
export async function promoteToMain(productId: string, linkId: string) {
  const { data: current } = await supabase
    .from("product_assets")
    .select("id")
    .eq("product_id", productId)
    .eq("asset_role", "main_image")
    .maybeSingle();
  if (current && current.id !== linkId) {
    await supabase.from("product_assets").update({ asset_role: "gallery" }).eq("id", current.id);
  }
  const { error } = await supabase.from("product_assets").update({ asset_role: "main_image" }).eq("id", linkId);
  if (error) throw error;
}

/** Persist new ordering: pass linkIds in display order. */
export async function reorderAssets(linkIds: string[]) {
  await Promise.all(
    linkIds.map((id, idx) =>
      supabase.from("product_assets").update({ sort_order: idx }).eq("id", id)
    )
  );
}

/** Soft-delete an asset (status='archived'); links remain for audit. */
export async function softDeleteAsset(assetId: string) {
  const { error } = await supabase.from("assets").update({ status: "archived" }).eq("id", assetId);
  if (error) throw error;
}
