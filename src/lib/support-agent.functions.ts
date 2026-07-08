import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface AzureSearchDoc {
  az_code: string;
  product_name?: string;
  support_summary?: string;
  common_questions?: string[];
  troubleshooting?: string[];
  warranty_notes?: string;
  escalation_rules?: string;
  ai_response_instructions?: string;
  linked_assets?: string[];
}

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
});

const ConfigSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(64).max(4000).optional(),
    systemPromptOverride: z.string().max(4000).optional(),
    enableRag: z.boolean().optional(),
    enableTools: z.boolean().optional(),
  })
  .optional();

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
  config: ConfigSchema,
});

function getEnv() {
  return {
    searchEndpoint: (process.env.AZURE_SEARCH_ENDPOINT ?? "").replace(/\/$/, ""),
    searchKey: process.env.AZURE_SEARCH_API_KEY ?? "",
    searchIndex: process.env.AZURE_SEARCH_INDEX ?? "",
    openaiEndpoint: (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/$/, ""),
    openaiKey: process.env.AZURE_OPENAI_API_KEY ?? "",
    chatDeployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? "",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
  };
}

async function azureSearchDocs(query: string, env: ReturnType<typeof getEnv>) {
  if (!env.searchEndpoint || !env.searchKey || !env.searchIndex) return [];
  const url = `${env.searchEndpoint}/indexes/${env.searchIndex}/docs/search?api-version=2024-07-01`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": env.searchKey },
    body: JSON.stringify({ search: query, top: 5, queryType: "simple" }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.value ?? []) as AzureSearchDoc[];
}

function buildSystemPrompt(doc: AzureSearchDoc | null, override?: string): string {
  if (override && override.trim()) return override.trim();
  const base = `أنت وكيل تنسيق وضبط منتجات شركة العزب. مهامك:
1. البحث عن المنتجات وإرجاع بياناتها (رمز AZ، الاسم، الفئة، الوصف).
2. اقتراح تحسينات على تصنيف المنتجات وبياناتها الناقصة.
3. الرد على الاستفسارات الفنية بدقة.
استخدم الأدوات (tools) عند الحاجة للوصول إلى قاعدة البيانات. أجب بالعربية.`;
  if (!doc) return base;
  return `${base}

سياق منتج ذو صلة:
- AZ Code: ${doc.az_code}
- الاسم: ${doc.product_name ?? "—"}
- ملخص: ${doc.support_summary ?? "—"}
- استكشاف الأخطاء: ${(doc.troubleshooting ?? []).join(" | ")}
- ملاحظات الضمان: ${doc.warranty_notes ?? "—"}`;
}

// ---------- Tool definitions ----------
const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_products",
      description: "بحث في قاعدة بيانات المنتجات بالاسم أو رمز AZ أو الكلمات المفتاحية.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "نص البحث" },
          limit: { type: "integer", default: 5 },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_product_by_az_code",
      description: "احضر التفاصيل الكاملة لمنتج بواسطة رمز AZ",
      parameters: {
        type: "object",
        properties: { az_code: { type: "string" } },
        required: ["az_code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_incomplete_products",
      description: "قائمة المنتجات التي تنقصها البيانات (اسم إنجليزي أو وصف أو فئة).",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer", default: 10 } },
      },
    },
  },
];

async function runTool(
  name: string,
  args: Record<string, unknown>,
  supabase: any,
): Promise<string> {
  try {
    if (name === "search_products") {
      const q = String(args.query ?? "");
      const limit = Math.min(Number(args.limit ?? 5), 20);
      const { data } = await supabase
        .from("products")
        .select("az_code,name_ar,name_en,status,item_type,short_description_ar,category_id")
        .or(`name_ar.ilike.%${q}%,name_en.ilike.%${q}%,az_code.ilike.%${q}%`)
        .limit(limit);
      return JSON.stringify({ results: data ?? [] });
    }
    if (name === "get_product_by_az_code") {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("az_code", String(args.az_code))
        .maybeSingle();
      return JSON.stringify(data ?? { error: "not_found" });
    }
    if (name === "list_incomplete_products") {
      const limit = Math.min(Number(args.limit ?? 10), 50);
      const { data } = await supabase
        .from("products")
        .select("az_code,name_ar,name_en,short_description_ar,category_id")
        .or("name_en.is.null,short_description_ar.is.null,category_id.is.null")
        .limit(limit);
      return JSON.stringify({ incomplete: data ?? [] });
    }
    return JSON.stringify({ error: `unknown_tool:${name}` });
  } catch (e: any) {
    return JSON.stringify({ error: e.message ?? String(e) });
  }
}

export const askSupportAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const env = getEnv();
    if (!env.openaiEndpoint || !env.openaiKey || !env.chatDeployment) {
      throw new Error("Azure OpenAI غير مهيأ. تحقق من إعدادات الأسرار.");
    }

    const cfg = data.config ?? {};
    const enableRag = cfg.enableRag ?? true;
    const enableTools = cfg.enableTools ?? true;

    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) throw new Error("لا توجد رسالة مستخدم.");

    let bestDoc: AzureSearchDoc | null = null;
    if (enableRag) {
      const docs = await azureSearchDocs(lastUser.content, env);
      bestDoc = docs[0] ?? null;
    }

    const system = buildSystemPrompt(bestDoc, cfg.systemPromptOverride);
    const url = `${env.openaiEndpoint}/openai/deployments/${env.chatDeployment}/chat/completions?api-version=${env.apiVersion}`;

    const convo: any[] = [
      { role: "system", content: system },
      ...data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    let finalContent = "";
    const toolTrace: Array<{ name: string; args: unknown }> = [];

    for (let step = 0; step < 4; step++) {
      const body: Record<string, unknown> = {
        messages: convo,
        temperature: cfg.temperature ?? 0.3,
        max_tokens: cfg.maxTokens ?? 800,
      };
      if (enableTools) {
        body.tools = AGENT_TOOLS;
        body.tool_choice = "auto";
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": env.openaiKey },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Azure OpenAI ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = await res.json();
      const msg = json.choices?.[0]?.message;
      if (!msg) throw new Error("رد فارغ من النموذج.");

      const toolCalls = msg.tool_calls as
        | Array<{ id: string; function: { name: string; arguments: string } }>
        | undefined;
      if (toolCalls && toolCalls.length > 0) {
        convo.push(msg);
        for (const tc of toolCalls) {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(tc.function.arguments || "{}");
          } catch {
            /* keep empty */
          }
          toolTrace.push({ name: tc.function.name, args: parsed });
          const result = await runTool(tc.function.name, parsed, context.supabase);
          convo.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
        continue;
      }

      finalContent = msg.content ?? "";
      break;
    }

    // Audit (best effort)
    await context.supabase.from("audit_logs").insert({
      entity_type: "support_chat",
      entity_id: null,
      action: "AI_REPLY",
      old_value: null,
      new_value: { query: lastUser.content, tools: toolTrace, az_code: bestDoc?.az_code ?? null },
    });

    return {
      reply: finalContent || "لم أتمكن من توليد رد.",
      source: bestDoc ? { azCode: bestDoc.az_code, name: bestDoc.product_name } : null,
      toolsUsed: toolTrace,
    };
  });
