/**
 * Alazab PAOP AI Assistant - Azure OpenAI Integration
 *
 * This module provides the AI assistant functionality for the application
 * using Azure OpenAI custom fine-tuned model.
 */

import { supabase } from "@/integrations/supabase/client";

// Types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    products?: string[];
    suppliers?: string[];
    action?: string;
  };
}

export interface AIToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIResponse {
  content: string;
  toolCalls?: AIToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// System prompt for the AI assistant
const SYSTEM_PROMPT = `انت مساعد ذكي متخصص في منصة Alazab PAOP لادارة كتالوج المنتجات والخدمات.

## قدراتك:
1. البحث في المنتجات والخدمات
2. استعراض تفاصيل التسعير
3. معلومات الموردين
4. المساعدة في التصنيف GPC/GS1
5. شرح العمليات والاجراءات

## قواعد مهمة:
- اجب دائما باللغة العربية
- كن دقيقا ومختصرا
- استخدم الادوات المتاحة للبحث في البيانات الحقيقية
- اذا لم تجد معلومات، اعترف بذلك

## انواع البنود:
product, service, work_item, material, tool, spare_part, finish_item, custom_unit, supplier_item, package, bundle

## حالات البنود:
draft, needs_review, approved, rejected, archived`;

// Tool definitions for function calling
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_products",
      description: "البحث في المنتجات والبنود حسب الاسم او الكود او الوصف",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "نص البحث",
          },
          item_type: {
            type: "string",
            enum: ["product", "service", "work_item", "material", "tool", "spare_part"],
            description: "نوع البند (اختياري)",
          },
          status: {
            type: "string",
            enum: ["draft", "needs_review", "approved", "rejected", "archived"],
            description: "حالة البند (اختياري)",
          },
          limit: {
            type: "number",
            description: "عدد النتائج (افتراضي 10)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_product_details",
      description: "الحصول على تفاصيل منتج محدد بالكود او المعرف",
      parameters: {
        type: "object",
        properties: {
          az_code: {
            type: "string",
            description: "كود AZ للبند",
          },
          product_id: {
            type: "string",
            description: "معرف البند UUID",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_price_info",
      description: "الحصول على معلومات التسعير لمنتج محدد",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "معرف المنتج",
          },
          az_code: {
            type: "string",
            description: "كود AZ للمنتج",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_suppliers",
      description: "البحث في الموردين",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "اسم المورد او جزء منه",
          },
          tier: {
            type: "string",
            enum: ["first_tier", "second_tier", "backup", "local", "imported"],
            description: "مستوى المورد (اختياري)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_statistics",
      description: "الحصول على احصائيات النظام",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["products", "suppliers", "prices", "all"],
            description: "نوع الاحصائيات",
          },
        },
      },
    },
  },
];

// Tool implementations
async function executeToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
  switch (toolName) {
    case "search_products": {
      const {
        query,
        item_type,
        status,
        limit = 10,
      } = args as {
        query: string;
        item_type?: string;
        status?: string;
        limit?: number;
      };

      let queryBuilder = supabase
        .from("products")
        .select("id, az_code, name_ar, item_type, status, gpc_family, confidence_level")
        .or(`name_ar.ilike.%${query}%,az_code.ilike.%${query}%,description_ar.ilike.%${query}%`)
        .limit(limit);

      if (item_type) queryBuilder = queryBuilder.eq("item_type", item_type as any);
      if (status) queryBuilder = queryBuilder.eq("status", status as any);

      const { data, error } = await queryBuilder;

      if (error) return `خطا في البحث: ${error.message}`;
      if (!data?.length) return `لم يتم العثور على نتائج للبحث: "${query}"`;

      return `تم العثور على ${data.length} نتيجة:\n\n${data
        .map(
          (p) =>
            `- **${p.name_ar}** (${p.az_code})\n  النوع: ${p.item_type} | الحالة: ${p.status} | العائلة: ${p.gpc_family || "غير محدد"}`,
        )
        .join("\n\n")}`;
    }

    case "get_product_details": {
      const { az_code, product_id } = args as {
        az_code?: string;
        product_id?: string;
      };

      let queryBuilder = supabase.from("products").select(`
          *,
          suppliers:default_supplier_id(name, supplier_tier, phone, email),
          prices!prices_product_id_fkey(
            purchase_price, selling_price, retail_price, currency, status
          )
        `);

      if (az_code) queryBuilder = queryBuilder.eq("az_code", az_code);
      else if (product_id) queryBuilder = queryBuilder.eq("id", product_id);
      else return "يجب تحديد كود AZ او معرف المنتج";

      const { data, error } = await queryBuilder.single();

      if (error) return `خطا: ${error.message}`;
      if (!data) return "لم يتم العثور على المنتج";

      const statusLabels: Record<string, string> = {
        draft: "مسودة",
        needs_review: "يحتاج مراجعة",
        approved: "معتمد",
        rejected: "مرفوض",
        archived: "مؤرشف",
      };

      const typeLabels: Record<string, string> = {
        product: "منتج",
        service: "خدمة",
        work_item: "بند عمل",
        material: "مادة",
        tool: "اداة",
        spare_part: "قطعة غيار",
      };

      return `## ${data.name_ar} (${data.az_code})

**المعلومات الاساسية:**
- النوع: ${typeLabels[data.item_type] || data.item_type}
- الحالة: ${statusLabels[data.status] || data.status}
- مستوى الثقة: ${data.confidence_level || "غير محدد"}

**التصنيف:**
- القطاع: ${data.gpc_segment || "غير محدد"}
- العائلة: ${data.gpc_family || "غير محدد"}
- الفئة: ${data.gpc_class || "غير محدد"}

${data.description_ar ? `**الوصف:**\n${data.description_ar}` : ""}

${
  data.suppliers
    ? `**المورد الافتراضي:**\n- الاسم: ${data.suppliers.name}\n- المستوى: ${data.suppliers.supplier_tier}\n- الهاتف: ${data.suppliers.phone || "غير متوفر"}`
    : ""
}

${
  data.prices?.[0]
    ? `**التسعير:**\n- سعر الشراء: ${data.prices[0].purchase_price || "غير محدد"} ${data.prices[0].currency || "SAR"}\n- سعر البيع: ${data.prices[0].selling_price || "غير محدد"} ${data.prices[0].currency || "SAR"}`
    : ""
}`;
    }

    case "get_price_info": {
      const { product_id, az_code } = args as {
        product_id?: string;
        az_code?: string;
      };

      let productIdToUse = product_id;

      if (az_code && !product_id) {
        const { data: product } = await supabase
          .from("products")
          .select("id, name_ar")
          .eq("az_code", az_code)
          .single();
        if (product) productIdToUse = product.id;
      }

      if (!productIdToUse) return "لم يتم العثور على المنتج";

      const { data: prices, error } = await supabase
        .from("prices")
        .select(
          `
          *,
          suppliers:supplier_id(name)
        `,
        )
        .eq("product_id", productIdToUse)
        .order("created_at", { ascending: false });

      if (error) return `خطا: ${error.message}`;
      if (!prices?.length) return "لا توجد اسعار مسجلة لهذا المنتج";

      return `## اسعار المنتج

${prices
  .map(
    (p) => `**من ${p.suppliers?.name || "غير محدد"}:**
- سعر الشراء: ${p.purchase_price || "-"} ${p.currency || "SAR"}
- سعر البيع: ${p.selling_price || "-"} ${p.currency || "SAR"}
- سعر التجزئة: ${p.retail_price || "-"} ${p.currency || "SAR"}
- سعر الجملة: ${p.wholesale_price || "-"} ${p.currency || "SAR"}
- هامش الربح: ${p.margin_percent ? `${p.margin_percent}%` : "-"}
- الحالة: ${p.status || "غير محدد"}`,
  )
  .join("\n\n")}`;
    }

    case "search_suppliers": {
      const { query, tier } = args as { query: string; tier?: string };

      let queryBuilder = supabase
        .from("suppliers")
        .select("id, name, supplier_tier, supplier_type, rating, status, phone, email")
        .ilike("name", `%${query}%`)
        .limit(10);

      if (tier) queryBuilder = queryBuilder.eq("supplier_tier", tier as any);

      const { data, error } = await queryBuilder;

      if (error) return `خطا: ${error.message}`;
      if (!data?.length) return `لم يتم العثور على موردين بالاسم: "${query}"`;

      const tierLabels: Record<string, string> = {
        first_tier: "الدرجة الاولى",
        second_tier: "الدرجة الثانية",
        backup: "احتياطي",
        local: "محلي",
        imported: "مستورد",
      };

      return `تم العثور على ${data.length} مورد:\n\n${data
        .map(
          (s) =>
            `- **${s.name}**\n  المستوى: ${tierLabels[s.supplier_tier || ""] || "غير محدد"} | التقييم: ${s.rating ? `${s.rating}/5` : "غير مقيم"} | الهاتف: ${s.phone || "غير متوفر"}`,
        )
        .join("\n\n")}`;
    }

    case "get_statistics": {
      const { type = "all" } = args as { type?: string };

      const stats: Record<string, unknown> = {};

      if (type === "all" || type === "products") {
        const { count: totalProducts } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true });
        const { count: approved } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("status", "approved");
        const { count: draft } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("status", "draft");

        stats.products = { total: totalProducts, approved, draft };
      }

      if (type === "all" || type === "suppliers") {
        const { count: totalSuppliers } = await supabase
          .from("suppliers")
          .select("*", { count: "exact", head: true });
        stats.suppliers = { total: totalSuppliers };
      }

      if (type === "all" || type === "prices") {
        const { count: totalPrices } = await supabase
          .from("prices")
          .select("*", { count: "exact", head: true });
        stats.prices = { total: totalPrices };
      }

      return `## احصائيات النظام

${stats.products ? `**المنتجات:**\n- الاجمالي: ${(stats.products as any).total}\n- معتمدة: ${(stats.products as any).approved}\n- مسودات: ${(stats.products as any).draft}` : ""}

${stats.suppliers ? `**الموردون:**\n- الاجمالي: ${(stats.suppliers as any).total}` : ""}

${stats.prices ? `**سجلات التسعير:**\n- الاجمالي: ${(stats.prices as any).total}` : ""}`;
    }

    default:
      return `اداة غير معروفة: ${toolName}`;
  }
}

// Main chat function
export async function sendChatMessage(
  messages: ChatMessage[],
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void,
): Promise<AIResponse> {
  const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
  const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
  const deploymentName =
    import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME || "alazab-paop-assistant";
  const apiVersion = import.meta.env.VITE_AZURE_OPENAI_API_VERSION || "2024-02-01";

  if (!endpoint || !apiKey) {
    // Fallback to demo mode
    return {
      content: "عذرا، لم يتم تكوين Azure OpenAI بعد. يرجى اضافة متغيرات البيئة المطلوبة.",
    };
  }

  const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: apiMessages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error("No response from Azure OpenAI");
    }

    // Handle tool calls
    if (choice.message.tool_calls?.length) {
      const toolResults: string[] = [];

      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        onToolCall?.(toolName, args);

        const result = await executeToolCall(toolName, args);
        toolResults.push(result);
      }

      // Make a follow-up call with tool results
      const followUpMessages = [
        ...apiMessages,
        choice.message,
        ...choice.message.tool_calls.map((tc: any, i: number) => ({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResults[i],
        })),
      ];

      const followUpResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          messages: followUpMessages,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      const followUpData = await followUpResponse.json();
      const finalContent = followUpData.choices?.[0]?.message?.content || "";

      return {
        content: finalContent,
        toolCalls: choice.message.tool_calls.map((tc: any) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
        usage: followUpData.usage,
      };
    }

    return {
      content: choice.message.content || "",
      usage: data.usage,
    };
  } catch (error) {
    console.error("AI Assistant Error:", error);
    throw error;
  }
}

// Export types and utilities
export { TOOLS, SYSTEM_PROMPT };
