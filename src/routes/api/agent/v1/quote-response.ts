/**
 * Alazab PAOP - Customer Response API
 * POST /api/agent/v1/quote-response
 *
 * APPROVAL GATE: when the customer accepts, this endpoint does NOT create a
 * manufacturing order or material requisition. It transitions the quote to
 * `accepted_pending_internal_approval` and creates an approvals record.
 * Manufacturing / material requisitions are only created by the internal
 * approval endpoint after an authorised user approves.
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
        const endpoint = "/api/agent/v1/quote-response";
        const auth = await requireApiKey(request, "/api/agent/v1/quote-response");
        if ("error" in auth) {
          await logCall({ consumer: null, request, endpoint, status: 401, startedAt: started, error: "auth" });
          return auth.error;
        }

        try {
          const body = await request.json();

          if (!body.quote_id && !body.request_id) {
            return json({ success: false, error: "Missing quote_id or request_id", code: "missing_identifier" }, 400);
          }
          if (!body.response || !["accepted", "rejected"].includes(body.response)) {
            return json(
              { success: false, error: "Invalid response. Must be 'accepted' or 'rejected'", code: "invalid_response" },
              400,
            );
          }

          // Fetch the quote
          let query = supabaseAdmin.from("quote_requests").select("*");
          query = body.quote_id ? query.eq("id", body.quote_id) : query.eq("request_id", body.request_id);
          const { data: quote, error: quoteError } = await query.maybeSingle();

          if (quoteError || !quote) {
            return json({ success: false, error: "Quote not found", code: "quote_not_found" }, 404);
          }
          if (quote.status !== "quoted") {
            return json(
              { success: false, error: `Quote already ${quote.status}`, code: "invalid_quote_state" },
              400,
            );
          }
          if (quote.quote_valid_until && new Date(quote.quote_valid_until) < new Date()) {
            await supabaseAdmin.from("quote_requests").update({ status: "expired" }).eq("id", quote.id);
            return json({ success: false, error: "Quote has expired", code: "quote_expired" }, 400);
          }

          // ---------- Rejected branch ----------
          if (body.response === "rejected") {
            await supabaseAdmin
              .from("quote_requests")
              .update({
                status: "rejected",
                customer_response: "rejected",
                customer_response_at: new Date().toISOString(),
                rejection_reason: body.rejection_reason ?? null,
              })
              .eq("id", quote.id);

            await supabaseAdmin.from("chatbot_interactions").insert({
              quote_request_id: quote.id,
              interaction_type: "customer_rejected",
              direction: "inbound",
              payload: body as never,
              status: "delivered",
              delivered_at: new Date().toISOString(),
            });

            await logCall({
              consumer: auth.consumer,
              request,
              endpoint,
              status: 200,
              startedAt: started,
              payload: { quote_id: quote.id, response: "rejected" },
            });

            return json({
              success: true,
              data: {
                quote_id: quote.id,
                response: "rejected",
                rejection_reason: body.rejection_reason ?? null,
                message_ar: "تم رفض العرض. نتمنى خدمتكم في المستقبل.",
                message_en: "Quote rejected. We hope to serve you in the future.",
              },
            });
          }

          // ---------- Accepted branch -> Approval Gate ----------
          await supabaseAdmin
            .from("quote_requests")
            .update({
              status: "accepted_pending_internal_approval",
              customer_response: "accepted",
              customer_response_at: new Date().toISOString(),
            })
            .eq("id", quote.id);

          const priority = String(body.priority ?? "normal");
          const title = `Quote ${quote.request_id ?? quote.id.slice(0, 8)} — ${quote.customer_name ?? "customer"}`;

          const { data: approval, error: approvalError } = await supabaseAdmin
            .from("approvals")
            .insert({
              entity_type: "quote_request",
              entity_id: quote.id,
              title,
              status: "pending",
              current_stage: "internal_review" as never,
              priority,
              notes: body.customer_notes ?? null,
            })
            .select()
            .single();

          if (approvalError || !approval) {
            console.error("Failed to create approval:", approvalError);
            return json(
              { success: false, error: "Failed to create internal approval", code: "approval_create_failed" },
              500,
            );
          }

          await supabaseAdmin.from("chatbot_interactions").insert({
            quote_request_id: quote.id,
            interaction_type: "customer_accepted",
            direction: "inbound",
            payload: body as never,
            response_payload: { approval_id: approval.id } as never,
            status: "delivered",
            delivered_at: new Date().toISOString(),
          });

          await logCall({
            consumer: auth.consumer,
            request,
            endpoint,
            status: 200,
            startedAt: started,
            payload: { quote_id: quote.id, response: "accepted", approval_id: approval.id },
          });

          return json({
            success: true,
            data: {
              quote_id: quote.id,
              response: "accepted",
              status: "accepted_pending_internal_approval",
              approval: {
                approval_id: approval.id,
                status: approval.status,
                current_stage: approval.current_stage,
              },
              message_ar: "تم استلام موافقتكم. الطلب الآن قيد المراجعة الداخلية.",
              message_en: "Your acceptance is recorded. The order is pending internal review.",
            },
          });
        } catch (err) {
          console.error("Quote response error:", err);
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
