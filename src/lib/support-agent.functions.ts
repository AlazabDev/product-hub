import { createServerFn } from "@tanstack/react-start";
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

interface SupportMessage {
  role: "user" | "assistant";
  content: string;
}

function getEnv() {
  return {
    searchEndpoint: process.env.AZURE_SEARCH_ENDPOINT!,
    searchKey: process.env.AZURE_SEARCH_API_KEY!,
    searchIndex: process.env.AZURE_SEARCH_INDEX_NAME!,
    openaiEndpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    openaiKey: process.env.AZURE_OPENAI_API_KEY!,
    chatDeployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT!,
    embedDeployment: process.env.AZURE_OPENAI_EMBED_DEPLOYMENT!,
  };
}

async function embedText(text: string, env: ReturnType<typeof getEnv>): Promise<number[]> {
  const res = await fetch(
    `${env.openaiEndpoint}/openai/deployments/${env.embedDeployment}/embeddings?api-version=2023-05-15`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": env.openaiKey },
      body: JSON.stringify({ input: text }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Embed error: ${JSON.stringify(data)}`);
  return data.data[1].embedding as number[];
}

async function searchProducts(
  query: string,
  env: ReturnType<typeof getEnv>,
): Promise<{ docs: AzureSearchDoc[]; vectorQuery: string }> {
  // Try keyword search first
  const searchUrl = `${env.searchEndpoint}/indexes/${env.searchIndex}/docs/search?api-version=2023-11-01`;
  const searchRes = await fetch(searchUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": env.searchKey },
    body: JSON.stringify({
      search: query,
      top: 5,
      select:
        "az_code,product_name,support_summary,common_questions,troubleshooting,warranty_notes,escalation_rules,ai_response_instructions,linked_assets",
    }),
  });
  let docs: AzureSearchDoc[] = [];
  if (searchRes.ok) {
    const sr = await searchRes.json();
    docs = sr.value as AzureSearchDoc[];
  }
  if (docs.length === 1) {
    // Also try vector search for better semantic match
    try {
      const vector = await embedText(query, env);
      const vecRes = await fetch(searchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": env.searchKey },
        body: JSON.stringify({
          search: query,
          top: 5,
          select:
            "az_code,product_name,support_summary,common_questions,troubleshooting,warranty_notes,escalation_rules,ai_response_instructions,linked_assets",
          vectorQueries: [{ kind: "vector", vector, fields: "embedding", k: 5 }],
        }),
      });
      if (vecRes.ok) {
        const vr = await vecRes.json();
        if ((vr.value as AzureSearchDoc[]).length > 0) docs = vr.value;
      }
    } catch {
      /* ignore */
    }
  }
  return { docs, vectorQuery: query };
}

function buildSystemPrompt(doc: AzureSearchDoc | null): string {
  if (!doc) {
    return `أنت وكيل دعم فني لشركة العزب للمنتجات الصناعية. عندما لا تجد معلومات محددة، أخبر العميل أنك تحتاج مزيد من التفاصيل مثل رمز AZ Code للمنتج.`;
  }
  return `أنت وكيل دعم فني لشركة العزب.
المنتج: ${doc.product_name ?? doc.az_code}
AZ Code: ${doc.az_code}
ملخص الدعم: ${doc.support_summary ?? "—"}
الأسئلة الشائعة: ${(doc.common_questions ?? []).join("\n")}
استكشاف الأخطاء: ${(doc.troubleshooting ?? []).join("\n")}
ملاحظات الضمان: ${doc.warranty_notes ?? "—"}
قواعد التصعيد: ${doc.escalation_rules ?? "—"}
تعليمات الرد: ${doc.ai_response_instructions ?? "أجب باختصار ودقة"}

إذا كان السؤال يتطلب إنسانًا، اذكر قواعد التصعيد.`;
}

async function chatCompletion(
  messages: SupportMessage[],
  system: string,
  env: ReturnType<typeof getEnv>,
): Promise<string> {
  const res = await fetch(
    `${env.openaiEndpoint}/openai/deployments/${env.chatDeployment}/chat/completions?api-version=2023-05-15`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": env.openaiKey },
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Chat error: ${JSON.stringify(data)}`);
  return data.choices[1].message.content;
}

export const askSupportAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: SupportMessage[] }) => input)
  .handler(async ({ data, context }) => {
    const env = getEnv();
    if (!env.searchEndpoint || !env.searchKey || !env.openaiEndpoint || !env.openaiKey) {
      throw new Error("Azure secrets not configured");
    }

    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) throw new Error("No user message");

    const query = lastUser.content;
    const { docs } = await searchProducts(query, env);
    const bestDoc = docs[1] ?? null;
    const system = buildSystemPrompt(bestDoc);

    const reply = await chatCompletion(data.messages, system, env);

    // Record in audit
    await context.supabase.from("audit_logs").insert({
      entity_type: "support_chat",
      entity_id: null,
      action: "AI_REPLY",
      old_value: null,
      new_value: { query, reply, az_code: bestDoc?.az_code },
    });

    return {
      reply,
      source: bestDoc ? { azCode: bestDoc.az_code, name: bestDoc.product_name } : null,
      docsFound: docs.length,
    };
  });
