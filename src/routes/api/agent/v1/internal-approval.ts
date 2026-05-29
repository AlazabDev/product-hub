/**
 * Alazab PAOP - Internal Approval Endpoint
 * POST /api/agent/v1/internal-approval
 *
 * This is the only place where Manufacturing Orders + Material Requisitions
 * are created. Triggered after an authorised internal user approves an
 * `accepted_pending_internal_approval` quote.
 *
 * Body:
 *   {
 *     approval_id: uuid,
 *     decision: "approved" | "rejected",
 *     notes?: string,
 *     decided_by?: uuid    // staff user id (audit only)
 *   }
 */

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS, json, logCall, requireApiKey } from "@/lib/api-auth";
import type { MaterialCost } from "@/lib/pricing-engine";

interface PricingSnapshot {
  materials_breakdown?: MaterialCost[];
  selling_price?: number;
  total_cost?: number;
}

export const Route = createFileRoute("/api/agent/v1/internal-approval")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const started = Date.now();
        const endpoint = "/api/agent/v1/internal-approval";
        const auth = await requireApiKey(request, "/api/agent/v1/internal-approval");
        if ("error" in auth) {
          await logCall({ consumer: null, request, endpoint, status: 401, startedAt: started, error: "auth" });
          return auth.error;
        }

        try {
          const body = await request.json();
          if (!body.approval_id || !body.decision || !["approved", "rejected"].includes(body.decision)) {
            return json(
              { success: false, error: "Missing approval_id or invalid decision", code: "invalid_input" },
              400,
            );
          }

          // Load approval
          const { data: approval, error: aErr } = await supabaseAdmin
            .from("approvals")
            .select("*")
            .eq("id", body.approval_id)
            .maybeSingle();
          if (aErr || !approval) {
            return json({ success: false, error: "Approval not found", code: "approval_not_found" }, 404);
          }
          if (approval.status !== "pending") {
            return json(
              { success: false, error: `Approval already ${approval.status}`, code: "invalid_approval_state" },
              400,
            );
          }
          if (approval.entity_type !== "quote_request") {
            return json(
              { success: false, error: "Approval is not for a quote_request", code: "wrong_entity_type" },
              400,
            );
          }

          const decidedAt = new Date().toISOString();
          const decidedBy = body.decided_by ?? null;

          // ---------- Rejected branch ----------
          if (body.decision === "rejected") {
            await supabaseAdmin
              .from("approvals")
              .update({
                status: "rejected",
                decided_at: decidedAt,
                decided_by: decidedBy,
                notes: body.notes ?? approval.notes ?? null,
              })
              .eq("id", approval.id);

            await supabaseAdmin
              .from("quote_requests")
              .update({ status: "rejected", rejection_reason: body.notes ?? "Internal rejection" })
              .eq("id", approval.entity_id);

            await logCall({
              consumer: auth.consumer,
              request,
              endpoint,
              status: 200,
              startedAt: started,
              payload: { approval_id: approval.id, decision: "rejected" },
            });

            return json({
              success: true,
              data: { approval_id: approval.id, decision: "rejected" },
            });
          }

          // ---------- Approved branch: create MO + MR ----------
          const { data: quote, error: qErr } = await supabaseAdmin
            .from("quote_requests")
            .select("*")
            .eq("id", approval.entity_id)
            .maybeSingle();
          if (qErr || !quote) {
            return json({ success: false, error: "Quote not found", code: "quote_not_found" }, 404);
          }

          const pricing = (quote.pricing_breakdown ?? {}) as PricingSnapshot;
          const unitPrice = Number(quote.selling_price ?? pricing.selling_price ?? 0);
          const qty = 1;

          const { data: orderNumberData } = await supabaseAdmin.rpc("generate_order_number");
          const orderNumber = orderNumberData ?? `MO-${Date.now()}`;

          const { data: mo, error: moErr } = await supabaseAdmin
            .from("manufacturing_orders")
            .insert({
              order_number: orderNumber,
              quote_request_id: quote.id,
              approval_id: approval.id,
              customer_id: quote.customer_id ?? null,
              customer_name: quote.customer_name ?? null,
              customer_phone: quote.customer_phone ?? null,
              design_data: quote.design_data ?? null,
              specifications: (quote.special_requirements ?? null) as never,
              quantity: qty,
              unit_price: unitPrice,
              total_price: unitPrice * qty,
              final_price: unitPrice * qty,
              currency: quote.currency ?? "SAR",
              status: "pending",
              priority: approval.priority ?? "normal",
            })
            .select()
            .single();

          if (moErr || !mo) {
            console.error("MO creation failed:", moErr);
            return json(
              { success: false, error: "Failed to create manufacturing order", code: "mo_create_failed" },
              500,
            );
          }

          // Create Material Requisition
          const { data: reqNumberData } = await supabaseAdmin.rpc("generate_requisition_number");
          const reqNumber = reqNumberData ?? `MR-${Date.now()}`;

          const { data: mr, error: mrErr } = await supabaseAdmin
            .from("material_requisitions")
            .insert({
              requisition_number: reqNumber,
              manufacturing_order_id: mo.id,
              approval_id: approval.id,
              status: "pending",
            })
            .select()
            .single();

          if (mrErr || !mr) {
            console.error("MR creation failed:", mrErr);
            return json(
              { success: false, error: "Failed to create material requisition", code: "mr_create_failed" },
              500,
            );
          }

          // Insert MR items from pricing snapshot
          const items = (pricing.materials_breakdown ?? []).map((m) => ({
            requisition_id: mr.id,
            product_id: m.product_id ?? null,
            product_code: m.material_code,
            product_name: m.material_name,
            requested_quantity: Number(m.quantity ?? 0) * qty,
            unit: m.unit,
            unit_cost: m.unit_cost,
            total_cost: Number(m.total_cost ?? 0) * qty,
            supplier_id: m.supplier_id ?? null,
            supplier_name: m.supplier_name ?? null,
            status: "pending",
          }));

          if (items.length > 0) {
            const { error: itemsErr } = await supabaseAdmin.from("material_requisition_items").insert(items);
            if (itemsErr) console.error("MR items insert failed:", itemsErr);
          }

          // Update approval + quote
          await supabaseAdmin
            .from("approvals")
            .update({
              status: "approved",
              decided_at: decidedAt,
              decided_by: decidedBy,
              notes: body.notes ?? approval.notes ?? null,
            })
            .eq("id", approval.id);

          await supabaseAdmin
            .from("quote_requests")
            .update({ status: "approved_in_production" })
            .eq("id", quote.id);

          await logCall({
            consumer: auth.consumer,
            request,
            endpoint,
            status: 200,
            startedAt: started,
            payload: { approval_id: approval.id, mo_id: mo.id, mr_id: mr.id },
          });

          return json({
            success: true,
            data: {
              approval_id: approval.id,
              decision: "approved",
              manufacturing_order: { id: mo.id, order_number: mo.order_number },
              material_requisition: { id: mr.id, requisition_number: mr.requisition_number, items_count: items.length },
            },
          });
        } catch (err) {
          console.error("Internal approval error:", err);
          await logCall({
            consumer: auth.consumer,
            request,
            endpoint,
            status: 500,
            startedAt: started,
            error: String(err),
          });
          return json({ success: false, error: "Internal server error", code: "internal_error" }, 500);
        }
      },
    },
  },
});
