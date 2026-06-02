import { supabaseAdmin } from "@/integrations/supabase/client.server";

// =====================================================
// CORS — strict by default. Origins from ALLOWED_ORIGINS env.
// Wildcard "*" only honored in development.
// =====================================================

function parseAllowedOrigins(): string[] {
  const raw = (process.env.ALLOWED_ORIGINS ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isDev() {
  return process.env.NODE_ENV !== "production";
}

export function corsHeaders(request: Request): Record<string, string> {
  const reqOrigin = request.headers.get("origin") ?? "";
  const allowed = parseAllowedOrigins();
  let originHeader = "null";
  if (allowed.length === 0) {
    // No allowlist configured: only dev gets wildcard; prod denies.
    originHeader = isDev() ? "*" : "null";
  } else if (allowed.includes(reqOrigin)) {
    originHeader = reqOrigin;
  } else if (allowed.includes("*") && isDev()) {
    originHeader = "*";
  }
  return {
    "Access-Control-Allow-Origin": originHeader,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// CORS constant: STRICT (no Allow-Origin). Use corsHeaders(request) for proper
// per-request origin echoing. Kept for backwards-compatibility of imports.
export const CORS = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

/**
 * JSON response helper. Pass `request` as the 3rd argument to attach
 * per-request CORS headers; omit it for same-origin / internal responses.
 */
export function json(
  body: unknown,
  status = 200,
  requestOrExtra?: Request | Record<string, string>,
  extra: Record<string, string> = {},
) {
  const isReq = requestOrExtra instanceof Request;
  const cors = isReq ? corsHeaders(requestOrExtra) : {};
  const extras = isReq ? extra : ((requestOrExtra as Record<string, string>) ?? {});
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors, ...extras },
  });
}

// =====================================================
// API key auth + endpoint whitelist + per-consumer rate limiting
// =====================================================

const DEFAULT_RATE_LIMIT_PER_MINUTE = Number(process.env.API_RATE_LIMIT_PER_MINUTE ?? 120);

export async function requireApiKey(request: Request, endpoint?: string) {
  const key = request.headers.get("x-api-key");
  if (!key)
    return {
      error: json(
        { success: false, error: "Missing x-api-key header", code: "missing_api_key" },
        401,
        request,
      ),
    };

  const { data, error } = await supabaseAdmin
    .from("api_consumers")
    .select(
      "id, name, channel, is_active, allowed_endpoints, total_requests, rate_limit_per_minute",
    )
    .eq("api_key", key)
    .maybeSingle();
  if (error || !data)
    return {
      error: json(
        { success: false, error: "Invalid API key", code: "invalid_api_key" },
        401,
        request,
      ),
    };
  if (!data.is_active)
    return {
      error: json(
        { success: false, error: "API key disabled", code: "api_key_disabled" },
        403,
        request,
      ),
    };

  // Endpoint whitelist (empty list = allow all)
  if (endpoint && Array.isArray(data.allowed_endpoints) && data.allowed_endpoints.length > 0) {
    const allowed = data.allowed_endpoints.some((p) => {
      if (typeof p !== "string") return false;
      if (p === endpoint) return true;
      if (p.endsWith("*")) return endpoint.startsWith(p.slice(0, -1));
      return false;
    });
    if (!allowed) {
      return {
        error: json(
          {
            success: false,
            error: "Endpoint not allowed for this API key",
            code: "endpoint_forbidden",
          },
          403,
          request,
        ),
      };
    }
  }

  // Per-consumer rate limit via webhook_logs in last minute
  try {
    const limit = Number(data.rate_limit_per_minute) > 0
      ? Number(data.rate_limit_per_minute)
      : DEFAULT_RATE_LIMIT_PER_MINUTE;
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("webhook_logs")
      .select("id", { count: "exact", head: true })
      .eq("consumer_id", data.id)
      .gte("created_at", since);
    if ((count ?? 0) >= limit) {
      return {
        error: json(
          {
            success: false,
            error: "Rate limit exceeded",
            code: "rate_limited",
            limit_per_minute: limit,
          },
          429,
          request,
          { "Retry-After": "60" },
        ),
      };
    }
  } catch (e) {
    console.warn("rate limit check failed", e);
  }

  return { consumer: data };
}

export async function logCall(opts: {
  consumer: {
    id: string;
    name: string;
    channel: string;
    total_requests: number;
  } | null;
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
      ip_address:
        opts.request.headers.get("cf-connecting-ip") ?? opts.request.headers.get("x-forwarded-for"),
      user_agent: opts.request.headers.get("user-agent"),
      request_payload: (opts.payload ?? null) as never,
      error_message: opts.error ?? null,
      response_time_ms: elapsed,
    });
    if (opts.consumer) {
      await supabaseAdmin
        .from("api_consumers")
        .update({
          total_requests: opts.consumer.total_requests + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", opts.consumer.id);
    }
  } catch (e) {
    console.error("logCall failed", e);
  }
}
