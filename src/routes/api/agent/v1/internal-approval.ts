/**
 * Alazab PAOP - Internal Approval Endpoint (thin wrapper)
 * POST /api/agent/v1/internal-approval
 *
 * On approval, delegates to the atomic DB function
 * `approve_quote_for_manufacturing(_approval_id, _decided_by, _notes)` which
 * creates the Manufacturing Order, Material Requisition, and items in a
 * single transaction. On rejection, performs the local state updates.
 */

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { corsHeaders, json, logCall, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/agent/v1/internal-approval")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: corsHeaders(request) }),

      POST: async ({ request }) => {
        const started = Date.now();
        const endpoint = "/api/agent/v1/internal-approval";
        const auth = await requireApiKey(request, endpoint);
        if ("error" in auth) {
          await logCall({
            consumer: null,
            request,
            endpoint,
            status: 401,
            startedAt: started,
            error: "auth",
          });
          return auth.error;
        }

        try {
          const body = await request.json();
          if (
            !body.approval_id ||
            !body.decision ||
            !["approved", "rejected"].includes(body.decision)
          ) {
            return json(
              {
                success: false,
                error: "Missing approval_id or invalid decision",
                code: "invalid_input",
              },
              400,
              request,
            );
          }

          // ---------- Rejected branch (local updates) ----------
          if (body.decision === "rejected") {
            const { data: approval, error: aErr } = await supabaseAdmin
              .from("approvals")
              .select("id, status, entity_type, entity_id, notes")
              .eq("id", body.approval_id)
              .maybeSingle();
            if (aErr || !approval) {
              return json(
                { success: false, error: "Approval not found", code: "approval_not_found" },
                404,
                request,
              );
            }
            if (approval.status !== "pending") {
              return json(
                {
                  success: false,
                  error: `Approval already ${approval.status}`,
                  code: "invalid_approval_state",
                },
                400,
                request,
              );
            }

            const decidedAt = new Date().toISOString();
            await supabaseAdmin
              .from("approvals")
              .update({
                status: "rejected",
                decided_at: decidedAt,
                decided_by: body.decided_by ?? null,
                notes: body.notes ?? approval.notes ?? null,
              })
              .eq("id", approval.id);

            if (approval.entity_type === "quote_request") {
              await supabaseAdmin
                .from("quote_requests")
                .update({
                  status: "rejected",
                  rejection_reason: body.notes ?? "Internal rejection",
                })
                .eq("id", approval.entity_id);
            }

            await logCall({
              consumer: auth.consumer,
              request,
              endpoint,
              status: 200,
              startedAt: started,
              payload: { approval_id: approval.id, decision: "rejected" },
            });

            return json(
              {
                success: true,
                data: { approval_id: approval.id, decision: "rejected" },
              },
              200,
              request,
            );
          }

          // ---------- Approved branch: delegate to atomic RPC ----------
          const { data: rpcResult, error: rpcErr } = await (supabaseAdmin.rpc as any)(
            "approve_quote_for_manufacturing",
            {
              _approval_id: body.approval_id,
              _decided_by: body.decided_by ?? null,
              _notes: body.notes ?? null,
            },
          );

          if (rpcErr) {
            console.error("approve_quote_for_manufacturing failed:", rpcErr);
            const code = /not_found/.test(rpcErr.message)
              ? "not_found"
              : /not_pending|wrong_entity|invalid/.test(rpcErr.message)
                ? "invalid_state"
                : "rpc_failed";
            const status = code === "not_found" ? 404 : code === "invalid_state" ? 400 : 500;
            await logCall({
              consumer: auth.consumer,
              request,
              endpoint,
              status,
              startedAt: started,
              error: rpcErr.message,
            });
            return json(
              { success: false, error: rpcErr.message, code },
              status,
              request,
            );
          }

          const result = rpcResult as unknown as {
            approval_id: string;
            manufacturing_order_id: string;
            order_number: string;
            material_requisition_id: string;
            requisition_number: string;
            items_count: number;
          };

          await logCall({
            consumer: auth.consumer,
            request,
            endpoint,
            status: 200,
            startedAt: started,
            payload: {
              approval_id: result.approval_id,
              mo_id: result.manufacturing_order_id,
              mr_id: result.material_requisition_id,
            },
          });

          return json(
            {
              success: true,
              data: {
                approval_id: result.approval_id,
                decision: "approved",
                manufacturing_order: {
                  id: result.manufacturing_order_id,
                  order_number: result.order_number,
                },
                material_requisition: {
                  id: result.material_requisition_id,
                  requisition_number: result.requisition_number,
                  items_count: result.items_count,
                },
              },
            },
            200,
            request,
          );
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
          return json(
            { success: false, error: "Internal server error", code: "internal_error" },
            500,
            request,
          );
        }
      },
    },
  },
});
