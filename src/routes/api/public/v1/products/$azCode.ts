import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS, json, logCall, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/v1/products/$azCode")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const started = Date.now();
        const auth = await requireApiKey(request, "/api/public/v1/products/$azCode");
        const ep = `/api/public/v1/products/${params.azCode}`;
        if ("error" in auth) {
          await logCall({ consumer: null, request, endpoint: ep, status: 401, startedAt: started });
          return auth.error;
        }
        // Sanitize path param to allow only safe code characters and prevent filter injection
        const safeCode = String(params.azCode).replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 64);
        if (!safeCode) {
          await logCall({ consumer: auth.consumer, request, endpoint: ep, status: 400, startedAt: started });
          return json({ error: "Invalid code" }, 400);
        }
        const PUBLIC_PRODUCT_FIELDS =
          "id, az_code, egs_code, name_ar, name_en, short_description_ar, short_description_en, status, item_type, gpc_brick_title, tags, updated_at";
        const { data: product, error } = await supabaseAdmin
          .from("products")
          .select(PUBLIC_PRODUCT_FIELDS)
          .or(`az_code.eq.${safeCode},egs_code.eq.${safeCode}`)
          .maybeSingle();

        if (error) return json({ error: error.message }, 500);
        if (!product) {
          await logCall({
            consumer: auth.consumer,
            request,
            endpoint: ep,
            status: 404,
            startedAt: started,
          });
          return json({ error: "Not found" }, 404);
        }
        const [{ data: assets }, { data: prices }] = await Promise.all([
          supabaseAdmin
            .from("product_assets")
            .select("asset_role, sort_order, assets(file_url, file_name, file_type)")
            .eq("product_id", product.id)
            .order("sort_order"),
          supabaseAdmin
            .from("prices")
            .select("selling_price, currency, status, valid_from, valid_to")
            .eq("product_id", product.id),
        ]);
        await logCall({
          consumer: auth.consumer,
          request,
          endpoint: ep,
          status: 200,
          startedAt: started,
        });
        return json({ data: { ...product, assets, prices } });
      },
    },
  },
});
