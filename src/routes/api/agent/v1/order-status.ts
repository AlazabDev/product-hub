/**
 * Alazab PAOP - Order Status API
 * API لمتابعة حالة الطلبات
 */

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS, json, logCall, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/agent/v1/order-status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const started = Date.now();
        const auth = await requireApiKey(request, "/api/agent/v1/order-status");
        if ("error" in auth) return auth.error;

        const url = new URL(request.url);
        const orderId = url.searchParams.get("order_id");
        const orderNumber = url.searchParams.get("order_number");
        const customerId = url.searchParams.get("customer_id");

        if (!orderId && !orderNumber && !customerId) {
          return json(
            {
              success: false,
              error: "Missing order_id, order_number, or customer_id",
            },
            400,
          );
        }

        let query = supabaseAdmin.from("manufacturing_orders").select(`
            *,
            quote_requests(request_id, design_preview_url),
            material_requisitions(id, requisition_number, status)
          `);

        if (orderId) {
          query = query.eq("id", orderId);
        } else if (orderNumber) {
          query = query.eq("order_number", orderNumber);
        } else if (customerId) {
          query = query.eq("customer_id", customerId).order("created_at", { ascending: false });
        }

        const { data, error } = orderId || orderNumber ? await query.maybeSingle() : await query;

        if (error) {
          return json({ success: false, error: error.message }, 500);
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
          return json({ success: false, error: "Order not found" }, 404);
        }

        await logCall({
          consumer: auth.consumer,
          request,
          endpoint: "/api/agent/v1/order-status",
          status: 200,
          startedAt: started,
        });

        const formatOrder = (order: any) => ({
          order_id: order.id,
          order_number: order.order_number,
          status: order.status,
          status_ar: getStatusArabic(order.status),
          priority: order.priority,
          dates: {
            created: order.created_at,
            estimated_start: order.estimated_start_date,
            estimated_completion: order.estimated_completion_date,
            actual_start: order.actual_start_date,
            actual_completion: order.actual_completion_date,
            delivery: order.delivery_date,
          },
          pricing: {
            unit_price: order.unit_price,
            quantity: order.quantity,
            total_price: order.total_price,
            discount: order.discount_amount,
            final_price: order.final_price,
            currency: order.currency,
          },
          payment: {
            status: order.payment_status,
            amount_paid: order.amount_paid,
            remaining: order.final_price - order.amount_paid,
          },
          materials: order.material_requisitions?.[0]
            ? {
                requisition_number: order.material_requisitions[0].requisition_number,
                status: order.material_requisitions[0].status,
              }
            : null,
          design_preview: order.quote_requests?.design_preview_url,
        });

        return json({
          success: true,
          data: Array.isArray(data) ? data.map(formatOrder) : formatOrder(data),
        });
      },

      // PATCH - تحديث حالة الطلب (للاستخدام الداخلي)
      PATCH: async ({ request }) => {
        const started = Date.now();
        const auth = await requireApiKey(request, "/api/agent/v1/order-status");
        if ("error" in auth) return auth.error;

        try {
          const body = await request.json();

          if (!body.order_id && !body.order_number) {
            return json({ success: false, error: "Missing order_id or order_number" }, 400);
          }

          const updates: any = {};
          if (body.status) updates.status = body.status;
          if (body.actual_start_date) updates.actual_start_date = body.actual_start_date;
          if (body.actual_completion_date)
            updates.actual_completion_date = body.actual_completion_date;
          if (body.delivery_date) updates.delivery_date = body.delivery_date;
          if (body.payment_status) updates.payment_status = body.payment_status;
          if (body.amount_paid !== undefined) updates.amount_paid = body.amount_paid;
          if (body.production_notes) updates.production_notes = body.production_notes;
          if (body.quality_notes) updates.quality_notes = body.quality_notes;
          if (body.delivery_notes) updates.delivery_notes = body.delivery_notes;

          let query = supabaseAdmin.from("manufacturing_orders").update(updates);
          if (body.order_id) {
            query = query.eq("id", body.order_id);
          } else {
            query = query.eq("order_number", body.order_number);
          }

          const { data, error } = await query.select().single();

          if (error) {
            return json({ success: false, error: error.message }, 500);
          }

          // ارسال اشعار للشات بوت اذا تغيرت الحالة
          if (body.status && body.notify_customer) {
            await supabaseAdmin.from("chatbot_interactions").insert({
              manufacturing_order_id: data.id,
              interaction_type: "status_update",
              direction: "outbound",
              payload: {
                order_number: data.order_number,
                new_status: data.status,
                message_ar: `تم تحديث حالة طلبكم ${data.order_number} الى: ${getStatusArabic(data.status)}`,
              },
              status: "pending",
            });
          }

          await logCall({
            consumer: auth.consumer,
            request,
            endpoint: "/api/agent/v1/order-status",
            status: 200,
            startedAt: started,
          });

          return json({
            success: true,
            data: {
              order_id: data.id,
              order_number: data.order_number,
              status: data.status,
              updated_at: data.updated_at,
            },
          });
        } catch (err) {
          return json({ success: false, error: "Internal server error" }, 500);
        }
      },
    },
  },
});

function getStatusArabic(status: string): string {
  const statusMap: Record<string, string> = {
    pending: "قيد الانتظار",
    materials_requested: "طلب الخامات",
    in_production: "قيد التصنيع",
    quality_check: "فحص الجودة",
    ready: "جاهز للتسليم",
    delivered: "تم التسليم",
    cancelled: "ملغي",
  };
  return statusMap[status] || status;
}
