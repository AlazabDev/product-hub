import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type TranslateInput = {
  productId: string;
  direction: "ar_to_en" | "en_to_ar";
  fields?: string[]; // optional subset; defaults to all standard text fields
};

type Translations = {
  name_en?: string;
  name_ar?: string;
  short_description_ar?: string;
  short_description_en?: string;
  description_ar?: string;
  description_en?: string;
  marketing_content?: string;
  technical_content?: string;
  warranty_info?: string;
  notes?: string;
};

const AR_FIELDS = ["name_ar", "short_description_ar", "description_ar"] as const;
const EN_FIELDS = ["name_en", "short_description_en", "description_en"] as const;

async function callTranslationAI(
  product: Record<string, unknown>,
  direction: "ar_to_en" | "en_to_ar",
): Promise<Translations> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY غير مهيأ");

  const source = direction === "ar_to_en" ? "العربية" : "English";
  const target = direction === "ar_to_en" ? "English" : "العربية";

  const payload = direction === "ar_to_en"
    ? {
        name_ar: product.name_ar,
        short_description_ar: product.short_description_ar,
        description_ar: product.description_ar,
        marketing_content: product.marketing_content,
        technical_content: product.technical_content,
        warranty_info: product.warranty_info,
      }
    : {
        name_en: product.name_en,
        short_description_en: product.short_description_en,
        description_en: product.description_en,
      };

  const targetSchema = direction === "ar_to_en"
    ? {
        name_en: { type: "string" },
        short_description_en: { type: "string" },
        description_en: { type: "string" },
        marketing_content: { type: "string", description: "ترجمة احترافية للمحتوى التسويقي إلى الإنجليزية" },
        technical_content: { type: "string" },
        warranty_info: { type: "string" },
      }
    : {
        name_ar: { type: "string" },
        short_description_ar: { type: "string" },
        description_ar: { type: "string" },
      };

  const systemPrompt = `أنت مترجم متخصص في كتالوجات منتجات صناعية لشركة العزب. ترجم من ${source} إلى ${target} بأسلوب احترافي تجاري. حافظ على المصطلحات الفنية وأسماء العلامات التجارية والوحدات وأرقام الموديل كما هي. لا تخترع معلومات. اترك الحقل فارغاً إذا كان المصدر فارغاً.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `ترجم الحقول التالية:\n${JSON.stringify(payload, null, 2)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "submit_translation",
          description: "تقديم ترجمة الحقول",
          parameters: { type: "object", properties: targetSchema, additionalProperties: false },
        },
      }],
      tool_choice: { type: "function", function: { name: "submit_translation" } },
    }),
  });

  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return {};
  try { return JSON.parse(args) as Translations; } catch { return {}; }
}

export const translateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TranslateInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: product, error } = await supabase
      .from("products").select("*").eq("id", data.productId).single();
    if (error || !product) throw new Error("البند غير موجود");

    const translations = await callTranslationAI(product as Record<string, unknown>, data.direction);

    // Filter to requested fields if any
    let toApply: Translations = translations;
    if (data.fields && data.fields.length > 0) {
      toApply = {};
      for (const f of data.fields) {
        const v = (translations as Record<string, string | undefined>)[f];
        if (v !== undefined) (toApply as Record<string, string>)[f] = v;
      }
    }

    return {
      productId: product.id,
      direction: data.direction,
      translations: toApply,
      sourceFields: data.direction === "ar_to_en" ? AR_FIELDS : EN_FIELDS,
    };
  });

export const applyTranslations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; translations: Record<string, string> }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const updates: Record<string, string> = {};
    const allowed = [
      "name_ar", "name_en",
      "short_description_ar", "short_description_en",
      "description_ar", "description_en",
      "marketing_content", "technical_content", "warranty_info",
    ];
    for (const [k, v] of Object.entries(data.translations)) {
      if (allowed.includes(k) && typeof v === "string" && v.trim() !== "") updates[k] = v;
    }
    if (Object.keys(updates).length === 0) return { applied: 0 };

    const { error } = await supabase.from("products").update(updates as never).eq("id", data.productId);
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      entity_type: "product",
      entity_id: data.productId,
      action: "TRANSLATION_APPLIED",
      new_value: { fields: Object.keys(updates), by: userId },
    });

    return { applied: Object.keys(updates).length, fields: Object.keys(updates) };
  });
