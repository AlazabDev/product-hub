import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAnyRole } from "./require-role";

type GenInput = {
  keywords: string;
  itemType?: string;
  sector?: string;
  gpcFamily?: string;
  language?: "ar" | "both";
};

export type GeneratedContent = {
  name_ar?: string;
  name_en?: string;
  short_description_ar?: string;
  short_description_en?: string;
  description_ar?: string;
  description_en?: string;
  marketing_content?: string;
  technical_content?: string;
  warranty_info?: string;
  tags?: string[];
  search_keywords?: string[];
  gpc_family?: string;
  sector_ar?: string;
};

export const generateProductContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GenInput) => input)
  .handler(async ({ data }): Promise<GeneratedContent> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY غير مهيأ");
    if (!data.keywords || data.keywords.trim().length < 2) {
      throw new Error("الكلمات المفتاحية مطلوبة");
    }

    const systemPrompt = `أنت كاتب محتوى محترف لكتالوج منتجات شركة العزب الصناعية. ينشئ المستخدم بنداً جديداً ويزودك بكلمات مفتاحية فقط. مهمتك: إنشاء محتوى احترافي تجاري كامل بالعربية والإنجليزية. حافظ على الدقة الفنية، استخدم لغة مبيعات واضحة، لا تخترع أرقام موديل أو شهادات. أنشئ:
- اسم تجاري قصير وواضح بالعربية والإنجليزية
- وصف قصير (سطر واحد) بالعربية والإنجليزية
- وصف تفصيلي (3-5 فقرات) بالعربية والإنجليزية
- محتوى تسويقي يبرز الفوائد
- محتوى فني يشرح الخصائص والمواصفات
- معلومات الضمان المعتادة لهذا النوع
- وسوم وكلمات بحث ذات صلة
- اقتراح عائلة GPC والقطاع المناسب`;

    const userPrompt = `الكلمات المفتاحية: ${data.keywords}
${data.itemType ? `نوع البند: ${data.itemType}` : ""}
${data.sector ? `القطاع: ${data.sector}` : ""}
${data.gpcFamily ? `العائلة المقترحة: ${data.gpcFamily}` : ""}

أنشئ محتوى احترافي كامل.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_product_content",
              description: "تقديم محتوى المنتج المُنشأ",
              parameters: {
                type: "object",
                properties: {
                  name_ar: { type: "string", description: "الاسم التجاري بالعربية" },
                  name_en: { type: "string", description: "Commercial name in English" },
                  short_description_ar: { type: "string" },
                  short_description_en: { type: "string" },
                  description_ar: { type: "string" },
                  description_en: { type: "string" },
                  marketing_content: { type: "string" },
                  technical_content: { type: "string" },
                  warranty_info: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  search_keywords: { type: "array", items: { type: "string" } },
                  gpc_family: { type: "string" },
                  sector_ar: { type: "string" },
                },
                required: ["name_ar", "name_en", "short_description_ar", "description_ar"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_product_content" } },
      }),
    });

    if (res.status === 429) throw new Error("تم تجاوز حد الطلبات، حاول لاحقاً");
    if (res.status === 402) throw new Error("نفذ رصيد AI، يرجى إضافة رصيد");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);

    const json = await res.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("لم يُرجع المساعد محتوى");
    try {
      return JSON.parse(args) as GeneratedContent;
    } catch {
      throw new Error("تعذر تحليل محتوى المساعد");
    }
  });
