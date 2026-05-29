import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Image as ImageIcon, DollarSign, Truck, Sparkles, ScrollText, Send, Languages } from "lucide-react";
import { ProductAssetsTab } from "@/components/product-assets-tab";
import { ProductPricingTab } from "@/components/product-pricing-tab";
import { ProductSuppliersTab } from "@/components/product-suppliers-tab";
import { ProductAIReviewTab } from "@/components/product-ai-review-tab";
import { ProductTranslationTab } from "@/components/product-translation-tab";
import { submitForApproval } from "@/lib/approvals.functions";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/products/$id")({
  head: () => ({ meta: [{ title: "تفاصيل البند — Alazab PAOP" }] }),
  component: ProductDetails,
});

function ProductDetails() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: p, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const submitFn = useServerFn(submitForApproval);
  const submit = useMutation({
    mutationFn: () => submitFn({ data: {
      entityType: "product", entityId: id, title: p?.name_ar ?? "طلب اعتماد منتج", priority: "normal",
    } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", id] });
      toast.success("تم إرسال البند للاعتماد");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">جاري التحميل...</div>;
  if (!p) return <div className="p-6 text-muted-foreground">البند غير موجود</div>;

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <Link to="/products" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowRight className="size-3" /> العودة للقائمة
      </Link>

      <Card className="p-6 surface-elevated border-0">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0 flex-1">
            <div className="num text-xs text-accent font-semibold" dir="ltr">{p.az_code}</div>
            <h1 className="text-2xl font-bold mt-1">{p.name_ar}</h1>
            <div className="text-sm text-muted-foreground mt-0.5" dir="ltr">{p.name_en}</div>
          </div>
          <div className="flex items-center gap-2">
            {p.status !== "approved" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => submit.mutate()}
                disabled={submit.isPending}
              >
                <Send className="size-3.5" />
                إرسال للاعتماد
              </Button>
            )}
            <StatusBadge status={p.status} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-4 border-t text-sm">
          <Field label="EGS Code" value={p.egs_code} mono />
          <Field label="النوع" value={p.item_type} />
          <Field label="GPC Brick" value={p.gs1_gpc_brick} mono />
          <Field label="العائلة" value={p.gpc_family} />
          <Field label="مستوى الثقة" value={p.confidence_level} />
        </div>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="bg-card border">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="assets"><ImageIcon className="size-3.5 ml-1" />الأصول</TabsTrigger>
          <TabsTrigger value="pricing"><DollarSign className="size-3.5 ml-1" />التسعير</TabsTrigger>
          <TabsTrigger value="suppliers"><Truck className="size-3.5 ml-1" />الموردون</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="size-3.5 ml-1" />AI</TabsTrigger>
          <TabsTrigger value="translate"><Languages className="size-3.5 ml-1" />الترجمة</TabsTrigger>
          <TabsTrigger value="audit"><ScrollText className="size-3.5 ml-1" />سجل التدقيق</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card className="p-6 surface-elevated border-0">
            <h3 className="font-bold mb-3">الوصف</h3>
            <div className="space-y-4 text-sm leading-loose">
              <div>
                <div className="text-xs text-muted-foreground mb-1">الوصف بالعربي</div>
                <p>{p.description_ar || "—"}</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Description (EN)</div>
                <p dir="ltr">{p.description_en || "—"}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 surface-elevated border-0">
            <h3 className="font-bold mb-3">تصنيف GPC</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Field label="GPC Segment" value={p.gpc_segment} />
              <Field label="GPC Family" value={p.gpc_family} />
              <Field label="GPC Class" value={p.gpc_class} />
              <Field label="GPC Brick Title" value={p.gpc_brick_title} />
              <Field label="المسار التشغيلي" value={p.operational_track} />
              <Field label="القطاع" value={p.sector_ar} />
              <Field label="المصدر" value={p.source} />
              <Field label="تاريخ الإنشاء" value={new Date(p.created_at).toLocaleDateString("ar-EG")} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <ProductAssetsTab productId={p.id} azCode={p.az_code} />
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <ProductPricingTab productId={p.id} />
        </TabsContent>
        <TabsContent value="suppliers" className="mt-4">
          <ProductSuppliersTab productId={p.id} />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <ProductAIReviewTab productId={p.id} />
        </TabsContent>

        <TabsContent value="translate" className="mt-4">
          <ProductTranslationTab productId={p.id} />
        </TabsContent>


        <TabsContent value="audit" className="mt-4">
          <Card className="p-12 surface-elevated border-0 text-center">
            <div className="inline-block size-12 rounded-full bg-accent/15 grid place-items-center mb-3">
              <ScrollText className="size-5 text-accent" />
            </div>
            <h3 className="font-bold mb-1">سجل التدقيق</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              راجع جميع التغييرات في صفحة <Link to="/audit-logs" className="text-accent underline">سجل التدقيق</Link>.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


function Field({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={mono ? "num text-sm" : "text-sm"} dir={mono ? "ltr" : undefined}>{value || "—"}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: "معتمد", cls: "bg-success/15 text-success" },
    draft: { label: "مسودة", cls: "bg-muted text-muted-foreground" },
    needs_review: { label: "مراجعة", cls: "bg-warning/15 text-warning" },
    rejected: { label: "مرفوض", cls: "bg-destructive/15 text-destructive" },
    archived: { label: "مؤرشف", cls: "bg-muted text-muted-foreground" },
  };
  const v = map[status] ?? { label: status, cls: "bg-secondary" };
  return <span className={`text-xs px-3 py-1 rounded ${v.cls}`}>{v.label}</span>;
}
