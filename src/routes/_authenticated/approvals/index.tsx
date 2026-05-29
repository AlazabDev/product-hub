import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, MessageSquare, Loader2, Clock, AlertTriangle } from "lucide-react";
import { decideApproval, cancelApproval } from "@/lib/approvals.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/approvals/")({
  component: ApprovalsPage,
});

type Approval = {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  current_stage: "content_review" | "manager_review" | "final_approval";
  status: "pending" | "approved" | "rejected" | "changes_requested" | "cancelled";
  priority: string;
  notes: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  decided_at: string | null;
  created_at: string;
};

const STAGE_LABEL = {
  content_review: "مراجعة المحتوى",
  manager_review: "مراجعة المدير",
  final_approval: "الاعتماد النهائي",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  changes_requested: "outline",
  cancelled: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  changes_requested: "تعديلات مطلوبة",
  cancelled: "ملغي",
};

function ApprovalsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "decided" | "all">("pending");
  const [comment, setComment] = useState<Record<string, string>>({});

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ["approvals", tab],
    queryFn: async () => {
      let q = supabase
        .from("approvals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (tab === "pending") q = q.in("status", ["pending", "changes_requested"]);
      else if (tab === "decided") q = q.in("status", ["approved", "rejected", "cancelled"]);
      const { data, error } = await q;
      if (error) throw error;
      return data as Approval[];
    },
  });

  const decideFn = useServerFn(decideApproval);
  const cancelFn = useServerFn(cancelApproval);

  const decide = useMutation({
    mutationFn: (input: {
      approvalId: string;
      decision: "approved" | "rejected" | "changes_requested";
    }) => decideFn({ data: { ...input, comment: comment[input.approvalId] } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("تم تسجيل القرار");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (approvalId: string) => cancelFn({ data: { approvalId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("تم الإلغاء");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingCount = approvals.filter(
    (a) => a.status === "pending" || a.status === "changes_requested",
  ).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="size-6 text-accent" />
            مركز الموافقات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            سير عمل اعتماد المنتجات والأسعار عبر ٣ مراحل: مراجعة المحتوى ← مراجعة المدير ← الاعتماد
            النهائي
          </p>
        </div>
        <Badge variant="secondary" className="gap-1 text-sm">
          <Clock className="size-3.5" />
          {pendingCount} قيد المراجعة
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending">قيد المراجعة</TabsTrigger>
          <TabsTrigger value="decided">معتمد/مرفوض</TabsTrigger>
          <TabsTrigger value="all">الكل</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {isLoading ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : approvals.length === 0 ? (
            <Card className="p-12 surface-elevated border-0 text-center">
              <CheckCircle2 className="size-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-muted-foreground">لا توجد طلبات في هذا القسم</p>
            </Card>
          ) : (
            approvals.map((a) => {
              const isPending = a.status === "pending" || a.status === "changes_requested";
              return (
                <Card key={a.id} className="p-5 surface-elevated border-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant="outline" className="capitalize">
                          {a.entity_type}
                        </Badge>
                        <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                        {a.priority === "urgent" && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="size-3" />
                            عاجل
                          </Badge>
                        )}
                        {a.priority === "high" && <Badge variant="secondary">أولوية عالية</Badge>}
                      </div>
                      <h3 className="font-bold text-base">{a.title}</h3>
                      {a.notes && <p className="text-sm text-muted-foreground mt-1">{a.notes}</p>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                        <span>
                          المرحلة الحالية:{" "}
                          <span className="font-medium text-foreground">
                            {STAGE_LABEL[a.current_stage]}
                          </span>
                        </span>
                        <span dir="ltr" className="num">
                          {new Date(a.created_at).toLocaleString("en-GB")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stage progress */}
                  <div className="flex items-center gap-1 mb-4">
                    {(["content_review", "manager_review", "final_approval"] as const).map(
                      (s, idx) => {
                        const stages = ["content_review", "manager_review", "final_approval"];
                        const currentIdx = stages.indexOf(a.current_stage);
                        const done = a.status === "approved" || idx < currentIdx;
                        const active = idx === currentIdx && a.status !== "approved";
                        return (
                          <div key={s} className="flex-1 flex items-center gap-1">
                            <div
                              className={`h-1.5 flex-1 rounded-full ${done ? "bg-accent" : active ? "bg-accent/40" : "bg-muted"}`}
                            />
                            {idx < 2 && <div className="w-1" />}
                          </div>
                        );
                      },
                    )}
                  </div>

                  {isPending && (
                    <div className="space-y-3 border-t pt-3">
                      <Textarea
                        placeholder="تعليق على القرار (اختياري)..."
                        value={comment[a.id] ?? ""}
                        onChange={(e) => setComment((s) => ({ ...s, [a.id]: e.target.value }))}
                        rows={2}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => decide.mutate({ approvalId: a.id, decision: "approved" })}
                          disabled={decide.isPending}
                        >
                          <CheckCircle2 className="size-4" />
                          {a.current_stage === "final_approval" ? "اعتماد نهائي" : "موافقة وترقية"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() =>
                            decide.mutate({ approvalId: a.id, decision: "changes_requested" })
                          }
                          disabled={decide.isPending}
                        >
                          <MessageSquare className="size-4" />
                          طلب تعديلات
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          onClick={() => decide.mutate({ approvalId: a.id, decision: "rejected" })}
                          disabled={decide.isPending}
                        >
                          <XCircle className="size-4" />
                          رفض
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancel.mutate(a.id)}
                          disabled={cancel.isPending}
                        >
                          إلغاء الطلب
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
