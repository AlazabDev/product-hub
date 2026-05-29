import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS, json, logCall, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/v1/products")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const started = Date.now();
        const auth = await requireApiKey(request, "/api/public/v1/products");
        if ("error" in auth) {
          await logCall({
            consumer: null,
            request,
            endpoint: "/api/public/v1/products",
            status: 401,
            startedAt: started,
            error: "auth",
          });
          return auth.error;
        }
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
        const status = url.searchParams.get("status");
        const search = url.searchParams.get("q");

        let q = supabaseAdmin
          .from("products")
          .select(
            "id, az_code, egs_code, name_ar, name_en, short_description_ar, status, item_type, gpc_brick_title, tags, updated_at",
            { count: "exact" },
          )
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (status) q = q.eq("status", status as "draft");
        if (search)
          q = q.or(
            `name_ar.ilike.%${search}%,name_en.ilike.%${search}%,az_code.ilike.%${search}%,egs_code.ilike.%${search}%`,
          );

        const { data, error, count } = await q;
        if (error) {
          await logCall({
            consumer: auth.consumer,
            request,
            endpoint: "/api/public/v1/products",
            status: 500,
            startedAt: started,
            error: error.message,
          });
          return json({ error: error.message }, 500);
        }
        await logCall({
          consumer: auth.consumer,
          request,
          endpoint: "/api/public/v1/products",
          status: 200,
          startedAt: started,
        });
        return json({ data, total: count, limit, offset });
      },
    },
  },
});
