import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
}

export async function requireApiKey(request: Request) {
  const key = request.headers.get("x-api-key");
  if (!key) return { error: json({ error: "Missing x-api-key header" }, 401) };
  const { data, error } = await supabaseAdmin
    .from("api_consumers")
    .select("id, name, channel, is_active, allowed_endpoints, total_requests")
    .eq("api_key", key)
    .maybeSingle();
  if (error || !data) return { error: json({ error: "Invalid API key" }, 401) };
  if (!data.is_active) return { error: json({ error: "API key disabled" }, 403) };
  return { consumer: data };
}

export async function logCall(opts: {
  consumer: { id: string; name: string; channel: string; total_requests: number } | null;
  request: Request;
  endpoint: string;
  status: number;
  startedAt: number;
  payload?: unknown;
  error?: string;
}) {
  const elapsed = Date.now() - opts.startedAt;
  try {
    await supabaseAdmin.from("webhook_logs").insert({
      consumer_id: opts.consumer?.id ?? null,
      consumer_name: opts.consumer?.name ?? null,
      channel: opts.consumer?.channel ?? "anonymous",
      endpoint: opts.endpoint,
      method: opts.request.method,
      status_code: opts.status,
      ip_address: opts.request.headers.get("cf-connecting-ip") ?? opts.request.headers.get("x-forwarded-for"),
      user_agent: opts.request.headers.get("user-agent"),
      request_payload: (opts.payload ?? null) as never,
      error_message: opts.error ?? null,
      response_time_ms: elapsed,
    });
    if (opts.consumer) {
      await supabaseAdmin
        .from("api_consumers")
        .update({ total_requests: opts.consumer.total_requests + 1, last_used_at: new Date().toISOString() })
        .eq("id", opts.consumer.id);
    }
  } catch (e) {
    console.error("logCall failed", e);
  }
}
