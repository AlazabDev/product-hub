import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAnyRole } from "./require-role";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().max(20000),
  tool_call_id: z.string().optional(),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  tools: z.any().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(4000).optional(),
});

/**
 * Server-side proxy for Azure OpenAI chat completions.
 * Keeps AZURE_OPENAI_API_KEY on the server (never in the browser bundle).
 */
export const azureChatCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAnyRole(context.supabase, context.userId, ["admin", "editor"]);
    const endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/$/, "");
    const apiKey = process.env.AZURE_OPENAI_API_KEY ?? "";
    const deployment =
      process.env.AZURE_OPENAI_DEPLOYMENT || "alazab-paop-assistant";
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";

    if (!endpoint || !apiKey) {
      return {
        ok: false as const,
        error: "Azure OpenAI is not configured on the server.",
      };
    }

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    const body: Record<string, unknown> = {
      messages: data.messages,
      temperature: data.temperature ?? 0.7,
      max_tokens: data.max_tokens ?? 2000,
    };
    if (data.tools) {
      body.tools = data.tools;
      body.tool_choice = "auto";
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("azureChatCompletion failed", res.status, text.slice(0, 300));
      return { ok: false as const, error: `Azure OpenAI ${res.status}` };
    }
    const json = await res.json();
    return { ok: true as const, data: json };
  });
