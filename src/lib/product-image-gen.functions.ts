import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "product-assets";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-image";

interface ProductRow {
  id: string;
  az_code: string;
  name_ar: string | null;
  name_en: string | null;
  description_ar: string | null;
  gpc_family: string | null;
}

async function generateOneImage(prompt: string): Promise<{ mime: string; bytes: Uint8Array }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const images = data?.choices?.[0]?.message?.images;
  const url: string | undefined = images?.[0]?.image_url?.url;
  if (!url || !url.startsWith("data:")) {
    throw new Error("No image returned from AI");
  }
  const [meta, b64] = url.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return { mime, bytes };
}

function buildPrompt(p: ProductRow, variant: number): string {
  const name = p.name_en || p.name_ar || p.az_code;
  const ctx = [p.gpc_family, p.description_ar].filter(Boolean).join(" — ");
  const angles = [
    "Professional product photography, white background, studio lighting, centered, high detail, 1:1",
    "Lifestyle shot in realistic industrial context, natural lighting, photorealistic",
    "Close-up technical detail shot, neutral background, sharp focus, photorealistic",
  ];
  return `${angles[variant]}. Product: ${name}. ${ctx ? `Context: ${ctx}.` : ""} No text, no watermarks, no logos.`;
}

async function processProduct(p: ProductRow, userId: string) {
  const results: { ok: boolean; error?: string }[] = [];
  // Check existing count to avoid runaway duplicates
  const { count } = await supabaseAdmin
    .from("product_assets")
    .select("id", { count: "exact", head: true })
    .eq("product_id", p.id);
  const startOrder = count ?? 0;

  for (let i = 0; i < 3; i++) {
    try {
      const { mime, bytes } = await generateOneImage(buildPrompt(p, i));
      const ext = mime.split("/")[1] ?? "png";
      const path = `${p.az_code}/ai_${Date.now()}_${i}.${ext}`;

      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "31536000" });
      if (upErr) throw new Error(`Storage: ${upErr.message}`);

      const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

      const { data: asset, error: aErr } = await supabaseAdmin
        .from("assets")
        .insert({
          file_name: `ai_${p.az_code}_${i + 1}.${ext}`,
          file_url: pub.publicUrl,
          file_size: bytes.byteLength,
          file_type: mime,
          folder_path: p.az_code,
          storage_provider: "supabase",
          source: "ai_generated",
          uploaded_by: userId,
          status: "active",
          tags: ["ai", "auto-generated"],
        })
        .select("id")
        .single();
      if (aErr) throw new Error(`Asset: ${aErr.message}`);

      const role = startOrder === 0 && i === 0 ? "main_image" : "gallery";
      const { error: lErr } = await supabaseAdmin.from("product_assets").insert({
        product_id: p.id,
        asset_id: asset.id,
        asset_role: role,
        sort_order: startOrder + i,
      });
      if (lErr) throw new Error(`Link: ${lErr.message}`);

      results.push({ ok: true });
    } catch (e: any) {
      results.push({ ok: false, error: e.message ?? String(e) });
    }
  }
  return results;
}

export const generateProductImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productIds: string[] }) =>
    z.object({ productIds: z.array(z.string().uuid()).min(1).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select("id, az_code, name_ar, name_en, description_ar, gpc_family")
      .in("id", data.productIds);
    if (error) throw new Error(error.message);

    const summary: { productId: string; azCode: string; generated: number; failed: number; errors: string[] }[] = [];
    for (const p of products ?? []) {
      const res = await processProduct(p as ProductRow, context.userId);
      const generated = res.filter((r) => r.ok).length;
      const failed = res.length - generated;
      summary.push({
        productId: p.id,
        azCode: p.az_code,
        generated,
        failed,
        errors: res.filter((r) => !r.ok).map((r) => r.error!).slice(0, 3),
      });
    }

    await supabaseAdmin.from("audit_logs").insert({
      entity_type: "products",
      entity_id: null,
      action: "AI_IMAGE_GEN_BULK",
      new_value: { count: products?.length ?? 0, summary } as any,
    });

    const totalGenerated = summary.reduce((s, x) => s + x.generated, 0);
    const totalFailed = summary.reduce((s, x) => s + x.failed, 0);
    return { summary, totalGenerated, totalFailed };
  });
