import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, CheckCircle, XCircle, Eye, Merge, Trash2, AlertTriangle, ScanSearch, Loader2 } from "lucide-react";
import { scanDuplicates } from "@/lib/duplicate-detection.functions";

export const Route = createFileRoute("/_authenticated/duplicates/")({
  head: () => ({ meta: [{ title: "مراجعة التكرار — Alazab PAOP" }] }),
  component: DuplicatesPage,
});

interface DuplicateGroup {
  id: string;
  title: string;
  status: string | null;
  confidence_score: number | null;
  created_at: string;
}

interface DuplicateItem {
  id: string;
  product_id: string;
  similarity_reason: string | null;
  product?: {
    id: string;
    az_code: string;
    name_ar: string;
    name_en: string | null;
    status: string;
    gpc_family: string | null;
  };
}

function DuplicatesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["duplicate-groups", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("duplicate_groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DuplicateGroup[];
    },
  });

  const { data: groupItems } = useQuery({
    queryKey: ["duplicate-group-items", selectedGroup?.id],
    enabled: !!selectedGroup,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duplicate_group_items")
        .select(`
          id,
          product_id,
          similarity_reason,
          product:products (
            id,
            az_code,
            name_ar,
            name_en,
            status,
            gpc_family
          )
        `)
        .eq("duplicate_group_id", selectedGroup!.id);

      if (error) throw error;
      return (data ?? []) as unknown as DuplicateItem[];
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ groupId, action, primaryId }: { groupId: string; action: "merge" | "dismiss"; primaryId?: string }) => {
      if (action === "merge" && primaryId) {
        // Mark group as resolved
        const { error } = await supabase
          .from("duplicate_groups")
          .update({ status: "resolved" })
          .eq("id", groupId);
        if (error) throw error;
        
        // Archive non-primary products
        const items = groupItems?.filter(item => item.product_id !== primaryId) ?? [];
        for (const item of items) {
          await supabase
            .from("products")
            .update({ status: "archived" })
            .eq("id", item.product_id);
        }
      } else {
        // Dismiss - just mark as ignored
        const { error } = await supabase
          .from("duplicate_groups")
          .update({ status: "ignored" })
          .eq("id", groupId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حل مجموعة التكرار بنجاح");
      queryClient.invalidateQueries({ queryKey: ["duplicate-groups"] });
      setSelectedGroup(null);
      setSelectedPrimary(null);
    },
    onError: () => {
      toast.error("حدث خطا اثناء حل المجموعة");
    },
  });

  const runScan = useServerFn(scanDuplicates);
  const scanMutation = useMutation({
    mutationFn: () => runScan({ data: undefined as any }),
    onSuccess: (res: any) => {
      toast.success(`تم الفحص: ${res.productGroups} مجموعة منتجات، ${res.flaggedProducts} عنصر مشكوك فيه`);
      queryClient.invalidateQueries({ queryKey: ["duplicate-groups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الفحص"),
  });


  const statusColors: Record<string, string> = {
    open: "bg-warning/15 text-warning",
    resolved: "bg-success/15 text-success",
    ignored: "bg-muted text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    open: "مفتوح",
    resolved: "تم الحل",
    ignored: "تم التجاهل",
  };

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Copy className="size-6" />
            مراجعة التكرار
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="num">{groups?.length ?? 0}</span> مجموعة تكرار محتمل
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            variant="default"
          >
            {scanMutation.isPending ? <Loader2 className="size-4 ml-1 animate-spin" /> : <ScanSearch className="size-4 ml-1" />}
            فحص التكرارات الآن
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="open">مفتوح</SelectItem>
              <SelectItem value="resolved">تم الحل</SelectItem>
              <SelectItem value="ignored">تم التجاهل</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <Card className="p-8 text-center text-muted-foreground surface-elevated border-0">
          جاري التحميل...
        </Card>
      )}

      {!isLoading && groups?.length === 0 && (
        <Card className="p-8 text-center surface-elevated border-0">
          <CheckCircle className="size-12 mx-auto text-success mb-3" />
          <div className="text-lg font-semibold">لا توجد تكرارات</div>
          <p className="text-sm text-muted-foreground mt-1">
            جميع البنود فريدة ولا يوجد تكرار محتمل
          </p>
        </Card>
      )}

      <div className="grid gap-4">
        {groups?.map((group) => (
          <Card key={group.id} className="p-4 surface-elevated border-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-warning/10 grid place-items-center">
                  <AlertTriangle className="size-5 text-warning" />
                </div>
                <div>
                  <div className="font-semibold">{group.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    نسبة التشابه: <span className="num">{group.confidence_score ?? 0}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={statusColors[group.status ?? "open"]}>
                  {statusLabels[group.status ?? "open"]}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedGroup(group);
                    setSelectedPrimary(null);
                  }}
                >
                  <Eye className="size-4 ml-1" />
                  مراجعة
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="size-5" />
              {selectedGroup?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-4">
            <p className="text-sm text-muted-foreground">
              اختر البند الاساسي للاحتفاظ به، سيتم ارشفة البنود الاخرى
            </p>
            
            {groupItems?.map((item) => (
              <Card
                key={item.id}
                className={`p-4 cursor-pointer transition-all ${
                  selectedPrimary === item.product_id
                    ? "ring-2 ring-accent bg-accent/5"
                    : "hover:bg-secondary/50"
                }`}
                onClick={() => setSelectedPrimary(item.product_id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`size-5 rounded-full border-2 grid place-items-center shrink-0 mt-0.5 ${
                    selectedPrimary === item.product_id ? "border-accent bg-accent" : "border-muted-foreground"
                  }`}>
                    {selectedPrimary === item.product_id && (
                      <CheckCircle className="size-3 text-accent-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.product?.name_ar}</span>
                      <span className="text-xs num text-muted-foreground" dir="ltr">
                        {item.product?.az_code}
                      </span>
                    </div>
                    {item.product?.name_en && (
                      <div className="text-sm text-muted-foreground" dir="ltr">
                        {item.product.name_en}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <Badge variant="outline">{item.product?.gpc_family ?? "غير مصنف"}</Badge>
                      {item.similarity_reason && (
                        <span className="text-muted-foreground">سبب التشابه: {item.similarity_reason}</span>
                      )}
                    </div>
                    <Link
                      to="/products/$id"
                      params={{ id: item.product_id }}
                      className="text-xs text-accent hover:underline mt-2 inline-block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      عرض تفاصيل البند
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedGroup) {
                  resolveMutation.mutate({ groupId: selectedGroup.id, action: "dismiss" });
                }
              }}
              disabled={resolveMutation.isPending}
            >
              <XCircle className="size-4 ml-1" />
              تجاهل (ليس تكرار)
            </Button>
            <Button
              onClick={() => {
                if (selectedGroup && selectedPrimary) {
                  resolveMutation.mutate({
                    groupId: selectedGroup.id,
                    action: "merge",
                    primaryId: selectedPrimary,
                  });
                }
              }}
              disabled={!selectedPrimary || resolveMutation.isPending}
            >
              <Merge className="size-4 ml-1" />
              دمج وارشفة البقية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
