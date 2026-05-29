import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ScanSearch, Loader2, ArrowLeft } from "lucide-react";
import { scanAllForReview } from "@/lib/ai-review.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/content-review")({
  head: () => ({ meta: [{ title: "مراجعة المحتوى — Alazab PAOP" }] }),
  component: ContentReviewPage,
});

const TARGET_STATUSES = ["draft", "needs_review", "content_incomplete"] as const;

function ContentReviewPage() {
  const qc = useQueryClient();
  const scanFn = useServerFn(scanAllForReview);

  const { data: counts } = useQuery({
    queryKey: ["content-review-counts"],
    queryFn: async () => {
      const res = await Promise.all(
        TARGET_STATUSES.map(async (s) => {
          const { count } = await supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("status", s as never);
          return [s, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(res) as Record<string, number>;
    },
  });

  const { data: list } = useQuery({
    queryKey: ["content-review-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, az_code, name_ar, status, updated_at")
        .in("status", TARGET_STATUSES as never)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const scan = useMutation({
    mutationFn: () => scanFn({ data: { limit: 200 } }),
    onSuccess: (r) => {
      toast.success(`تم فحص ${r.scanned} بند — تم تحديث ${r.updates}`);
      qc.invalidateQueries({ queryKey: ["content-review-counts"] });
      qc.invalidateQueries({ queryKey: ["content-review-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="size-6 text-accent" /> مراجعة المحتوى الذكية
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            اكتشف الحقول الناقصة وحوكمة الحالات (draft / needs_review / content_incomplete)
          </p>
        </div>
        <Button onClick={() => scan.mutate()} disabled={scan.isPending} className="gap-2">
          {scan.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ScanSearch className="size-4" />
          )}
          فحص شامل
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard label="مسودة" value={counts?.draft ?? 0} tone="muted" />
        <StatCard label="بحاجة مراجعة" value={counts?.needs_review ?? 0} tone="warn" />
        <StatCard label="محتوى ناقص" value={counts?.content_incomplete ?? 0} tone="danger" />
      </div>

      <Card className="surface-elevated border-0 overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-bold">آخر البنود في قائمة المراجعة</h3>
        </div>
        <div className="divide-y">
          {(list ?? []).map((p) => (
            <Link
              key={p.id}
              to="/products/$id"
              params={{ id: p.id }}
              className="flex items-center justify-between p-4 hover:bg-muted/30 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="num text-xs text-accent" dir="ltr">
                  {p.az_code}
                </div>
                <div className="font-medium truncate">{p.name_ar}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={p.status as string} />
                <ArrowLeft className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
          {(list ?? []).length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              لا توجد بنود تحتاج مراجعة 🎉
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "warn" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-warning"
        : "text-muted-foreground";
  return (
    <Card className="p-5 surface-elevated border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-3xl font-bold num mt-1 ${cls}`}>{value}</div>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "مسودة", cls: "bg-muted text-muted-foreground" },
    needs_review: { label: "مراجعة", cls: "bg-warning/15 text-warning" },
    content_incomplete: { label: "محتوى ناقص", cls: "bg-destructive/15 text-destructive" },
  };
  const v = map[status] ?? { label: status, cls: "bg-secondary" };
  return (
    <Badge className={`${v.cls} border-0`} variant="secondary">
      {v.label}
    </Badge>
  );
}
