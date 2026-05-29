import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Critical fields whose absence forces `content_incomplete`
const CRITICAL_FIELDS = [
  "name_ar",
  "description_ar",
  "unit_id",
  "category_id",
  "family_id",
] as const;

// Soft fields whose absence triggers `needs_review`
const SOFT_FIELDS = [
  "name_en",
  "description_en",
  "short_description_ar",
  "short_description_en",
  "marketing_content",
  "technical_content",
  "warranty_info",
  "gpc_segment",
  "gpc_family",
  "gpc_class",
  "gs1_gpc_brick",
  "tags",
  "search_keywords",
] as const;

const FIELD_LABELS: Record<string, string> = {
  name_ar: "الاسم بالعربية",
  name_en: "الاسم بالإنجليزية",
  description_ar: "الوصف بالعربية",
  description_en: "الوصف بالإنجليزية",
  short_description_ar: "وصف مختصر (عربي)",
  short_description_en: "وصف مختصر (إنجليزي)",
  marketing_content: "المحتوى التسويقي",
  technical_content: "المحتوى الفني",
  warranty_info: "معلومات الضمان",
  unit_id: "وحدة القياس",
  category_id: "الفئة",
  family_id: "العائلة",
  gpc_segment: "GPC Segment",
  gpc_family: "GPC Family",
  gpc_class: "GPC Class",
  gs1_gpc_brick: "GS1 GPC Brick",
  tags: "الوسوم",
  search_keywords: "كلمات البحث",
};

interface AISuggestions {
  short_description_ar?: string;
  short_description_en?: string;
  marketing_content?: string;
  technical_content?: string;
  tags?: string[];
  search_keywords?: string[];
  quality_score?: number;
  notes?: string;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

async function callLovableAI(product: Record<string, unknown>): Promise<AISuggestions> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `أنت مدقق محتوى لكتالوج منتجات صناعية (شركة العزب). مهمتك مراجعة بيانات منتج واقتراح تحسينات للحقول الناقصة أو الضعيفة. أعد JSON فقط عبر tool call.`;
  const userPrompt = `بيانات البند:\n${JSON.stringify(
    {
      az_code: product.az_code,
      name_ar: product.name_ar,
      name_en: product.name_en,
      description_ar: product.description_ar,
      description_en: product.description_en,
      short_description_ar: product.short_description_ar,
      short_description_en: product.short_description_en,
      item_type: product.item_type,
      gpc_family: product.gpc_family,
      tags: product.tags,
    },
    null,
    2,
  )}\n\nاقترح تحسينات للحقول الناقصة فقط. لا تختلق معلومات تقنية لا تعرفها.`;

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
            name: "submit_review",
            description: "تقديم مراجعة المحتوى للمنتج",
            parameters: {
              type: "object",
              properties: {
                short_description_ar: {
                  type: "string",
                  description: "وصف مختصر مقترح بالعربية (1-2 جملة)",
                },
                short_description_en: {
                  type: "string",
                  description: "Suggested short description in English",
                },
                marketing_content: { type: "string", description: "نص تسويقي مقترح (فقرة قصيرة)" },
                technical_content: { type: "string", description: "نص فني مقترح إن أمكن استنتاجه" },
                tags: { type: "array", items: { type: "string" }, description: "وسوم مقترحة" },
                search_keywords: {
                  type: "array",
                  items: { type: "string" },
                  description: "كلمات بحث مقترحة",
                },
                quality_score: {
                  type: "number",
                  description: "تقييم جودة المحتوى الحالي من 0 إلى 100",
                },
                notes: { type: "string", description: "ملاحظات للمراجع البشري" },
              },
              required: ["quality_score", "notes"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "submit_review" } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    return { quality_score: 0, notes: "تعذر الحصول على اقتراحات من المراجع الذكي" };
  }
  try {
    return JSON.parse(toolCall.function.arguments) as AISuggestions;
  } catch {
    return { quality_score: 0, notes: "ردّ غير صالح من المراجع الذكي" };
  }
}

export const reviewProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; useAI?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", data.productId)
      .single();
    if (error || !product) throw new Error("البند غير موجود");

    const missingCritical = CRITICAL_FIELDS.filter((f) =>
      isEmpty((product as Record<string, unknown>)[f]),
    );
    const missingSoft = SOFT_FIELDS.filter((f) => isEmpty((product as Record<string, unknown>)[f]));

    let aiSuggestions: AISuggestions | null = null;
    if (data.useAI !== false) {
      try {
        aiSuggestions = await callLovableAI(product as Record<string, unknown>);
      } catch (e) {
        aiSuggestions = { quality_score: 0, notes: `خطأ AI: ${(e as Error).message}` };
      }
    }

    // Status governance
    let newStatus: string | null = null;
    const currentStatus = product.status as string;
    if (missingCritical.length > 0) {
      if (currentStatus !== "content_incomplete" && currentStatus !== "approved") {
        newStatus = "content_incomplete";
      }
    } else if (missingSoft.length >= 4 || (aiSuggestions?.quality_score ?? 100) < 50) {
      if (currentStatus === "draft" || currentStatus === "content_incomplete") {
        newStatus = "needs_review";
      }
    }

    if (newStatus && newStatus !== currentStatus) {
      await supabase
        .from("products")
        .update({ status: newStatus as never })
        .eq("id", product.id);
    }

    // Audit
    await supabase.from("audit_logs").insert({
      entity_type: "product",
      entity_id: product.id,
      action: "AI_REVIEW",
      old_value: { status: currentStatus },
      new_value: {
        missing_critical: missingCritical,
        missing_soft: missingSoft,
        quality_score: aiSuggestions?.quality_score,
        new_status: newStatus ?? currentStatus,
      },
    });

    return {
      productId: product.id,
      azCode: product.az_code,
      previousStatus: currentStatus,
      newStatus: newStatus ?? currentStatus,
      missingCritical: missingCritical.map((f) => ({ field: f, label: FIELD_LABELS[f] ?? f })),
      missingSoft: missingSoft.map((f) => ({ field: f, label: FIELD_LABELS[f] ?? f })),
      suggestions: aiSuggestions,
    };
  });

export const applyAISuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; fields: Partial<AISuggestions> }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.fields)) {
      if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) {
        update[k] = v;
      }
    }
    if (Object.keys(update).length === 0) return { updated: false };
    const { error } = await supabase
      .from("products")
      .update(update as never)
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      entity_type: "product",
      entity_id: data.productId,
      action: "AI_SUGGESTIONS_APPLIED",
      new_value: update as never,
    });

    return { updated: true, fields: Object.keys(update) };
  });

export const scanAllForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const limit = Math.min(data.limit ?? 50, 200);
    const { data: products, error } = await supabase
      .from("products")
      .select(
        "id, az_code, name_ar, name_en, description_ar, description_en, short_description_ar, short_description_en, marketing_content, technical_content, warranty_info, unit_id, category_id, family_id, gpc_segment, gpc_family, gpc_class, gs1_gpc_brick, tags, search_keywords, status",
      )
      .in("status", ["draft", "needs_review", "content_incomplete"] as never)
      .limit(limit);
    if (error) throw new Error(error.message);

    let flaggedIncomplete = 0;
    let flaggedReview = 0;
    const updates: { id: string; status: string }[] = [];

    for (const p of products ?? []) {
      const rec = p as Record<string, unknown>;
      const missingCritical = CRITICAL_FIELDS.filter((f) => isEmpty(rec[f]));
      const missingSoft = SOFT_FIELDS.filter((f) => isEmpty(rec[f]));
      const current = rec.status as string;
      let next: string | null = null;
      if (missingCritical.length > 0 && current !== "content_incomplete") {
        next = "content_incomplete";
        flaggedIncomplete++;
      } else if (missingSoft.length >= 4 && current === "draft") {
        next = "needs_review";
        flaggedReview++;
      }
      if (next) updates.push({ id: rec.id as string, status: next });
    }

    for (const u of updates) {
      await supabase
        .from("products")
        .update({ status: u.status as never })
        .eq("id", u.id);
    }

    await supabase.from("audit_logs").insert({
      entity_type: "products",
      entity_id: null,
      action: "AI_BULK_REVIEW",
      new_value: {
        scanned: products?.length ?? 0,
        flagged_incomplete: flaggedIncomplete,
        flagged_review: flaggedReview,
      },
    });

    return {
      scanned: products?.length ?? 0,
      flaggedIncomplete,
      flaggedReview,
      updates: updates.length,
    };
  });
