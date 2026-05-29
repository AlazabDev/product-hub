/**
 * Alazab PAOP - Chatbot Agent API
 * نقطة نهاية استقبال طلبات التسعير من الشات بوت
 * 
 * POST /api/agent/v1/quote-request
 * - استقبال ملف التصميم وبيانات العميل
 * - تحليل المكونات والخامات
 * - حساب التسعير
 * - ارجاع عرض السعر
 */

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS, json, logCall, requireApiKey } from "@/lib/api-auth";
import { calculateQuotePrice, type DesignData } from "@/lib/pricing-engine";

export const Route = createFileRoute("/api/agent/v1/quote-request")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      
      // POST - استقبال طلب تسعير جديد
      POST: async ({ request }) => {
        const started = Date.now();
        const auth = await requireApiKey(request);
        if ("error" in auth) {
          await logCall({ 
            consumer: null, 
            request, 
            endpoint: "/api/agent/v1/quote-request", 
            status: 401, 
            startedAt: started, 
            error: "auth" 
          });
          return auth.error;
        }

        try {
          const body = await request.json();
          
          // التحقق من البيانات المطلوبة
          if (!body.request_id || !body.design_data) {
            return json({ 
              success: false, 
              error: "Missing required fields: request_id, design_data" 
            }, 400);
          }

          const designData: DesignData = body.design_data;
          
          // حساب التسعير
          const pricing = await calculateQuotePrice(designData, body.quantity || 1);
          
          // انشاء سجل الطلب
          const quoteRequest = {
            request_id: body.request_id,
            chatbot_session_id: body.session_id,
            customer_id: body.customer_id,
            customer_name: body.customer_name,
            customer_phone: body.customer_phone,
            customer_email: body.customer_email,
            design_file_url: body.design_file_url,
            design_file_type: body.design_file_type || "json",
            design_data: designData,
            design_preview_url: body.design_preview_url,
            dimensions: designData.dimensions as never,
            materials: pricing.materials_breakdown as never,
            components: designData.components as never,
            finishes: (designData.finishes ?? null) as never,
            accessories: (designData.accessories ?? null) as never,
            pricing_breakdown: pricing.breakdown as never,
            materials_cost: pricing.materials_cost,
            labor_cost: pricing.labor_cost,
            overhead_cost: pricing.overhead_cost,
            profit_margin: pricing.profit_margin,
            total_cost: pricing.total_cost,
            selling_price: pricing.selling_price,
            currency: body.currency || "SAR",
            status: "quoted",
            quoted_at: new Date().toISOString(),
            quote_valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            customer_notes: body.customer_notes,
            special_requirements: body.special_requirements as never,
          };

          const { data, error } = await supabaseAdmin
            .from("quote_requests")
            .insert(quoteRequest as never)
            .select()
            .single();

          if (error) {
            console.error("Failed to create quote request:", error);
            await logCall({ 
              consumer: auth.consumer, 
              request, 
              endpoint: "/api/agent/v1/quote-request", 
              status: 500, 
              startedAt: started, 
              error: error.message 
            });
            return json({ success: false, error: "Failed to create quote" }, 500);
          }

          // تسجيل التفاعل
          await supabaseAdmin.from("chatbot_interactions").insert({
            quote_request_id: data.id,
            interaction_type: "quote_sent",
            direction: "outbound",
            payload: body as never,
            response_payload: {
              quote_id: data.id,
              pricing: pricing as unknown,
            } as never,
            status: "sent",
            sent_at: new Date().toISOString(),
          });

          await logCall({ 
            consumer: auth.consumer, 
            request, 
            endpoint: "/api/agent/v1/quote-request", 
            status: 200, 
            startedAt: started,
            payload: { request_id: body.request_id }
          });

          // ارجاع عرض السعر للشات بوت
          return json({
            success: true,
            data: {
              quote_id: data.id,
              request_id: data.request_id,
              pricing: {
                materials_cost: pricing.materials_cost,
                labor_cost: pricing.labor_cost,
                overhead_cost: pricing.overhead_cost,
                subtotal: pricing.total_cost,
                profit_margin_percent: pricing.profit_margin,
                selling_price: pricing.selling_price,
                currency: data.currency,
                breakdown: pricing.breakdown,
              },
              validity: {
                quoted_at: data.quoted_at,
                valid_until: data.quote_valid_until,
              },
              message_ar: `عرض السعر: ${pricing.selling_price.toLocaleString()} ${data.currency}`,
              message_en: `Quote: ${pricing.selling_price.toLocaleString()} ${data.currency}`,
            }
          });

        } catch (err) {
          console.error("Quote request error:", err);
          await logCall({ 
            consumer: auth.consumer, 
            request, 
            endpoint: "/api/agent/v1/quote-request", 
            status: 500, 
            startedAt: started, 
            error: String(err) 
          });
          return json({ success: false, error: "Internal server error" }, 500);
        }
      },

      // GET - الحصول على حالة طلب
      GET: async ({ request }) => {
        const started = Date.now();
        const auth = await requireApiKey(request);
        if ("error" in auth) return auth.error;

        const url = new URL(request.url);
        const requestId = url.searchParams.get("request_id");
        const quoteId = url.searchParams.get("quote_id");

        if (!requestId && !quoteId) {
          return json({ success: false, error: "Missing request_id or quote_id" }, 400);
        }

        let query = supabaseAdmin.from("quote_requests").select("*");
        if (quoteId) {
          query = query.eq("id", quoteId);
        } else if (requestId) {
          query = query.eq("request_id", requestId);
        }

        const { data, error } = await query.maybeSingle();

        if (error || !data) {
          return json({ success: false, error: "Quote not found" }, 404);
        }

        await logCall({ 
          consumer: auth.consumer, 
          request, 
          endpoint: "/api/agent/v1/quote-request", 
          status: 200, 
          startedAt: started 
        });

        return json({
          success: true,
          data: {
            quote_id: data.id,
            request_id: data.request_id,
            status: data.status,
            customer_response: data.customer_response,
            pricing: {
              selling_price: data.selling_price,
              currency: data.currency,
            },
            validity: {
              quoted_at: data.quoted_at,
              valid_until: data.quote_valid_until,
            },
          }
        });
      },
    },
  },
});
