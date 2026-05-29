import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS, json, logCall, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/v1/assets")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const started = Date.now();
        const auth = await requireApiKey(request, "/api/public/v1/assets");
        if ("error" in auth) return auth.error;
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        const productId = url.searchParams.get("product_id");
        if (productId) {
          const { data, error } = await supabaseAdmin
            .from("product_assets")
            .select("asset_role, sort_order, assets(id, file_url, file_name, file_type, file_size)")
            .eq("product_id", productId)
            .order("sort_order");
          if (error) return json({ error: error.message }, 500);
          await logCall({
            consumer: auth.consumer,
            request,
            endpoint: "/api/public/v1/assets",
            status: 200,
            startedAt: started,
          });
          return json({ data });
        }
        const { data, error, count } = await supabaseAdmin
          .from("assets")
          .select("id, file_url, file_name, file_type, file_size, folder_path, status", {
            count: "exact",
          })
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return json({ error: error.message }, 500);
        await logCall({
          consumer: auth.consumer,
          request,
          endpoint: "/api/public/v1/assets",
          status: 200,
          startedAt: started,
        });
        return json({ data, total: count, limit });
      },
    },
  },
});
