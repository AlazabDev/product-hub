import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STAGES = ["content_review", "manager_review", "final_approval"] as const;
type Stage = (typeof STAGES)[number];

function nextStage(s: Stage): Stage | null {
  const i = STAGES.indexOf(s);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

async function notify(
  supabase: any,
  userId: string | null,
  title: string,
  body: string,
  link?: string,
  kind = "info",
) {
  if (!userId) return;
  await supabase.from("notifications").insert({ user_id: userId, title, body, link, kind });
}

export const submitForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entityType: z.enum(["product", "price", "quote_request"]),
        entityId: z.string().uuid(),
        title: z.string().min(1).max(200),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        notes: z.string().max(2000).optional(),
        assignedTo: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: approval, error } = await supabase
      .from("approvals")
      .insert({
        entity_type: data.entityType,
        entity_id: data.entityId,
        title: data.title,
        priority: data.priority,
        notes: data.notes ?? null,
        requested_by: userId,
        assigned_to: data.assignedTo ?? null,
        status: "pending",
        current_stage: "content_review",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("approval_history").insert({
      approval_id: approval.id,
      stage: "content_review",
      action: "submitted",
      comment: data.notes ?? null,
      actor: userId,
    });

    if (data.entityType === "product") {
      await supabase.from("products").update({ status: "needs_review" }).eq("id", data.entityId);
    }

    await notify(
      supabase,
      data.assignedTo ?? null,
      "طلب موافقة جديد",
      data.title,
      `/approvals`,
      "approval_request",
    );

    return approval;
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        approvalId: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "changes_requested"]),
        comment: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: appr, error: e1 } = await supabase
      .from("approvals")
      .select("*")
      .eq("id", data.approvalId)
      .single();
    if (e1 || !appr) throw new Error(e1?.message ?? "Approval not found");

    // ---------- Special path: quote_request -> atomic RPC ----------
    if (appr.entity_type === "quote_request" && data.decision === "approved") {
      const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        "approve_quote_for_manufacturing",
        {
          _approval_id: data.approvalId,
          _decided_by: userId,
          _notes: data.comment ?? null,
        },
      );
      if (rpcErr) throw new Error(rpcErr.message);

      await supabase.from("approval_history").insert({
        approval_id: data.approvalId,
        stage: appr.current_stage,
        action: "approved",
        comment: data.comment ?? null,
        actor: userId,
      });

      await notify(
        supabase,
        appr.requested_by,
        "تم اعتماد طلب التصنيع",
        appr.title,
        `/manufacturing-orders`,
        "approval_result",
      );

      return {
        ok: true,
        status: "approved",
        stage: appr.current_stage,
        manufacturing: rpcResult,
      };
    }

    let newStatus = appr.status as string;
    let newStage = appr.current_stage as Stage;
    let decidedAt: string | null = null;
    let decidedBy: string | null = null;

    if (data.decision === "approved") {
      const nxt = nextStage(appr.current_stage as Stage);
      if (nxt) {
        newStage = nxt;
        newStatus = "pending";
      } else {
        newStatus = "approved";
        decidedAt = new Date().toISOString();
        decidedBy = userId;
      }
    } else if (data.decision === "rejected") {
      newStatus = "rejected";
      decidedAt = new Date().toISOString();
      decidedBy = userId;
    } else {
      newStatus = "changes_requested";
    }

    const { error: e2 } = await supabase
      .from("approvals")
      .update({
        status: newStatus as
          | "approved"
          | "rejected"
          | "changes_requested"
          | "pending"
          | "cancelled",
        current_stage: newStage,
        decided_at: decidedAt,
        decided_by: decidedBy,
      })
      .eq("id", data.approvalId);
    if (e2) throw new Error(e2.message);

    await supabase.from("approval_history").insert({
      approval_id: data.approvalId,
      stage: appr.current_stage,
      action: data.decision,
      comment: data.comment ?? null,
      actor: userId,
    });

    // Reflect on entity
    if (appr.entity_type === "product") {
      if (newStatus === "approved") {
        await supabase
          .from("products")
          .update({
            status: "approved",
            approved_by: userId,
            approved_at: new Date().toISOString(),
          })
          .eq("id", appr.entity_id);
      } else if (newStatus === "rejected") {
        await supabase.from("products").update({ status: "draft" }).eq("id", appr.entity_id);
      } else if (newStatus === "changes_requested") {
        await supabase.from("products").update({ status: "needs_review" }).eq("id", appr.entity_id);
      }
    } else if (appr.entity_type === "price" && newStatus === "approved") {
      await supabase
        .from("prices")
        .update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
        .eq("id", appr.entity_id);
    } else if (appr.entity_type === "quote_request" && newStatus === "rejected") {
      await supabase
        .from("quote_requests")
        .update({ status: "rejected", rejection_reason: data.comment ?? "Internal rejection" })
        .eq("id", appr.entity_id);
    }

    await notify(
      supabase,
      appr.requested_by,
      `قرار على طلبك: ${data.decision}`,
      appr.title,
      `/approvals`,
      "approval_result",
    );

    return { ok: true, status: newStatus, stage: newStage };
  });

export const cancelApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ approvalId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("approvals")
      .update({ status: "cancelled" })
      .eq("id", data.approvalId);
    if (error) throw new Error(error.message);
    await supabase.from("approval_history").insert({
      approval_id: data.approvalId,
      stage: "content_review",
      action: "cancelled",
      actor: userId,
    });
    return { ok: true };
  });

export const reassignApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        approvalId: z.string().uuid(),
        assignedTo: z.string().uuid(),
        comment: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: appr } = await supabase
      .from("approvals")
      .select("title,current_stage")
      .eq("id", data.approvalId)
      .single();
    const { error } = await supabase
      .from("approvals")
      .update({ assigned_to: data.assignedTo })
      .eq("id", data.approvalId);
    if (error) throw new Error(error.message);
    await supabase.from("approval_history").insert({
      approval_id: data.approvalId,
      stage: (appr?.current_stage as Stage) ?? "content_review",
      action: "reassigned",
      comment: data.comment ?? null,
      actor: userId,
    });
    await notify(
      supabase,
      data.assignedTo,
      "تم تكليفك بمراجعة طلب",
      appr?.title ?? "طلب موافقة",
      "/approvals",
      "approval_request",
    );
    return { ok: true };
  });
