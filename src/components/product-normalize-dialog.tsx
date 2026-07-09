import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import type { NormalizeDiffEntry } from "@/lib/product-normalize";

interface ProductNormalizeDialogProps {
  open: boolean;
  diff: NormalizeDiffEntry[];
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v || "—";
  return JSON.stringify(v);
}

export function ProductNormalizeDialog({
  open,
  diff,
  loading,
  onCancel,
  onConfirm,
}: ProductNormalizeDialogProps) {
  const hasChanges = diff.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            تنسيق تلقائي لبيانات المنتج
          </DialogTitle>
          <DialogDescription>
            {hasChanges
              ? `تم اقتراح ${diff.length} تعديل لتوحيد صياغة الحقول (الوحدة، التسعير، التصنيفات، النصوص). راجع التغييرات قبل الحفظ.`
              : "البيانات منسّقة بالفعل — لا توجد تعديلات مقترحة."}
          </DialogDescription>
        </DialogHeader>

        {hasChanges ? (
          <ScrollArea className="max-h-[420px] pr-2">
            <div className="space-y-3">
              {diff.map((d) => (
                <div
                  key={d.field}
                  className="rounded-lg border bg-muted/30 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{d.label}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {d.rule}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs">
                    <div className="rounded border bg-background p-2 line-through decoration-destructive/60 text-muted-foreground break-all">
                      {fmt(d.before)}
                    </div>
                    <ArrowLeft className="size-4 text-muted-foreground shrink-0" />
                    <div className="rounded border border-primary/40 bg-primary/5 p-2 text-foreground break-all">
                      {fmt(d.after)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="size-12 text-green-600 mb-2" />
            <p className="text-sm text-muted-foreground">
              لا حاجة لأي تعديل — يمكنك المتابعة مباشرة.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            إلغاء والتعديل يدويًا
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {hasChanges ? "تطبيق التنسيق والحفظ" : "متابعة الحفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
