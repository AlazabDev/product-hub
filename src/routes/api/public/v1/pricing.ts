import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS, json, logCall, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/v1/pricing")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const started = Date.now();
        const auth = await requireApiKey(request, "/api/public/v1/pricing");
        if ("error" in auth) return auth.error;
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
        const { data, error, count } = await supabaseAdmin
          .from("prices")
          .select(
            "id, product_id, selling_price, currency, status, valid_from, valid_to, updated_at",
            { count: "exact" },
          )
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (error) return json({ error: error.message }, 500);
        await logCall({
          consumer: auth.consumer,
          request,
          endpoint: "/api/public/v1/pricing",
          status: 200,
          startedAt: started,
        });
        return json({ data, total: count, limit });
      },
    },
  },
});
