import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, AlertTriangle, CheckCircle2, Loader2, Wand2 } from "lucide-react";
import { reviewProduct, applyAISuggestions } from "@/lib/ai-review.functions";
import { toast } from "sonner";

interface Props { productId: string }

export function ProductAIReviewTab({ productId }: Props) {
  const qc = useQueryClient();
  const runReview = useServerFn(reviewProduct);
  const applyFn = useServerFn(applyAISuggestions);
  const [editable, setEditable] = useState<Record<string, string>>({});

  const review = useMutation({
    mutationFn: () => runReview({ data: { productId, useAI: true } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["product", productId] });
      const s = r.suggestions ?? {};
      setEditable({
        short_description_ar: s.short_description_ar ?? "",
        short_description_en: s.short_description_en ?? "",
        marketing_content: s.marketing_content ?? "",
        technical_content: s.technical_content ?? "",
      });
      if (r.newStatus !== r.previousStatus) {
        toast.success(`تم تحديث الحالة: ${r.previousStatus} → ${r.newStatus}`);
      } else {
        toast.success("اكتملت مراجعة المحتوى");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: (fields: Record<string, unknown>) => applyFn({ data: { productId, fields } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", productId] });
      toast.success("تم تطبيق الاقتراحات");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const result = review.data;

  return (
    <div className="space-y-4">
      <Card className="p-6 surface-elevated border-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-accent/15 grid place-items-center">
              <Sparkles className="size-5 text-accent" />
            </div>
            <div>
              <h3 className="font-bold">مراجعة المحتوى بالذكاء الاصطناعي</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                يفحص الحقول الناقصة، يقترح تحسينات، ويُحدّث حالة البند تلقائياً وفق قواعد الحوكمة
                (draft / needs_review / content_incomplete).
              </p>
            </div>
          </div>
          <Button onClick={() => review.mutate()} disabled={review.isPending} className="gap-2">
            {review.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            تشغيل المراجعة
          </Button>
        </div>
      </Card>

      {result && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <StatCard label="جودة المحتوى" value={`${result.suggestions?.quality_score ?? "—"}/100`} />
            <StatCard label="حقول حرجة ناقصة" value={String(result.missingCritical.length)} variant={result.missingCritical.length ? "danger" : "ok"} />
            <StatCard label="حقول ثانوية ناقصة" value={String(result.missingSoft.length)} variant={result.missingSoft.length >= 4 ? "warn" : "ok"} />
          </div>

          <Card className="p-5 surface-elevated border-0">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold">الحالة بعد المراجعة</h4>
              <Badge variant="outline">{result.previousStatus} → <span className="font-bold mx-1">{result.newStatus}</span></Badge>
            </div>
            {result.suggestions?.notes && (
              <p className="text-sm text-muted-foreground border-r-2 border-accent pr-3">{result.suggestions.notes}</p>
            )}
          </Card>

          {result.missingCritical.length > 0 && (
            <Card className="p-5 border-destructive/30 bg-destructive/5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="size-4 text-destructive" />
                <h4 className="font-bold text-destructive">حقول حرجة ناقصة</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.missingCritical.map((f) => (
                  <Badge key={f.field} variant="destructive">{f.label}</Badge>
                ))}
              </div>
            </Card>
          )}

          {result.missingSoft.length > 0 && (
            <Card className="p-5 surface-elevated border-0">
              <h4 className="font-bold mb-3">حقول ثانوية ناقصة</h4>
              <div className="flex flex-wrap gap-2">
                {result.missingSoft.map((f) => (
                  <Badge key={f.field} variant="secondary">{f.label}</Badge>
                ))}
              </div>
            </Card>
          )}

          {result.suggestions && (
            <Card className="p-5 surface-elevated border-0 space-y-4">
              <h4 className="font-bold">اقتراحات الذكاء الاصطناعي</h4>
              {(["short_description_ar","short_description_en","marketing_content","technical_content"] as const).map((k) => (
                editable[k] !== undefined && editable[k].length > 0 ? (
                  <div key={k} className="space-y-2">
                    <div className="text-xs text-muted-foreground">{k}</div>
                    <Textarea
                      value={editable[k]}
                      onChange={(e) => setEditable((s) => ({ ...s, [k]: e.target.value }))}
                      rows={3}
                    />
                    <Button size="sm" variant="outline" className="gap-2"
                      onClick={() => apply.mutate({ [k]: editable[k] })}
                      disabled={apply.isPending}
                    >
                      <CheckCircle2 className="size-3.5" /> تطبيق هذا الحقل
                    </Button>
                  </div>
                ) : null
              ))}

              {(result.suggestions.tags?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">وسوم مقترحة</div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.suggestions.tags!.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                  </div>
                  <Button size="sm" variant="outline"
                    onClick={() => apply.mutate({ tags: result.suggestions!.tags })}
                    disabled={apply.isPending}>تطبيق الوسوم</Button>
                </div>
              )}

              {(result.suggestions.search_keywords?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">كلمات بحث مقترحة</div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.suggestions.search_keywords!.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                  </div>
                  <Button size="sm" variant="outline"
                    onClick={() => apply.mutate({ search_keywords: result.suggestions!.search_keywords })}
                    disabled={apply.isPending}>تطبيق الكلمات</Button>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, variant }: { label: string; value: string; variant?: "ok" | "warn" | "danger" }) {
  const cls = variant === "danger" ? "text-destructive" : variant === "warn" ? "text-warning" : "text-success";
  return (
    <Card className="p-4 surface-elevated border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold num mt-1 ${variant ? cls : ""}`}>{value}</div>
    </Card>
  );
}
