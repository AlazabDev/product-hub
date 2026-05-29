import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS, json, logCall, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/v1/suppliers")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const started = Date.now();
        const auth = await requireApiKey(request, "/api/public/v1/suppliers");
        if ("error" in auth) return auth.error;
        const { data, error, count } = await supabaseAdmin
          .from("suppliers")
          .select(
            "id, name, supplier_tier, supplier_type, contact_name, phone, email, website, status",
            { count: "exact" },
          )
          .eq("status", "active")
          .order("name");
        if (error) return json({ error: error.message }, 500);
        await logCall({
          consumer: auth.consumer,
          request,
          endpoint: "/api/public/v1/suppliers",
          status: 200,
          startedAt: started,
        });
        return json({ data, total: count });
      },
    },
  },
});
