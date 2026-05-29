/**
 * Alazab PAOP - Customer Response API
 * معالجة رد العميل على عرض السعر
 * 
 * POST /api/agent/v1/quote-response
 * - استقبال رد العميل (قبول/رفض)
 * - في حالة القبول: انشاء امر تصنيع + امر صرف خامات
 */

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS, json, logCall, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/agent/v1/quote-response")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      
      POST: async ({ request }) => {
        const started = Date.now();
        const auth = await requireApiKey(request);
        if ("error" in auth) {
          await logCall({ 
            consumer: null, 
            request, 
            endpoint: "/api/agent/v1/quote-response", 
            status: 401, 
            startedAt: started, 
            error: "auth" 
          });
          return auth.error;
        }

        try {
          const body = await request.json();
          
          // التحقق من البيانات
          if (!body.quote_id && !body.request_id) {
            return json({ 
              success: false, 
              error: "Missing quote_id or request_id" 
            }, 400);
          }

          if (!body.response || !["accepted", "rejected"].includes(body.response)) {
            return json({ 
              success: false, 
              error: "Invalid response. Must be 'accepted' or 'rejected'" 
            }, 400);
          }

          // جلب طلب العرض
          let query = supabaseAdmin.from("quote_requests").select("*");
          if (body.quote_id) {
            query = query.eq("id", body.quote_id);
          } else {
            query = query.eq("request_id", body.request_id);
          }

          const { data: quote, error: quoteError } = await query.maybeSingle();

          if (quoteError || !quote) {
            return json({ success: false, error: "Quote not found" }, 404);
          }

          // التحقق من صلاحية العرض
          if (quote.status !== "quoted") {
            return json({ 
              success: false, 
              error: `Quote already ${quote.status}` 
            }, 400);
          }

          if (new Date(quote.quote_valid_until) < new Date()) {
            await supabaseAdmin
              .from("quote_requests")
              .update({ status: "expired" })
              .eq("id", quote.id);
            return json({ success: false, error: "Quote has expired" }, 400);
          }

          // تحديث حالة العرض
          await supabaseAdmin
            .from("quote_requests")
            .update({
              customer_response: body.response,
              customer_response_at: new Date().toISOString(),
              status: body.response === "accepted" ? "accepted" : "rejected",
              rejection_reason: body.rejection_reason,
            })
            .eq("id", quote.id);

          // تسجيل التفاعل
          await supabaseAdmin.from("chatbot_interactions").insert({
            quote_request_id: quote.id,
            interaction_type: body.response === "accepted" ? "customer_accepted" : "customer_rejected",
            direction: "inbound",
            payload: body,
            status: "delivered",
            delivered_at: new Date().toISOString(),
          });

          // في حالة القبول - انشاء امر تصنيع
          if (body.response === "accepted") {
            // توليد رقم الامر
            const { data: orderNum } = await supabaseAdmin.rpc("generate_order_number");
            const orderNumber = orderNum || `MO-${new Date().getFullYear()}-${Date.now()}`;

            // انشاء امر التصنيع
            const manufacturingOrder = {
              quote_request_id: quote.id,
              order_number: orderNumber,
              customer_id: quote.customer_id,
              customer_name: quote.customer_name,
              customer_phone: quote.customer_phone,
              delivery_address: body.delivery_address,
              design_data: quote.design_data,
              specifications: {
                dimensions: quote.dimensions,
                materials: quote.materials,
                components: quote.components,
                finishes: quote.finishes,
                accessories: quote.accessories,
              },
              quantity: body.quantity || 1,
              unit_price: quote.selling_price,
              total_price: quote.selling_price * (body.quantity || 1),
              discount_percent: body.discount_percent || 0,
              discount_amount: body.discount_amount || 0,
              final_price: (quote.selling_price * (body.quantity || 1)) - (body.discount_amount || 0),
              currency: quote.currency,
              estimated_start_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // بعد يومين
              estimated_completion_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // بعد اسبوعين
              status: "pending",
              priority: body.priority || "normal",
              production_notes: body.production_notes,
            };

            const { data: order, error: orderError } = await supabaseAdmin
              .from("manufacturing_orders")
              .insert(manufacturingOrder)
              .select()
              .single();

            if (orderError) {
              console.error("Failed to create manufacturing order:", orderError);
              return json({ 
                success: false, 
                error: "Failed to create manufacturing order" 
              }, 500);
            }

            // انشاء امر صرف الخامات
            const { data: reqNum } = await supabaseAdmin.rpc("generate_requisition_number");
            const requisitionNumber = reqNum || `MR-${new Date().getFullYear()}-${Date.now()}`;

            const { data: requisition, error: reqError } = await supabaseAdmin
              .from("material_requisitions")
              .insert({
                manufacturing_order_id: order.id,
                requisition_number: requisitionNumber,
                status: "pending",
                notes: `صرف خامات لامر التصنيع ${orderNumber}`,
              })
              .select()
              .single();

            if (reqError) {
              console.error("Failed to create material requisition:", reqError);
            }

            // اضافة تفاصيل الخامات
            if (requisition && quote.materials) {
              const materials = quote.materials as any[];
              const items = materials.map((mat: any) => ({
                requisition_id: requisition.id,
                product_id: mat.product_id,
                product_code: mat.material_code,
                product_name: mat.material_name,
                requested_quantity: mat.quantity,
                unit: mat.unit,
                unit_cost: mat.unit_cost,
                total_cost: mat.total_cost,
                supplier_id: mat.supplier_id,
                supplier_name: mat.supplier_name,
                status: "pending",
              }));

              if (items.length > 0) {
                await supabaseAdmin.from("material_requisition_items").insert(items);
              }
            }

            // تسجيل تفاعل انشاء الامر
            await supabaseAdmin.from("chatbot_interactions").insert({
              quote_request_id: quote.id,
              manufacturing_order_id: order.id,
              interaction_type: "order_confirmed",
              direction: "outbound",
              payload: {
                order_number: orderNumber,
                requisition_number: requisitionNumber,
              },
              status: "sent",
              sent_at: new Date().toISOString(),
            });

            await logCall({ 
              consumer: auth.consumer, 
              request, 
              endpoint: "/api/agent/v1/quote-response", 
              status: 200, 
              startedAt: started,
              payload: { quote_id: quote.id, response: "accepted" }
            });

            return json({
              success: true,
              data: {
                quote_id: quote.id,
                response: "accepted",
                manufacturing_order: {
                  order_id: order.id,
                  order_number: orderNumber,
                  status: order.status,
                  estimated_completion: order.estimated_completion_date,
                  final_price: order.final_price,
                  currency: order.currency,
                },
                material_requisition: requisition ? {
                  requisition_id: requisition.id,
                  requisition_number: requisitionNumber,
                  status: requisition.status,
                } : null,
                message_ar: `تم تاكيد الطلب برقم ${orderNumber}. سيتم البدء في التصنيع قريبا.`,
                message_en: `Order confirmed: ${orderNumber}. Manufacturing will begin soon.`,
              }
            });
          }

          // في حالة الرفض
          await logCall({ 
            consumer: auth.consumer, 
            request, 
            endpoint: "/api/agent/v1/quote-response", 
            status: 200, 
            startedAt: started,
            payload: { quote_id: quote.id, response: "rejected" }
          });

          return json({
            success: true,
            data: {
              quote_id: quote.id,
              response: "rejected",
              rejection_reason: body.rejection_reason,
              message_ar: "تم رفض العرض. نتمنى خدمتكم في المستقبل.",
              message_en: "Quote rejected. We hope to serve you in the future.",
            }
          });

        } catch (err) {
          console.error("Quote response error:", err);
          await logCall({ 
            consumer: auth.consumer, 
            request, 
            endpoint: "/api/agent/v1/quote-response", 
            status: 500, 
            startedAt: started, 
            error: String(err) 
          });
          return json({ success: false, error: "Internal server error" }, 500);
        }
      },
    },
  },
});
