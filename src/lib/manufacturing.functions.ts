/**
 * Manufacturing Orders — server functions
 *
 * All status changes go through the server (never directly from the browser).
 * The DB enforces legal transitions via `enforce_mo_status_transition` trigger;
 * this layer adds role checks and converts errors into friendly messages.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MO_STATUSES = [
  "pending",
  "materials_requested",
  "in_production",
  "quality_check",
  "ready",
  "delivered",
  "cancelled",
] as const;

export const updateManufacturingOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        orderId: z.string().uuid(),
        status: z.enum(MO_STATUSES),
        notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // role check: editor or admin
    const { data: isAuthorized } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "editor",
    });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAuthorized && !isAdmin) {
      throw new Error("forbidden: requires editor or admin role");
    }

    const updates: Record<string, unknown> = { status: data.status };
    const today = new Date().toISOString().split("T")[0];
    if (data.status === "in_production") updates.actual_start_date = today;
    if (data.status === "delivered") updates.actual_completion_date = today;
    if (data.notes) updates.production_notes = data.notes;

    const { data: updated, error } = await supabase
      .from("manufacturing_orders")
      .update(updates)
      .eq("id", data.orderId)
      .select("id, order_number, status")
      .single();

    if (error) {
      // surface DB trigger errors as a clean message
      if (/invalid_transition/.test(error.message)) {
        throw new Error(`الانتقال غير مسموح: ${error.message}`);
      }
      throw new Error(error.message);
    }

    return updated;
  });

export const fetchAllowedTransitions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("manufacturing_order_status_transitions")
      .select("from_status, to_status");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
