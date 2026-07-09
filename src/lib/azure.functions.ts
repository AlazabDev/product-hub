import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { azureStatus, azureChat, azureSearch } from "./azure.server";
import { requireAnyRole } from "./require-role";

export const getAzureStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const status = azureStatus();
    const ready =
      Object.values(status.openai).every(Boolean) && Object.values(status.search).every(Boolean);
    return { ready, status };
  });

export const azureAgentRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string; useRag?: boolean }) =>
    z.object({ prompt: z.string().min(1).max(4000), useRag: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context: ctx }) => {
    await requireAnyRole(ctx.supabase, ctx.userId, ["admin", "editor"]);
    let context = "";
    if (data.useRag) {
      try {
        const docs = await azureSearch(data.prompt, 5);
        context = docs
          .map((d: any, i: number) => `[#${i + 1}] ${JSON.stringify(d).slice(0, 400)}`)
          .join("\n");
      } catch (e: any) {
        context = `(RAG unavailable: ${e.message})`;
      }
    }
    const reply = await azureChat([
      { role: "system", content: "أنت وكيل AZ Catalog. أجب بدقة وباللغة العربية عند الإمكان." },
      ...(context
        ? [{ role: "system" as const, content: `سياق من Azure Search:\n${context}` }]
        : []),
      { role: "user", content: data.prompt },
    ]);
    return { reply, ragUsed: !!data.useRag, ragChars: context.length };
  });
