import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS, json, logCall, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/v1/products/$azCode")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const started = Date.now();
        const auth = await requireApiKey(request);
        const ep = `/api/public/v1/products/${params.azCode}`;
        if ("error" in auth) {
          await logCall({ consumer: null, request, endpoint: ep, status: 401, startedAt: started });
          return auth.error;
        }
        const { data: product, error } = await supabaseAdmin
          .from("products").select("*")
          .or(`az_code.eq.${params.azCode},egs_code.eq.${params.azCode}`)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!product) {
          await logCall({ consumer: auth.consumer, request, endpoint: ep, status: 404, startedAt: started });
          return json({ error: "Not found" }, 404);
        }
        const [{ data: assets }, { data: prices }] = await Promise.all([
          supabaseAdmin.from("product_assets").select("asset_role, sort_order, assets(file_url, file_name, file_type)").eq("product_id", product.id).order("sort_order"),
          supabaseAdmin.from("prices").select("selling_price, purchase_price, currency, status, supplier_id, valid_from, valid_to").eq("product_id", product.id),
        ]);
        await logCall({ consumer: auth.consumer, request, endpoint: ep, status: 200, startedAt: started });
        return json({ data: { ...product, assets, prices } });
      },
    },
  },
});
